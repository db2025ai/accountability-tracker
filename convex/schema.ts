import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Weekly goal tracking
  weeks: defineTable({
    startDate: v.string(),
    entries: v.any(), // { goalIndex: { goal: {...}, tracking: [...] } }
  }).index("by_startDate", ["startDate"]),

  // Goal definitions
  goals: defineTable({
    category: v.string(),
    name: v.string(),
    target: v.optional(v.string()),
    order: v.number(),
    active: v.boolean(),
  }).index("by_category", ["category"]),

  // Financial transactions
  transactions: defineTable({
    date: v.string(),
    description: v.string(),
    category: v.string(),
    amount: v.number(),
    type: v.string(), // "income" | "expense"
    account: v.optional(v.string()),
    source: v.string(), // "manual" | "monarch"
  }).index("by_date", ["date"]),

  // Financial accounts
  accounts: defineTable({
    name: v.string(),
    type: v.string(), // "checking" | "savings" | "credit" | "investment" | "loan"
    balance: v.number(),
  }),

  // Budget settings
  budgets: defineTable({
    category: v.string(),
    amount: v.number(),
  }).index("by_category", ["category"]),

  // Daily habits definitions
  habits: defineTable({
    name: v.string(),
    frequency: v.string(), // "daily" | "weekdays" | "weekly"
    category: v.string(),
    order: v.number(),
    active: v.boolean(),
  }),

  // Daily habit completion log
  habitLogs: defineTable({
    date: v.string(),
    habitId: v.id("habits"),
    completed: v.boolean(),
  }).index("by_date", ["date"])
    .index("by_habit_date", ["habitId", "date"]),

  // Health metrics log
  healthLogs: defineTable({
    date: v.string(),
    weight: v.optional(v.number()),
    sleep: v.optional(v.number()),
    energy: v.optional(v.number()),
  }).index("by_date", ["date"]),

  // Journal entries (includes stoic evening reflections)
  journalEntries: defineTable({
    date: v.string(),
    text: v.string(),
    mood: v.optional(v.string()),
    type: v.string(), // "free" | "gratitude" | "reflection" | "goals" | "stoic"
  }).index("by_date", ["date"]),

  // Evening reflections (stoic)
  eveningReflections: defineTable({
    date: v.string(),
    wentWell: v.optional(v.string()),
    fellShort: v.optional(v.string()),
    gratitude: v.optional(v.string()),
    valuesRating: v.optional(v.number()),
    intention: v.optional(v.string()),
  }).index("by_date", ["date"]),

  // Weekly reviews
  weeklyReviews: defineTable({
    weekDate: v.string(),
    wins: v.optional(v.string()),
    improvements: v.optional(v.string()),
    priorities: v.optional(v.array(v.string())),
    rating: v.optional(v.number()),
  }).index("by_weekDate", ["weekDate"]),

  // Activity log
  activityLog: defineTable({
    text: v.string(),
    timestamp: v.string(),
  }).index("by_timestamp", ["timestamp"]),

  // User settings (single row per user)
  settings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
});
