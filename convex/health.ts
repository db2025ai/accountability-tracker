// Sleep from the Apple Watch: the iPhone Shortcut posts last night's samples to /ingest/sleep
// (http.ts, its own SHORTCUT_KEY), one row per night lands here, and the app copies it into the
// Health log (pendingSleep / markSleepApplied), like weigh-ins. Claude reads it with get_sleep.
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_USER } from "./lib/reminders";
import { requireAppKey } from "./lib/auth";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// One row per wake-up date; sending the same night again replaces it and the app picks it up again
export const saveSleep = internalMutation({
  args: {
    date: v.string(),
    hours: v.number(),
    bedtime: v.optional(v.string()),
    wake: v.optional(v.string()),
    nightOf: v.optional(v.string()),
    source: v.string(),
  },
  handler: async (ctx, night) => {
    if (!isDate(night.date) || (night.nightOf !== undefined && !isDate(night.nightOf))) throw new Error("date must be YYYY-MM-DD");
    if (!(night.hours > 0 && night.hours <= 24)) throw new Error("hours must be between 0 and 24");
    if ((night.bedtime && !isTime(night.bedtime)) || (night.wake && !isTime(night.wake))) throw new Error("times must be HH:MM (24-hour)");
    const existing = await ctx.db
      .query("sleepLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER).eq("date", night.date))
      .first();
    const row = { userId: DEFAULT_USER, ...night, applied: false, updatedAt: new Date().toISOString() };
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("sleepLogs", row);
    return { replaced: !!existing };
  },
});

// ---- Read by the app ----

export const pendingSleep = query({
  args: { appKey: v.optional(v.string()) },
  handler: async (ctx, { appKey }) => {
    requireAppKey(appKey);
    const rows = await ctx.db
      .query("sleepLogs")
      .withIndex("by_user_applied", (q) => q.eq("userId", DEFAULT_USER).eq("applied", false))
      .collect();
    return rows.map((r) => ({ id: r._id, date: r.date, hours: r.hours, bedtime: r.bedtime ?? null, nightOf: r.nightOf ?? null }));
  },
});

export const markSleepApplied = mutation({
  args: { ids: v.array(v.id("sleepLogs")), appKey: v.optional(v.string()) },
  handler: async (ctx, { ids, appKey }) => {
    requireAppKey(appKey);
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (row && !row.applied) await ctx.db.patch(id, { applied: true });
    }
  },
});

// ---- Called by the Claude connector (http.ts) ----

// Nights between two dates: the watch's rows, plus sleep typed into the app's check-in on other days
export const listSleep = internalQuery({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    if (!isDate(from) || !isDate(to)) throw new Error("Dates must be YYYY-MM-DD");
    const watch = await ctx.db
      .query("sleepLogs")
      .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER).gte("date", from).lte("date", to))
      .collect();
    const byDate = new Map<string, { date: string; hours: number; bedtime: string | null; wake: string | null; source: string }>();
    const row = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    const data = row ? (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) : {};
    for (const e of data?.healthLog || []) {
      if (e?.date >= from && e?.date <= to && typeof e.sleep === "number") {
        byDate.set(e.date, { date: e.date, hours: e.sleep, bedtime: e.bedtime ?? null, wake: null, source: e.sleepSource === "watch" ? "watch" : "check-in" });
      }
    }
    for (const w of watch) byDate.set(w.date, { date: w.date, hours: w.hours, bedtime: w.bedtime ?? null, wake: w.wake ?? null, source: "watch" });
    const nights = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    const avg = nights.length ? Math.round((nights.reduce((n, x) => n + x.hours, 0) / nights.length) * 10) / 10 : null;
    return { from, to, averageHours: avg, nights };
  },
});
