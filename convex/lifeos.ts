// Read-only views of the whole Life OS for the Claude connector (http.ts): goals and habits,
// strikes and scores, the Monday weekly goal, the practice curriculum, skincare nights and the
// journal. Everything is computed from the app's saved data blob (userData) with the app's own
// rules (lib/lifeos.ts). Nothing here writes: the app stays the only writer of the blob.
import { internalQuery, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_USER } from "./lib/reminders";
import * as L from "./lib/lifeos";

const MAX_JOURNAL_DAYS = 31;
const ARCHIVE_TEXT = 2000; // characters of each imported entry

async function loadCtx(ctx: QueryCtx) {
  const row = await ctx.db
    .query("userData")
    .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
    .first();
  let data: any = {};
  if (row) {
    try {
      data = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
    } catch {
      data = {};
    }
  }
  return { c: L.makeCtx(data, new Date()), savedAt: row?.updatedAt };
}

const checkDate = (d: string | undefined, name: string) => {
  if (d !== undefined && !L.isDateKey(d)) throw new Error(`${name} must be YYYY-MM-DD`);
};

export const goals = internalQuery({
  args: {},
  handler: async (ctx) => L.listGoals((await loadCtx(ctx)).c),
});

export const today = internalQuery({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    checkDate(date, "date");
    const { c, savedAt } = await loadCtx(ctx);
    return { ...L.today(c, date), lastSavedFromApp: savedAt };
  },
});

export const week = internalQuery({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, { date }) => {
    checkDate(date, "date");
    const { c, savedAt } = await loadCtx(ctx);
    return { ...L.weekDetail(c, date), lastSavedFromApp: savedAt };
  },
});

export const trends = internalQuery({
  args: { weeks: v.optional(v.number()) },
  handler: async (ctx, { weeks }) => L.trends((await loadCtx(ctx)).c, weeks ?? 8),
});

export const practice = internalQuery({
  args: { date: v.optional(v.string()), outline: v.optional(v.boolean()) },
  handler: async (ctx, { date, outline }) => {
    checkDate(date, "date");
    return L.practice((await loadCtx(ctx)).c, date, outline);
  },
});

export const journal = internalQuery({
  args: { from: v.string(), to: v.string(), includeImported: v.optional(v.boolean()) },
  handler: async (ctx, { from, to, includeImported }) => {
    checkDate(from, "from");
    checkDate(to, "to");
    if (from > to) throw new Error("from is after to");
    if (L.addDays(from, MAX_JOURNAL_DAYS - 1) < to) throw new Error(`ask for ${MAX_JOURNAL_DAYS} days or fewer at a time`);
    const { c } = await loadCtx(ctx);
    const out: any = L.journal(c, from, to);
    if (includeImported) {
      const rows = await ctx.db
        .query("journalArchive")
        .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER).gte("date", from).lte("date", to))
        .collect();
      out.importedEntries = rows.map((r) => ({
        date: r.date,
        source: r.source,
        text: r.text.length > ARCHIVE_TEXT ? `${r.text.slice(0, ARCHIVE_TEXT)}…` : r.text,
      }));
    }
    return out;
  },
});
