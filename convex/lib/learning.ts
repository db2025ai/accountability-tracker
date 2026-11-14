// Pure helpers for the learning ledger (learning.ts) and its daily sync (learningSync.ts):
// spaced-repetition scheduling, title matching, the Goodreads shelf feed and Spotify progress.

export const TZ = "America/New_York";
export const KINDS = ["book", "audiobook", "podcast", "newsletter", "article", "video", "course", "other"];
// in_progress: started | finished: done, waiting to be captured | captured: ideas saved |
// logged: kept for the record only (fiction, memoir, or skipped) | backlog: finished long ago, not queued
export const STATUSES = ["in_progress", "finished", "captured", "logged", "backlog"];
export const MODES = ["quiz", "socratic", "synthesis"];

// Days until the next review for each box. A new idea starts in box 0 and comes back in 3 days.
// Score 2 moves it up a box, 1 keeps it where it is, 0 sends it back to box 0.
export const INTERVALS = [3, 7, 21, 60, 150, 365];

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function nextReview(box: number, score: number, today: string) {
  const next = score >= 2 ? Math.min(box + 1, INTERVALS.length - 1) : score <= 0 ? 0 : box;
  return { box: next, dueDate: addDays(today, score <= 0 ? 1 : INTERVALS[next]) };
}

// Matches the same book across Goodreads, Spotify and a manual entry: lower case, no subtitle, no punctuation
export function titleKey(title: string) {
  return title
    .toLowerCase()
    .replace(/\s*[:(\[].*$/, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ---- Goodreads: the public shelf feed (https://www.goodreads.com/review/list_rss/<id>?shelf=read) ----
export type ShelfBook = { bookId: string; title: string; author: string; url: string; readAt?: string; addedAt?: string };

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

// "Sat, 14 Nov 2026 00:00:00 -0800" -> "2026-11-14" (the date as written, no timezone shift)
export function rssDate(s: string | undefined) {
  const m = /(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})/.exec(s || "");
  if (!m || !MONTHS[m[2]]) return undefined;
  return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`;
}

const decode = (s: string) =>
  s
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();

export function parseShelf(xml: string): ShelfBook[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const tag = (item: string, name: string) => {
    const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(item);
    return m ? decode(m[1]) : "";
  };
  return items
    .map((item) => ({
      bookId: tag(item, "book_id"),
      title: tag(item, "title"),
      author: tag(item, "author_name"),
      url: tag(item, "link"),
      readAt: rssDate(tag(item, "user_read_at")),
      addedAt: rssDate(tag(item, "user_date_added")),
    }))
    .filter((b) => b.bookId && b.title);
}

// ---- Spotify: an episode or audiobook chapter with the user's resume point ----
// Counts as finished when fully played or 75% through; started after 5 minutes.
export const FINISHED_SHARE = 0.75;
export function playState(item: { duration_ms?: number; resume_point?: { fully_played?: boolean; resume_position_ms?: number } }) {
  const duration = item.duration_ms || 0;
  const pos = item.resume_point?.resume_position_ms || 0;
  const progress = item.resume_point?.fully_played ? 1 : duration ? Math.min(pos / duration, 1) : 0;
  const state = progress >= FINISHED_SHARE ? "finished" : pos >= 5 * 60e3 ? "in_progress" : "none";
  return { state, progress: Math.round(progress * 100) / 100 };
}
