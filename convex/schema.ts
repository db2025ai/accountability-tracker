import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Single document stores the entire Life OS data blob.
  // userId is a static key so there's only ever one row per user.
  userData: defineTable({
    userId: v.string(),
    payload: v.any(), // string (JSON) or legacy object
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),

  // Web Push subscriptions, one per device that tapped "Enable reminders".
  pushSubscriptions: defineTable({
    userId: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_endpoint", ["endpoint"])
    .index("by_userId", ["userId"]),

  // Copy of data.settings.reminders, kept in sync by setData so the 15-minute
  // cron can check whether anything is due without reading the whole blob.
  reminderSettings: defineTable({
    userId: v.string(),
    enabled: v.boolean(),
    morning: v.string(), // "HH:MM"
    evening: v.string(), // "HH:MM"
    timezone: v.string(), // IANA, e.g. "America/Chicago"
  }).index("by_userId", ["userId"]),

  // One row per reminder per local day, claimed before sending so nothing goes out twice.
  pushSends: defineTable({
    userId: v.string(),
    date: v.string(), // local YYYY-MM-DD in the reminder timezone
    kind: v.string(), // "morning" | "evening"
    count: v.number(), // unchecked scheduled daily items at send time
    status: v.string(), // "sending" | "sent" | "failed" | "skipped"
    delivered: v.optional(v.number()),
    failed: v.optional(v.number()),
    createdAt: v.string(),
  }).index("by_user_date_kind", ["userId", "date", "kind"]),
});
