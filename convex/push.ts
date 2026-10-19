import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_USER } from "./lib/reminders";
import { requireAppKey } from "./lib/auth";

// Public key the browser needs for pushManager.subscribe (the private key never leaves Convex)
export const getVapidPublicKey = query({
  args: { appKey: v.optional(v.string()) },
  handler: async (_ctx, { appKey }) => {
    requireAppKey(appKey);
    return process.env.VAPID_PUBLIC_KEY ?? null;
  },
});

export const saveSubscription = mutation({
  args: {
    subscription: v.object({
      endpoint: v.string(),
      keys: v.object({ p256dh: v.string(), auth: v.string() }),
    }),
    userAgent: v.optional(v.string()),
    appKey: v.optional(v.string()),
  },
  handler: async (ctx, { subscription, userAgent, appKey }) => {
    requireAppKey(appKey);
    const fields = {
      userId: DEFAULT_USER,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    };
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", subscription.endpoint))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("pushSubscriptions", { ...fields, createdAt: new Date().toISOString() });
  },
});

export const removeSubscription = mutation({
  args: { endpoint: v.string(), appKey: v.optional(v.string()) },
  handler: async (ctx, { endpoint, appKey }) => {
    requireAppKey(appKey);
    const rows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

// ---- Internal: used by the reminder cron in pushNode.ts ----

export const getReminderState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("reminderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .collect();
    return {
      settings: settings
        ? { enabled: settings.enabled, morning: settings.morning, evening: settings.evening, timezone: settings.timezone }
        : null,
      subscriptions: subscriptions.map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
    };
  },
});

// Reminder kinds already recorded for a local date
export const getSentKinds = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const rows = await ctx.db
      .query("pushSends")
      .withIndex("by_user_date_kind", (q) => q.eq("userId", DEFAULT_USER).eq("date", date))
      .collect();
    return rows.map((r) => r.kind);
  },
});

// The full data blob — only read when a reminder is actually due
export const getPayload = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    if (!row) return null;
    return typeof row.payload === "string" ? row.payload : JSON.stringify(row.payload);
  },
});

// Record a reminder before sending it. Returns false if this date+kind was already claimed,
// so overlapping cron runs can never send the same reminder twice.
export const claimSend = internalMutation({
  args: { date: v.string(), kind: v.string(), count: v.number(), status: v.string() },
  handler: async (ctx, { date, kind, count, status }) => {
    const existing = await ctx.db
      .query("pushSends")
      .withIndex("by_user_date_kind", (q) => q.eq("userId", DEFAULT_USER).eq("date", date).eq("kind", kind))
      .first();
    if (existing) return false;
    await ctx.db.insert("pushSends", {
      userId: DEFAULT_USER,
      date,
      kind,
      count,
      status,
      createdAt: new Date().toISOString(),
    });
    return true;
  },
});

export const finishSend = internalMutation({
  args: {
    date: v.string(),
    kind: v.string(),
    status: v.string(),
    delivered: v.number(),
    failed: v.number(),
    gone: v.array(v.string()),
  },
  handler: async (ctx, { date, kind, status, delivered, failed, gone }) => {
    const row = await ctx.db
      .query("pushSends")
      .withIndex("by_user_date_kind", (q) => q.eq("userId", DEFAULT_USER).eq("date", date).eq("kind", kind))
      .first();
    if (row) await ctx.db.patch(row._id, { status, delivered, failed });
    await dropEndpoints(ctx, gone);
  },
});

export const dropSubscriptions = internalMutation({
  args: { endpoints: v.array(v.string()) },
  handler: async (ctx, { endpoints }) => dropEndpoints(ctx, endpoints),
});

// Subscriptions the push service reported as gone (404/410)
async function dropEndpoints(ctx: MutationCtx, endpoints: string[]) {
  for (const endpoint of endpoints) {
    const rows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
}
