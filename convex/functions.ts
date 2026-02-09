import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ========================================
// Weeks
// ========================================
export const getWeeks = query({
  handler: async (ctx) => {
    return await ctx.db.query("weeks").order("asc").collect();
  },
});

export const upsertWeek = mutation({
  args: {
    startDate: v.string(),
    entries: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weeks")
      .withIndex("by_startDate", (q) => q.eq("startDate", args.startDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { entries: args.entries });
      return existing._id;
    }
    return await ctx.db.insert("weeks", args);
  },
});

export const updateWeekEntries = mutation({
  args: {
    id: v.id("weeks"),
    entries: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { entries: args.entries });
  },
});

// ========================================
// Goals
// ========================================
export const getGoals = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("goals")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
  },
});

export const addGoal = mutation({
  args: {
    category: v.string(),
    name: v.string(),
    target: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("goals", { ...args, active: true });
  },
});

export const removeGoal = mutation({
  args: { id: v.id("goals") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { active: false });
  },
});

// ========================================
// Transactions
// ========================================
export const getTransactions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = ctx.db.query("transactions").order("desc");
    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
});

export const addTransaction = mutation({
  args: {
    date: v.string(),
    description: v.string(),
    category: v.string(),
    amount: v.number(),
    type: v.string(),
    account: v.optional(v.string()),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transactions", args);
  },
});

export const bulkAddTransactions = mutation({
  args: {
    transactions: v.array(
      v.object({
        date: v.string(),
        description: v.string(),
        category: v.string(),
        amount: v.number(),
        type: v.string(),
        account: v.optional(v.string()),
        source: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const txn of args.transactions) {
      await ctx.db.insert("transactions", txn);
      count++;
    }
    return count;
  },
});

// ========================================
// Accounts
// ========================================
export const getAccounts = query({
  handler: async (ctx) => {
    return await ctx.db.query("accounts").collect();
  },
});

export const addAccount = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    balance: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("accounts", args);
  },
});

// ========================================
// Budgets
// ========================================
export const getBudgets = query({
  handler: async (ctx) => {
    return await ctx.db.query("budgets").collect();
  },
});

export const upsertBudget = mutation({
  args: {
    category: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("budgets")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { amount: args.amount });
      return existing._id;
    }
    return await ctx.db.insert("budgets", args);
  },
});

// ========================================
// Habits
// ========================================
export const getHabits = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("habits")
      .filter((q) => q.eq(q.field("active"), true))
      .collect();
  },
});

export const addHabit = mutation({
  args: {
    name: v.string(),
    frequency: v.string(),
    category: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("habits", { ...args, active: true });
  },
});

export const getHabitLogs = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("habitLogs")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

export const getHabitLogsRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("habitLogs")
      .withIndex("by_date")
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), args.startDate),
          q.lte(q.field("date"), args.endDate)
        )
      )
      .collect();
  },
});

export const toggleHabit = mutation({
  args: {
    date: v.string(),
    habitId: v.id("habits"),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("habitLogs")
      .withIndex("by_habit_date", (q) =>
        q.eq("habitId", args.habitId).eq("date", args.date)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { completed: args.completed });
      return existing._id;
    }
    return await ctx.db.insert("habitLogs", args);
  },
});

// ========================================
// Health
// ========================================
export const getHealthLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = ctx.db.query("healthLogs").order("desc");
    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
});

export const upsertHealthLog = mutation({
  args: {
    date: v.string(),
    weight: v.optional(v.number()),
    sleep: v.optional(v.number()),
    energy: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("healthLogs")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    if (existing) {
      const update: any = {};
      if (args.weight !== undefined) update.weight = args.weight;
      if (args.sleep !== undefined) update.sleep = args.sleep;
      if (args.energy !== undefined) update.energy = args.energy;
      await ctx.db.patch(existing._id, update);
      return existing._id;
    }
    return await ctx.db.insert("healthLogs", args);
  },
});

// ========================================
// Journal
// ========================================
export const getJournalEntries = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = ctx.db.query("journalEntries").order("desc");
    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
});

export const addJournalEntry = mutation({
  args: {
    date: v.string(),
    text: v.string(),
    mood: v.optional(v.string()),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("journalEntries", args);
  },
});

// ========================================
// Evening Reflections
// ========================================
export const getEveningReflections = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = ctx.db.query("eveningReflections").order("desc");
    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
});

export const addEveningReflection = mutation({
  args: {
    date: v.string(),
    wentWell: v.optional(v.string()),
    fellShort: v.optional(v.string()),
    gratitude: v.optional(v.string()),
    valuesRating: v.optional(v.number()),
    intention: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("eveningReflections", args);
  },
});

// ========================================
// Weekly Reviews
// ========================================
export const getWeeklyReviews = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = ctx.db.query("weeklyReviews").order("desc");
    if (args.limit) {
      return await q.take(args.limit);
    }
    return await q.collect();
  },
});

export const addWeeklyReview = mutation({
  args: {
    weekDate: v.string(),
    wins: v.optional(v.string()),
    improvements: v.optional(v.string()),
    priorities: v.optional(v.array(v.string())),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("weeklyReviews", args);
  },
});

// ========================================
// Activity Log
// ========================================
export const getActivityLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const q = ctx.db.query("activityLog").order("desc");
    return await q.take(args.limit ?? 50);
  },
});

export const addActivity = mutation({
  args: {
    text: v.string(),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityLog", args);
  },
});

// ========================================
// Bulk data sync (for migrating from LocalStorage)
// ========================================
export const syncFromLocalStorage = mutation({
  args: {
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const data = args.data;
    let synced = 0;

    // Sync goals
    if (data.goals) {
      for (let i = 0; i < data.goals.length; i++) {
        const g = data.goals[i];
        await ctx.db.insert("goals", {
          category: g.category,
          name: g.name,
          target: g.target || undefined,
          order: i,
          active: true,
        });
        synced++;
      }
    }

    // Sync weeks
    if (data.weeks) {
      for (const w of data.weeks) {
        await ctx.db.insert("weeks", {
          startDate: w.startDate,
          entries: w.entries,
        });
        synced++;
      }
    }

    // Sync transactions
    if (data.transactions) {
      for (const t of data.transactions) {
        await ctx.db.insert("transactions", {
          date: t.date,
          description: t.description,
          category: t.category,
          amount: t.amount,
          type: t.type,
          account: t.account || undefined,
          source: t.source || "manual",
        });
        synced++;
      }
    }

    // Sync accounts
    if (data.accounts) {
      for (const a of data.accounts) {
        await ctx.db.insert("accounts", {
          name: a.name,
          type: a.type,
          balance: a.balance,
        });
        synced++;
      }
    }

    // Sync journal entries
    if (data.journalEntries) {
      for (const j of data.journalEntries) {
        await ctx.db.insert("journalEntries", {
          date: j.date,
          text: j.text,
          mood: j.mood || undefined,
          type: j.type || "free",
        });
        synced++;
      }
    }

    // Sync weekly reviews
    if (data.weeklyReviews) {
      for (const r of data.weeklyReviews) {
        await ctx.db.insert("weeklyReviews", {
          weekDate: r.weekDate,
          wins: r.wins || undefined,
          improvements: r.improvements || undefined,
          priorities: r.priorities || undefined,
          rating: r.rating || undefined,
        });
        synced++;
      }
    }

    // Sync budgets
    if (data.settings?.defaultBudgets) {
      for (const [cat, amount] of Object.entries(data.settings.defaultBudgets)) {
        await ctx.db.insert("budgets", {
          category: cat,
          amount: amount as number,
        });
        synced++;
      }
    }

    return { synced };
  },
});
