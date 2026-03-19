import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_USER = "default";

export const getData = query({
  handler: async (ctx) => {
    const row = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    return row ? row.payload : null;
  },
});

export const setData = mutation({
  args: { payload: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    const updatedAt = new Date().toISOString();
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
