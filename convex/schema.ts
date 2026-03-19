import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Single document stores the entire Life OS data blob.
  // userId is a static key so there's only ever one row per user.
  userData: defineTable({
    userId: v.string(),
    payload: v.string(), // JSON-stringified to avoid Convex's 1024-field object limit
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),
});
