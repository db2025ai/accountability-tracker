// Daily sync into the learning ledger (crons.ts, or Claude's sync_learning tool):
//  - Goodreads: the public Read and Currently Reading shelf feeds (env GOODREADS_USER_ID).
//    Goodreads retired its API in 2020; the shelf RSS still works for public profiles.
//  - Spotify: episodes of followed shows and audiobook chapters, using each one's resume point
//    (env SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET; connect once at /spotify/connect/<MCP_TOKEN>).
// Both only add or advance sources; capturing ideas stays with Claude and Daniel.
import { internalAction, internalQuery, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { TZ, addDays, parseShelf, playState } from "./lib/learning";
import { DEFAULT_USER, localParts } from "./lib/reminders";

type Src = {
  kind: string;
  title: string;
  author?: string;
  url?: string;
  origin: string;
  externalId?: string;
  status: string;
  progress?: number;
  startedAt?: string;
  finishedAt?: string;
};

const today = () => localParts(new Date(), TZ).dateKey;

// ---- Goodreads ----
export async function goodreadsSources(userId: string, day: string, fetcher: typeof fetch = fetch): Promise<Src[]> {
  const shelf = async (name: string) => {
    const r = await fetcher(`https://www.goodreads.com/review/list_rss/${encodeURIComponent(userId)}?shelf=${name}`);
    if (!r.ok) throw new Error(`Goodreads ${name} shelf: HTTP ${r.status}`);
    return parseShelf(await r.text());
  };
  const [read, reading] = await Promise.all([shelf("read"), shelf("currently-reading")]);
  const recent = addDays(day, -30);
  const out: Src[] = [];
  for (const b of reading) {
    out.push({ kind: "book", title: b.title, author: b.author || undefined, url: b.url || undefined, origin: "goodreads", externalId: `goodreads:${b.bookId}`, status: "in_progress", ...(b.addedAt ? { startedAt: b.addedAt } : {}) });
  }
  for (const b of read) {
    const finishedAt = b.readAt ?? b.addedAt;
    // Finished in the last 30 days: queue it for capture. Older: the backlog, picked from later.
    const status = finishedAt && finishedAt >= recent ? "finished" : "backlog";
    out.push({ kind: "book", title: b.title, author: b.author || undefined, url: b.url || undefined, origin: "goodreads", externalId: `goodreads:${b.bookId}`, status, ...(finishedAt ? { finishedAt } : {}) });
  }
  return out;
}

// ---- Spotify ----
const SPOTIFY_API = "https://api.spotify.com/v1";
export const SPOTIFY_SCOPES = "user-library-read user-read-playback-position";

async function spotifyToken(ctx: ActionCtx, fetcher: typeof fetch) {
  const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  const state = await ctx.runQuery(internal.learning.getState, { key: "spotify" });
  if (!id || !secret || !state?.refreshToken) return null;
  const r = await fetcher("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${id}:${secret}`)}` },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: state.refreshToken }).toString(),
  });
  if (!r.ok) throw new Error(`Spotify token refresh: HTTP ${r.status}`);
  const tok = await r.json();
  if (tok.refresh_token && tok.refresh_token !== state.refreshToken) {
    await ctx.runMutation(internal.learning.setState, { key: "spotify", value: { ...state, refreshToken: tok.refresh_token } });
  }
  return tok.access_token as string;
}

export async function spotifySources(token: string, day: string, known: Set<string>, fetcher: typeof fetch = fetch): Promise<Src[]> {
  const get = async (path: string) => {
    const r = await fetcher(`${SPOTIFY_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 429) throw new Error("Spotify rate limit, try again later");
    if (!r.ok) throw new Error(`Spotify ${path.split("?")[0]}: HTTP ${r.status}`);
    return r.json();
  };
  const out: Src[] = [];
  const since = addDays(day, -21);

  // Podcasts: the last few episodes of each followed show. The show listing's resume points are
  // unreliable, so each recent episode is read on its own (GET /episodes/{id} is accurate).
  const shows = (await get("/me/shows?limit=50")).items || [];
  for (const { show } of shows) {
    if (!show?.id) continue;
    const eps = ((await get(`/shows/${show.id}/episodes?limit=5`)).items || []).filter((e: any) => e && e.release_date >= since);
    for (const e of eps) {
      const extId = `spotify:episode:${e.id}`;
      if (known.has(extId)) continue; // already finished or captured
      const ep = await get(`/episodes/${e.id}`);
      const p = playState(ep);
      if (p.state === "none") continue;
      out.push({ kind: "podcast", title: ep.name, author: show.name, url: ep.external_urls?.spotify, origin: "spotify", externalId: extId, status: p.state, progress: p.progress, ...(p.state === "finished" ? { finishedAt: day } : { startedAt: day }) });
    }
  }

  // Audiobooks: progress = share of chapter time played
  const books = (await get("/me/audiobooks?limit=50")).items || [];
  for (const b of books) {
    if (!b?.id) continue;
    const extId = `spotify:audiobook:${b.id}`;
    if (known.has(extId)) continue;
    let chapters: any[] = [];
    for (let offset = 0; offset < 500; offset += 50) {
      const page = await get(`/audiobooks/${b.id}/chapters?limit=50&offset=${offset}`);
      chapters = chapters.concat(page.items || []);
      if (!page.next) break;
    }
    const total = chapters.reduce((n, c) => n + (c.duration_ms || 0), 0);
    const played = chapters.reduce((n, c) => n + playState(c).progress * (c.duration_ms || 0), 0);
    const progress = total ? Math.round((played / total) * 100) / 100 : 0;
    const status = progress >= 0.9 ? "finished" : progress >= 0.02 ? "in_progress" : null;
    if (!status) continue;
    const author = (b.authors || []).map((a: any) => a.name).join(", ");
    out.push({ kind: "audiobook", title: b.name, author: author || undefined, url: b.external_urls?.spotify, origin: "spotify", externalId: extId, status, progress, ...(status === "finished" ? { finishedAt: day } : { startedAt: day }) });
  }
  return out;
}

export async function runSync(ctx: ActionCtx, fetcher: typeof fetch = fetch) {
  const day = today();
  const report: Record<string, unknown> = { date: day };
  const sources: Src[] = [];

  const grId = process.env.GOODREADS_USER_ID;
  if (grId) {
    try {
      const gr = await goodreadsSources(grId, day, fetcher);
      sources.push(...gr);
      report.goodreads = `${gr.length} books on Read and Currently Reading`;
    } catch (e: any) {
      report.goodreads = `failed: ${e?.message || e}`;
    }
  } else report.goodreads = "not set up (GOODREADS_USER_ID)";

  try {
    const token = await spotifyToken(ctx, fetcher);
    if (!token) report.spotify = "not connected";
    else {
      // Skip anything already past in_progress, so finished episodes aren't fetched every day
      const known = new Set<string>(await ctx.runQuery(internal.learningSync.knownSpotify, {}));
      const sp = await spotifySources(token, day, known, fetcher);
      sources.push(...sp);
      report.spotify = `${sp.filter((s) => s.status === "finished").length} finished, ${sp.filter((s) => s.status === "in_progress").length} in progress`;
    }
  } catch (e: any) {
    report.spotify = `failed: ${e?.message || e}`;
  }

  const res = sources.length ? await ctx.runMutation(internal.learning.upsertSources, { sources }) : { created: 0, changed: 0, newlyFinished: [] };
  Object.assign(report, res);
  await ctx.runMutation(internal.learning.setState, { key: "lastSync", value: { ...report, at: new Date().toISOString() } });
  return report;
}

export const run = internalAction({ args: {}, handler: (ctx) => runSync(ctx) });

// Spotify items that no longer need checking: finished, captured or logged
export const knownSpotify = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("learningSources").withIndex("by_user_status", (q) => q.eq("userId", DEFAULT_USER)).collect();
    return rows.filter((s) => s.origin === "spotify" && s.status !== "in_progress" && s.externalId).map((s) => s.externalId as string);
  },
});
