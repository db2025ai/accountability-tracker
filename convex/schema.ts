import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const mealItem = v.object({
  name: v.string(),
  qty: v.optional(v.string()),
  calories: v.number(),
  protein: v.number(),
  carbs: v.number(),
  fat: v.number(),
});

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

  // Read-only archive of entries imported from another journal app. Kept out of the
  // userData blob, which has to stay under Convex's 1 MB document limit.
  journalArchive: defineTable({
    userId: v.string(),
    date: v.string(), // local YYYY-MM-DD
    text: v.string(),
    source: v.string(), // e.g. "Journal app"
    key: v.string(), // date + text hash, so re-importing the same file adds nothing
    importedAt: v.string(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_key", ["userId", "key"]),

  // ---- Nutrition (written by Claude through the /mcp connector; see nutrition.ts) ----
  // One row per logged meal. Kept out of the userData blob for the same size reason as
  // journalArchive.
  meals: defineTable({
    userId: v.string(),
    date: v.string(), // local YYYY-MM-DD
    time: v.optional(v.string()), // "7:45 AM"
    label: v.string(), // Breakfast | Lunch | Pre-lift | Dinner | Snack
    name: v.string(),
    items: v.array(mealItem),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    source: v.optional(v.string()), // photo | voice | text | saved
    confidence: v.optional(v.string()), // high | medium | low
    createdAt: v.string(),
  }).index("by_user_date", ["userId", "date"]),

  // Meals Claude can log by name ("had my smoothie")
  savedMeals: defineTable({
    userId: v.string(),
    key: v.string(), // slug of the name
    name: v.string(),
    items: v.array(mealItem),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    updatedAt: v.string(),
  }).index("by_user_key", ["userId", "key"]),

  // Daily targets (one row)
  nutritionSettings: defineTable({
    userId: v.string(),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),

  // Weigh-ins sent from Claude. The app copies them into data.healthLog on load and marks
  // them applied, so the server never rewrites the userData blob the app also saves.
  weighIns: defineTable({
    userId: v.string(),
    date: v.string(), // local YYYY-MM-DD
    lb: v.number(),
    createdAt: v.string(),
    applied: v.boolean(),
  }).index("by_user_applied", ["userId", "applied"]),
});
