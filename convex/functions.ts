import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_USER, syncReminderSettings } from "./lib/reminders";
import { requireAppKey } from "./lib/auth";

export const getUpdatedAt = query({
  args: { appKey: v.optional(v.string()) },
  handler: async (ctx, { appKey }) => {
    requireAppKey(appKey);
    const row = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    return row ? row.updatedAt : null;
  },
});

export const getData = query({
  args: { appKey: v.optional(v.string()) },
  handler: async (ctx, { appKey }) => {
    requireAppKey(appKey);
    const row = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    // Parse from JSON string back to object
    if (!row) return null;
    // Handle both old object format and new string format
    return typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  },
});

export const setData = mutation({
  args: { payload: v.string(), appKey: v.optional(v.string()) }, // expects JSON string
  handler: async (ctx, { appKey, ...args }) => {
    requireAppKey(appKey);
    const existing = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    const updatedAt = new Date().toISOString();
    await syncReminderSettings(ctx, args.payload);
    if (existing) {
      await ctx.db.patch(existing._id, { payload: args.payload, updatedAt });
      return existing._id;
    }
    return await ctx.db.insert("userData", {
      userId: DEFAULT_USER,
      payload: args.payload,
      updatedAt,
    });
  },
});
