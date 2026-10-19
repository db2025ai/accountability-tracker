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

const exercise = v.object({
  name: v.string(),
  lift: v.optional(v.string()), // bench | squat | deadlift | ohp (the key lifts tracked for progress)
  muscles: v.array(v.string()), // chest | back | shoulders | arms | legs | core
  sets: v.array(v.object({ reps: v.number(), weight: v.number() })), // weight in lb, 0 = bodyweight
  note: v.optional(v.string()), // e.g. "Felt discomfort", flagged in workout mode
});

// A set Claude plans: target reps (or a range up to repsMax) at a weight
const plannedExercise = v.object({
  name: v.string(),
  lift: v.optional(v.string()),
  muscles: v.array(v.string()),
  note: v.optional(v.string()), // coaching cue shown in workout mode
  restSec: v.optional(v.number()),
  sets: v.array(v.object({ reps: v.number(), repsMax: v.optional(v.number()), weight: v.number(), warmup: v.optional(v.boolean()) })),
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

  // ---- Workouts (written by Claude through the /mcp connector; see workouts.ts) ----
  // One row per session. Strength sessions list exercises and sets; cardio and swims use
  // minutes and distance.
  workouts: defineTable({
    userId: v.string(),
    date: v.string(), // local YYYY-MM-DD
    time: v.optional(v.string()), // "6:30 AM"
    type: v.string(), // strength | cardio | swim | core | mobility | other
    name: v.string(),
    minutes: v.optional(v.number()),
    exercises: v.array(exercise),
    distance: v.optional(v.number()),
    distanceUnit: v.optional(v.string()), // mi | km | m | yd
    calories: v.optional(v.number()),
    avgHr: v.optional(v.number()),
    source: v.optional(v.string()), // voice | text | photo | watch | app (workout mode)
    externalId: v.optional(v.string()), // e.g. the Apple Watch workout's start, so a resend isn't logged twice
    notes: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_user_date", ["userId", "date"]),

  // ---- Workout mode (see plans.ts) ----
  // Sessions Claude plans; the app runs them and Finish saves a `workouts` row
  workoutPlans: defineTable({
    userId: v.string(),
    date: v.string(), // local YYYY-MM-DD
    name: v.string(),
    note: v.optional(v.string()), // the coach's summary for the day
    exercises: v.array(plannedExercise),
    status: v.string(), // planned | done
    workoutId: v.optional(v.id("workouts")),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_user_date", ["userId", "date"]),

  // Sleep from the Apple Watch Shortcut (see health.ts): one row per wake-up date. The app copies
  // it into data.healthLog and marks it applied, like weighIns.
  sleepLogs: defineTable({
    userId: v.string(),
    date: v.string(), // local YYYY-MM-DD the night ended
    nightOf: v.optional(v.string()), // the evening it began (the "In bed by" goal's day)
    hours: v.number(), // asleep, not in bed
    bedtime: v.optional(v.string()), // "HH:MM" 24-hour, local
    wake: v.optional(v.string()),
    source: v.string(), // watch | manual
    applied: v.boolean(),
    updatedAt: v.string(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user_applied", ["userId", "applied"]),

  // What Claude should remember when planning: injuries, equipment, schedule, goals (one row)
  trainingProfile: defineTable({
    userId: v.string(),
    notes: v.string(),
    daysPerWeek: v.optional(v.number()),
    updatedAt: v.string(),
  }).index("by_userId", ["userId"]),
});
