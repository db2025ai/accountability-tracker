// Learning ledger: what Daniel finished (sources), the key ideas he captured from each (ideas),
// and every quiz answer (reviews), with spaced-repetition scheduling. Claude writes it through the
// connector (http.ts); the daily sync (learningSync.ts) adds books from Goodreads and podcasts and
// audiobooks from Spotify. The app only reads it (getSummary) for the Learning card.
import { query, internalQuery, internalMutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { DEFAULT_USER, localParts } from "./lib/reminders";
import { requireAppKey } from "./lib/auth";
import { KINDS, STATUSES, MODES, TZ, addDays, nextReview, titleKey, isDate } from "./lib/learning";

const now = () => new Date().toISOString();
export const today = () => localParts(new Date(), TZ).dateKey;

function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const sourceOut = (s: Doc<"learningSources">) => ({
  id: s._id,
  kind: s.kind,
  title: s.title,
  author: s.author ?? null,
  url: s.url ?? null,
  origin: s.origin,
  status: s.status,
  progress: s.progress ?? null,
  startedAt: s.startedAt ?? null,
  finishedAt: s.finishedAt ?? null,
  developmental: s.developmental ?? null,
  readerDocId: s.readerDocId ?? null,
  notes: s.notes ?? null,
});

async function findSource(ctx: QueryCtx, externalId: string | undefined, key: string, kinds: string[]) {
  if (externalId) {
    const byId = await ctx.db
      .query("learningSources")
      .withIndex("by_user_external", (q) => q.eq("userId", DEFAULT_USER).eq("externalId", externalId))
      .first();
    if (byId) return byId;
  }
  // The same book from another place (Goodreads vs a Spotify audiobook vs chat)
  if (!key || !kinds.some((k) => k === "book" || k === "audiobook")) return null;
  const same = await ctx.db
    .query("learningSources")
    .withIndex("by_user_titleKey", (q) => q.eq("userId", DEFAULT_USER).eq("titleKey", key))
    .collect();
  return same.find((s) => s.kind === "book" || s.kind === "audiobook") ?? null;
}

// Status only moves forward (in_progress -> finished -> captured/logged), so a sync never undoes
// what Claude and Daniel already did. backlog can be queued (-> finished) or logged.
const RANK: Record<string, number> = { in_progress: 0, backlog: 1, finished: 2, captured: 3, logged: 3 };

export type SourceInput = {
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
  developmental?: boolean;
  readerDocId?: string;
  notes?: string;
};

export async function upsertSource(ctx: MutationCtx, s: SourceInput) {
  check(KINDS.includes(s.kind), `kind must be one of ${KINDS.join(", ")}`);
  check(STATUSES.includes(s.status), `status must be one of ${STATUSES.join(", ")}`);
  check(s.title.trim(), "title is required");
  for (const d of [s.startedAt, s.finishedAt]) check(d === undefined || isDate(d), "dates must be YYYY-MM-DD");
  const key = titleKey(s.title);
  const existing = await findSource(ctx, s.externalId, key, [s.kind]);
  if (!existing) {
    const id = await ctx.db.insert("learningSources", {
      userId: DEFAULT_USER,
      ...s,
      title: s.title.trim(),
      titleKey: key,
      ...(s.status === "finished" && !s.finishedAt ? { finishedAt: today() } : {}),
      createdAt: now(),
      updatedAt: now(),
    });
    return { id, created: true, status: s.status };
  }
  const patch: Partial<Doc<"learningSources">> = { updatedAt: now() };
  if ((RANK[s.status] ?? 0) > (RANK[existing.status] ?? 0)) patch.status = s.status;
  if (s.progress !== undefined && s.progress > (existing.progress ?? 0)) patch.progress = s.progress;
  for (const k of ["author", "url", "startedAt", "readerDocId", "notes", "developmental"] as const) {
    if (s[k] !== undefined && existing[k] === undefined) (patch as any)[k] = s[k];
  }
  if (!existing.externalId && s.externalId) patch.externalId = s.externalId;
  const finishing = (patch.status ?? existing.status) !== "in_progress";
  if (finishing && !existing.finishedAt) patch.finishedAt = s.finishedAt ?? today();
  await ctx.db.patch(existing._id, patch);
  return { id: existing._id, created: false, status: patch.status ?? existing.status };
}

// ---- Written by Claude (connector) and the sync ----

const sourceArgs = {
  kind: v.string(),
  title: v.string(),
  author: v.optional(v.string()),
  url: v.optional(v.string()),
  origin: v.optional(v.string()),
  externalId: v.optional(v.string()),
  status: v.optional(v.string()),
  progress: v.optional(v.number()),
  startedAt: v.optional(v.string()),
  finishedAt: v.optional(v.string()),
  developmental: v.optional(v.boolean()),
  readerDocId: v.optional(v.string()),
  notes: v.optional(v.string()),
};

export const logSource = internalMutation({
  args: sourceArgs,
  handler: async (ctx, a) => upsertSource(ctx, { ...a, origin: a.origin ?? "manual", status: a.status ?? "finished" }),
});

// Many at once, for the sync
export const upsertSources = internalMutation({
  args: { sources: v.array(v.object({ ...sourceArgs, origin: v.string(), status: v.string() })) },
  handler: async (ctx, { sources }) => {
    let created = 0, changed = 0;
    const newlyFinished: string[] = [];
    for (const s of sources) {
      const before = s.externalId ? await findSource(ctx, s.externalId, "", []) : null;
      const r = await upsertSource(ctx, s);
      if (r.created) created++;
      else if (before && before.status !== r.status) changed++;
      if (r.status === "finished" && (r.created || before?.status === "in_progress")) newlyFinished.push(s.title);
    }
    return { created, changed, newlyFinished };
  },
});

export const updateSource = internalMutation({
  args: {
    id: v.string(),
    status: v.optional(v.string()),
    kind: v.optional(v.string()),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    url: v.optional(v.string()),
    finishedAt: v.optional(v.string()),
    developmental: v.optional(v.boolean()),
    readerDocId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...a }) => {
    const sid = ctx.db.normalizeId("learningSources", id);
    const s = sid && (await ctx.db.get(sid));
    check(s && s.userId === DEFAULT_USER, `No source with id ${id}`);
    check(a.status === undefined || STATUSES.includes(a.status), `status must be one of ${STATUSES.join(", ")}`);
    check(a.kind === undefined || KINDS.includes(a.kind), `kind must be one of ${KINDS.join(", ")}`);
    check(a.finishedAt === undefined || isDate(a.finishedAt), "finishedAt must be YYYY-MM-DD");
    const patch: Record<string, unknown> = { ...a, updatedAt: now() };
    if (a.title) patch.titleKey = titleKey(a.title);
    if (a.status && a.status !== "in_progress" && !s.finishedAt && !a.finishedAt) patch.finishedAt = today();
    await ctx.db.patch(s._id, patch);
    return sourceOut({ ...s, ...patch } as Doc<"learningSources">);
  },
});

export const listSources = internalQuery({
  args: { kind: v.optional(v.string()), status: v.optional(v.string()), from: v.optional(v.string()), to: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, a) => {
    let rows = a.status
      ? await ctx.db.query("learningSources").withIndex("by_user_status", (q) => q.eq("userId", DEFAULT_USER).eq("status", a.status!)).collect()
      : await ctx.db.query("learningSources").withIndex("by_user_status", (q) => q.eq("userId", DEFAULT_USER)).collect();
    if (a.kind) rows = rows.filter((s) => s.kind === a.kind);
    if (a.from) rows = rows.filter((s) => (s.finishedAt ?? s.startedAt ?? "") >= a.from!);
    if (a.to) rows = rows.filter((s) => (s.finishedAt ?? s.startedAt ?? "9999") <= a.to!);
    rows.sort((x, y) => (y.finishedAt ?? y.updatedAt).localeCompare(x.finishedAt ?? x.updatedAt));
    const ideas = await ctx.db.query("learningIdeas").withIndex("by_user_due", (q) => q.eq("userId", DEFAULT_USER)).collect();
    const count = new Map<string, number>();
    for (const i of ideas) count.set(i.sourceId, (count.get(i.sourceId) ?? 0) + 1);
    return rows.slice(0, Math.min(a.limit ?? 50, 200)).map((s) => ({ ...sourceOut(s), ideas: count.get(s._id) ?? 0 }));
  },
});

// What's waiting: finished but not captured, still in progress, and how many ideas are due
export const inbox = internalQuery({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    const day = date ?? today();
    const byStatus = (status: string) =>
      ctx.db.query("learningSources").withIndex("by_user_status", (q) => q.eq("userId", DEFAULT_USER).eq("status", status)).collect();
    const finished = (await byStatus("finished")).sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
    const inProgress = (await byStatus("in_progress")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const backlog = await byStatus("backlog");
    const due = await ctx.db
      .query("learningIdeas")
      .withIndex("by_user_due", (q) => q.eq("userId", DEFAULT_USER).lte("dueDate", day))
      .collect();
    return {
      date: day,
      toCapture: finished.map(sourceOut),
      inProgress: inProgress.slice(0, 15).map(sourceOut),
      backlogCount: backlog.length,
      dueReviews: due.length,
    };
  },
});

export const saveIdeas = internalMutation({
  args: {
    sourceId: v.string(),
    ideas: v.array(v.object({ idea: v.string(), takeaway: v.optional(v.string()), topics: v.optional(v.array(v.string())) })),
    date: v.optional(v.string()),
    markCaptured: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    const sid = ctx.db.normalizeId("learningSources", a.sourceId);
    const s = sid && (await ctx.db.get(sid));
    check(s && s.userId === DEFAULT_USER, `No source with id ${a.sourceId}`);
    check(a.ideas.length > 0, "ideas is empty");
    check(a.date === undefined || isDate(a.date), "date must be YYYY-MM-DD");
    const day = a.date ?? today();
    const ids: Id<"learningIdeas">[] = [];
    for (const i of a.ideas) {
      check(i.idea.trim(), "each idea needs text");
      ids.push(
        await ctx.db.insert("learningIdeas", {
          userId: DEFAULT_USER,
          sourceId: s._id,
          idea: i.idea.trim(),
          ...(i.takeaway?.trim() ? { takeaway: i.takeaway.trim() } : {}),
          topics: (i.topics ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
          box: 0,
          dueDate: addDays(day, 3),
          reviews: 0,
          correct: 0,
          createdDate: day,
          createdAt: now(),
        }),
      );
    }
    if (a.markCaptured !== false) {
      await ctx.db.patch(s._id, { status: "captured", updatedAt: now(), ...(s.finishedAt ? {} : { finishedAt: day }) });
    }
    return { ids, firstReview: addDays(day, 3) };
  },
});

export const updateIdea = internalMutation({
  args: { id: v.string(), idea: v.optional(v.string()), takeaway: v.optional(v.string()), topics: v.optional(v.array(v.string())), applied: v.optional(v.string()), date: v.optional(v.string()) },
  handler: async (ctx, { id, date, ...a }) => {
    const iid = ctx.db.normalizeId("learningIdeas", id);
    const idea = iid && (await ctx.db.get(iid));
    check(idea && idea.userId === DEFAULT_USER, `No idea with id ${id}`);
    const patch: Record<string, unknown> = {};
    if (a.idea !== undefined) patch.idea = a.idea.trim();
    if (a.takeaway !== undefined) patch.takeaway = a.takeaway.trim();
    if (a.topics !== undefined) patch.topics = a.topics.map((t) => t.toLowerCase().trim()).filter(Boolean);
    if (a.applied !== undefined) {
      patch.applied = a.applied.trim();
      patch.appliedAt = date ?? today();
    }
    await ctx.db.patch(idea._id, patch);
    return { id, ...patch };
  },
});

export const deleteIdea = internalMutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const iid = ctx.db.normalizeId("learningIdeas", id);
    const idea = iid && (await ctx.db.get(iid));
    check(idea && idea.userId === DEFAULT_USER, `No idea with id ${id}`);
    for (const r of await ctx.db.query("learningReviews").withIndex("by_idea", (q) => q.eq("ideaId", idea._id)).collect()) await ctx.db.delete(r._id);
    await ctx.db.delete(idea._id);
    return { deleted: id };
  },
});

// Ideas due on or before the date, oldest due first, with their source. Fills up with ideas due soon
// when asked (a short week should still make a full quiz).
export const dueReviews = internalQuery({
  args: { date: v.optional(v.string()), limit: v.optional(v.number()), fillWithSoon: v.optional(v.boolean()), topic: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const day = a.date ?? today();
    const limit = Math.min(a.limit ?? 10, 50);
    let rows = await ctx.db.query("learningIdeas").withIndex("by_user_due", (q) => q.eq("userId", DEFAULT_USER)).collect();
    if (a.topic) rows = rows.filter((i) => i.topics.includes(a.topic!.toLowerCase()));
    const due = rows.filter((i) => i.dueDate <= day);
    const soon = a.fillWithSoon ? rows.filter((i) => i.dueDate > day).slice(0, Math.max(0, limit - due.length)) : [];
    const pick = [...due.slice(0, limit), ...soon];
    const sources = new Map<string, Doc<"learningSources"> | null>();
    for (const i of pick) if (!sources.has(i.sourceId)) sources.set(i.sourceId, await ctx.db.get(i.sourceId));
    return {
      date: day,
      dueCount: due.length,
      ideas: pick.map((i) => {
        const s = sources.get(i.sourceId);
        return {
          id: i._id,
          idea: i.idea,
          takeaway: i.takeaway ?? null,
          topics: i.topics,
          box: i.box,
          dueDate: i.dueDate,
          overdue: i.dueDate < day,
          reviews: i.reviews,
          correct: i.correct,
          lastReviewed: i.lastReviewed ?? null,
          applied: i.applied ?? null,
          source: s ? { id: s._id, title: s.title, author: s.author ?? null, kind: s.kind, readerDocId: s.readerDocId ?? null } : null,
        };
      }),
    };
  },
});

export const recordReview = internalMutation({
  args: { ideaId: v.string(), score: v.number(), question: v.string(), mode: v.optional(v.string()), note: v.optional(v.string()), date: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const iid = ctx.db.normalizeId("learningIdeas", a.ideaId);
    const idea = iid && (await ctx.db.get(iid));
    check(idea && idea.userId === DEFAULT_USER, `No idea with id ${a.ideaId}`);
    check([0, 1, 2].includes(a.score), "score must be 0 (missed), 1 (partial) or 2 (solid)");
    const mode = a.mode ?? "quiz";
    check(MODES.includes(mode), `mode must be one of ${MODES.join(", ")}`);
    check(a.date === undefined || isDate(a.date), "date must be YYYY-MM-DD");
    const day = a.date ?? today();
    const next = nextReview(idea.box, a.score, day);
    await ctx.db.insert("learningReviews", {
      userId: DEFAULT_USER,
      ideaId: idea._id,
      date: day,
      question: a.question.trim(),
      score: a.score,
      mode,
      ...(a.note?.trim() ? { note: a.note.trim() } : {}),
      createdAt: now(),
    });
    await ctx.db.patch(idea._id, {
      ...next,
      reviews: idea.reviews + 1,
      correct: idea.correct + (a.score === 2 ? 1 : 0),
      lastReviewed: day,
    });
    return { ideaId: idea._id, score: a.score, box: next.box, nextReview: next.dueDate };
  },
});

// ---- Stats (connector and app) ----

const pct = (scores: number[]) => (scores.length ? Math.round((scores.reduce((n, s) => n + s, 0) / (2 * scores.length)) * 100) : null);

async function buildStats(ctx: QueryCtx, day: string, days: number) {
  const from = addDays(day, -(days - 1));
  const sources = await ctx.db
    .query("learningSources")
    .withIndex("by_user_finished", (q) => q.eq("userId", DEFAULT_USER).gte("finishedAt", from).lte("finishedAt", day))
    .collect();
  const ideas = await ctx.db.query("learningIdeas").withIndex("by_user_due", (q) => q.eq("userId", DEFAULT_USER)).collect();
  const reviews = await ctx.db
    .query("learningReviews")
    .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER).gte("date", addDays(day, -55)).lte("date", day))
    .collect();
  const inWindow = reviews.filter((r) => r.date >= from);
  const byKind: Record<string, number> = {};
  for (const s of sources) if (s.status !== "logged") byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  // Retention by week (Sunday to Saturday), the last 8 weeks, oldest first
  const [y, m, d] = day.split("-").map(Number);
  const weekStart = addDays(day, -new Date(Date.UTC(y, m - 1, d)).getUTCDay());
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(weekStart, -7 * (7 - i));
    const end = addDays(start, 6);
    const scores = reviews.filter((r) => r.date >= start && r.date <= end).map((r) => r.score);
    return { week: start, reviews: scores.length, retention: pct(scores) };
  });
  // Mastery by topic: how far its ideas have climbed the boxes (0-100)
  const topics: Record<string, { ideas: number; boxSum: number }> = {};
  for (const i of ideas) for (const t of i.topics) {
    topics[t] = topics[t] ?? { ideas: 0, boxSum: 0 };
    topics[t].ideas++;
    topics[t].boxSum += i.box;
  }
  return {
    from,
    to: day,
    finished: sources.filter((s) => s.status !== "logged").length,
    finishedByKind: byKind,
    ideasCaptured: ideas.filter((i) => i.createdDate >= from && i.createdDate <= day).length,
    totalIdeas: ideas.length,
    reviews: inWindow.length,
    retention: pct(inWindow.map((r) => r.score)),
    weeks,
    dueNow: ideas.filter((i) => i.dueDate <= day).length,
    applied: ideas.filter((i) => i.appliedAt && i.appliedAt >= from && i.appliedAt <= day).length,
    topics: Object.entries(topics)
      .map(([topic, t]) => ({ topic, ideas: t.ideas, mastery: Math.round((t.boxSum / t.ideas / (5)) * 100) }))
      .sort((a, b) => b.ideas - a.ideas)
      .slice(0, 12),
    ideaDays: [...new Set(ideas.filter((i) => i.createdDate >= addDays(day, -13)).map((i) => i.createdDate))].sort(),
    quizDays: Object.entries(
      reviews.filter((r) => r.date >= addDays(day, -13) && r.mode !== "synthesis").reduce<Record<string, number>>((m, r) => ((m[r.date] = (m[r.date] ?? 0) + 1), m), {}),
    )
      .filter(([, n]) => n >= 3)
      .map(([d]) => d)
      .sort(),
  };
}

export const stats = internalQuery({
  args: { date: v.optional(v.string()), days: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const s = await buildStats(ctx, a.date ?? today(), Math.min(Math.max(a.days ?? 30, 1), 365));
    const spotify = await ctx.db.query("learningSyncState").withIndex("by_user_key", (q) => q.eq("userId", DEFAULT_USER).eq("key", "spotify")).first();
    const last = await ctx.db.query("learningSyncState").withIndex("by_user_key", (q) => q.eq("userId", DEFAULT_USER).eq("key", "lastSync")).first();
    return { ...s, spotifyConnected: !!spotify?.value?.refreshToken, lastSync: last?.value ?? null };
  },
});

// ---- Read by the app: the Learning card on the Today tab ----
export const getSummary = query({
  args: { today: v.string(), appKey: v.optional(v.string()) },
  handler: async (ctx, { today: day, appKey }) => {
    requireAppKey(appKey);
    check(isDate(day), "today must be YYYY-MM-DD");
    const [y, m, d] = day.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const week = await buildStats(ctx, day, dow + 1); // this week, Sunday to today
    const month = await buildStats(ctx, day, 30);
    const thisWeek = await ctx.db
      .query("learningSources")
      .withIndex("by_user_finished", (q) => q.eq("userId", DEFAULT_USER).gte("finishedAt", week.from).lte("finishedAt", day))
      .collect();
    const waiting = await ctx.db.query("learningSources").withIndex("by_user_status", (q) => q.eq("userId", DEFAULT_USER).eq("status", "finished")).collect();
    const reading = await ctx.db.query("learningSources").withIndex("by_user_status", (q) => q.eq("userId", DEFAULT_USER).eq("status", "in_progress")).collect();
    const spotify = await ctx.db.query("learningSyncState").withIndex("by_user_key", (q) => q.eq("userId", DEFAULT_USER).eq("key", "spotify")).first();
    const brief = (s: Doc<"learningSources">) => ({ kind: s.kind, title: s.title, author: s.author ?? null, progress: s.progress ?? null });
    return {
      week: {
        finished: week.finished,
        finishedByKind: week.finishedByKind,
        ideas: week.ideasCaptured,
        reviews: week.reviews,
        titles: thisWeek.filter((s) => s.status !== "logged").map(brief).slice(0, 6),
      },
      month: { retention: month.retention, reviews: month.reviews, applied: month.applied, ideas: month.ideasCaptured },
      weeks: month.weeks,
      dueNow: month.dueNow,
      totalIdeas: month.totalIdeas,
      topics: month.topics.slice(0, 6),
      toCapture: waiting.sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? "")).map(brief).slice(0, 5),
      toCaptureCount: waiting.length,
      inProgress: reading.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(brief).slice(0, 4),
      ideaDays: month.ideaDays,
      quizDays: month.quizDays,
      spotifyConnected: !!spotify?.value?.refreshToken,
    };
  },
});

// ---- Sync state (learningSync.ts) ----
export const getState = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) =>
    (await ctx.db.query("learningSyncState").withIndex("by_user_key", (q) => q.eq("userId", DEFAULT_USER).eq("key", key)).first())?.value ?? null,
});

export const setState = internalMutation({
  args: { key: v.string(), value: v.any() },
  handler: async (ctx, { key, value }) => {
    const row = await ctx.db.query("learningSyncState").withIndex("by_user_key", (q) => q.eq("userId", DEFAULT_USER).eq("key", key)).first();
    if (row) await ctx.db.patch(row._id, { value, updatedAt: now() });
    else await ctx.db.insert("learningSyncState", { userId: DEFAULT_USER, key, value, updatedAt: now() });
  },
});
