import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_USER } from "./lib/reminders";
import { requireAppKey } from "./lib/auth";

// FNV-1a — a short, stable fingerprint of an entry's text
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// Add imported entries, skipping any already in the archive. The app sends small batches.
export const importEntries = mutation({
  args: {
    entries: v.array(v.object({ date: v.string(), text: v.string() })),
    source: v.string(),
    appKey: v.optional(v.string()),
  },
  handler: async (ctx, { entries, source, appKey }) => {
    requireAppKey(appKey);
    let added = 0;
    let skipped = 0;
    const importedAt = new Date().toISOString();
    for (const { date, text } of entries) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !text.trim()) {
        skipped++;
        continue;
      }
      const key = `${date}:${hash(text.trim())}`;
      const existing = await ctx.db
        .query("journalArchive")
        .withIndex("by_user_key", (q) => q.eq("userId", DEFAULT_USER).eq("key", key))
        .first();
      if (existing) {
        skipped++;
        continue;
      }
      await ctx.db.insert("journalArchive", { userId: DEFAULT_USER, date, text: text.trim(), source, key, importedAt });
      added++;
    }
    return { added, skipped };
  },
});

// Newest first
export const listArchive = query({
  args: { appKey: v.optional(v.string()) },
  handler: async (ctx, { appKey }) => {
    requireAppKey(appKey);
    const rows = await ctx.db
      .query("journalArchive")
      .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER))
      .order("desc")
      .collect();
    return rows.map((r) => ({ date: r.date, text: r.text, source: r.source }));
  },
});

// Remove imported entries in chunks; call until remaining is 0
export const clearArchive = mutation({
  args: { appKey: v.optional(v.string()) },
  handler: async (ctx, { appKey }) => {
    requireAppKey(appKey);
    const rows = await ctx.db
      .query("journalArchive")
      .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER))
      .take(500);
    for (const row of rows) await ctx.db.delete(row._id);
    const more = await ctx.db
      .query("journalArchive")
      .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    return { deleted: rows.length, remaining: more ? 1 : 0 };
  },
});
