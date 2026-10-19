// Nutrition: meals, saved meals, daily targets and weigh-ins.
// Claude writes through the /mcp connector (http.ts), which calls the internal functions
// here. The app only reads (getRange) and copies weigh-ins into its Health log
// (pendingWeighIns / markWeighInsApplied).
import { query, mutation, internalQuery, internalMutation, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_USER } from "./lib/reminders";
import { requireAppKey } from "./lib/auth";

export const DEFAULT_TARGETS = { calories: 2400, protein: 190, carbs: 240, fat: 75 };

const mealItem = v.object({
  name: v.string(),
  qty: v.optional(v.string()),
  calories: v.number(),
  protein: v.number(),
  carbs: v.number(),
  fat: v.number(),
});

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const r1 = (n: number) => Math.round((n || 0) * 10) / 10;
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "meal";

type Macros = { calories: number; protein: number; carbs: number; fat: number };
const sum = (rows: Macros[]): Macros =>
  rows.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
const rounded = (m: Macros): Macros => ({
  calories: Math.round(m.calories),
  protein: r1(m.protein),
  carbs: r1(m.carbs),
  fat: r1(m.fat),
});

async function getTargets(ctx: QueryCtx) {
  const row = await ctx.db
    .query("nutritionSettings")
    .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
    .first();
  return row
    ? { calories: row.calories, protein: row.protein, carbs: row.carbs, fat: row.fat }
    : { ...DEFAULT_TARGETS };
}

async function mealsBetween(ctx: QueryCtx, from: string, to: string) {
  return ctx.db
    .query("meals")
    .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER).gte("date", from).lte("date", to))
    .collect();
}

async function dayTotals(ctx: QueryCtx, from: string, to: string) {
  if (!isDate(from) || !isDate(to)) throw new Error("Dates must be YYYY-MM-DD");
  const meals = await mealsBetween(ctx, from, to);
  const byDate = new Map<string, typeof meals>();
  for (const m of meals) byDate.set(m.date, [...(byDate.get(m.date) || []), m]);
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, list]) => ({ date, meals: list.length, ...rounded(sum(list)) }));
}

// ---- Read by the app ----

// Per-day totals for the Health tab card (days with nothing logged are left out)
export const getRange = query({
  args: { from: v.string(), to: v.string(), appKey: v.optional(v.string()) },
  handler: async (ctx, { from, to, appKey }) => {
    requireAppKey(appKey);
    return { targets: await getTargets(ctx), days: await dayTotals(ctx, from, to) };
  },
});

export const pendingWeighIns = query({
  args: { appKey: v.optional(v.string()) },
  handler: async (ctx, { appKey }) => {
    requireAppKey(appKey);
    const rows = await ctx.db
      .query("weighIns")
      .withIndex("by_user_applied", (q) => q.eq("userId", DEFAULT_USER).eq("applied", false))
      .collect();
    return rows.map((r) => ({ id: r._id, date: r.date, lb: r.lb }));
  },
});

export const markWeighInsApplied = mutation({
  args: { ids: v.array(v.id("weighIns")), appKey: v.optional(v.string()) },
  handler: async (ctx, { ids, appKey }) => {
    requireAppKey(appKey);
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (row && !row.applied) await ctx.db.patch(id, { applied: true });
    }
  },
});

// ---- Called by the Claude connector (http.ts) ----

export const day = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    if (!isDate(date)) throw new Error("date must be YYYY-MM-DD");
    const targets = await getTargets(ctx);
    const meals = (await mealsBetween(ctx, date, date)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const totals = rounded(sum(meals));
    return {
      date,
      targets,
      totals,
      remaining: {
        calories: targets.calories - totals.calories,
        protein: r1(targets.protein - totals.protein),
        carbs: r1(targets.carbs - totals.carbs),
        fat: r1(targets.fat - totals.fat),
      },
      meals: meals.map((m) => ({
        id: m._id,
        time: m.time,
        label: m.label,
        name: m.name,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        items: m.items,
      })),
    };
  },
});

export const summary = internalQuery({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const targets = await getTargets(ctx);
    const days = await dayTotals(ctx, from, to);
    const n = days.length || 1;
    const avg = rounded({
      calories: sum(days).calories / n,
      protein: sum(days).protein / n,
      carbs: sum(days).carbs / n,
      fat: sum(days).fat / n,
    });
    return {
      from,
      to,
      targets,
      daysLogged: days.length,
      averagePerLoggedDay: avg,
      proteinTargetHitDays: days.filter((d) => d.protein >= targets.protein).length,
      days,
    };
  },
});

const mealFields = {
  date: v.string(),
  time: v.optional(v.string()),
  label: v.string(),
  name: v.string(),
  items: v.array(mealItem),
  calories: v.number(),
  protein: v.number(),
  carbs: v.number(),
  fat: v.number(),
  source: v.optional(v.string()),
  confidence: v.optional(v.string()),
};

export const addMeal = internalMutation({
  args: mealFields,
  handler: async (ctx, meal) => {
    if (!isDate(meal.date)) throw new Error("date must be YYYY-MM-DD");
    const id = await ctx.db.insert("meals", { userId: DEFAULT_USER, ...meal, createdAt: new Date().toISOString() });
    return { id };
  },
});

export const updateMeal = internalMutation({
  args: {
    id: v.string(),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    label: v.optional(v.string()),
    name: v.optional(v.string()),
    items: v.optional(v.array(mealItem)),
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
    confidence: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const mealId = ctx.db.normalizeId("meals", id);
    const row = mealId && (await ctx.db.get(mealId));
    if (!mealId || !row) throw new Error(`No meal with id ${id}`);
    if (patch.date !== undefined && !isDate(patch.date)) throw new Error("date must be YYYY-MM-DD");
    const clean = Object.fromEntries(Object.entries(patch).filter(([, val]) => val !== undefined));
    await ctx.db.patch(mealId, clean);
    return { id };
  },
});

export const deleteMeal = internalMutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const mealId = ctx.db.normalizeId("meals", id);
    if (!mealId || !(await ctx.db.get(mealId))) throw new Error(`No meal with id ${id}`);
    await ctx.db.delete(mealId);
    return { deleted: id };
  },
});

export const listSaved = internalQuery({
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("savedMeals")
      .withIndex("by_user_key", (q) => q.eq("userId", DEFAULT_USER))
      .collect();
    return rows.map(({ key, name, items, calories, protein, carbs, fat }) => ({ key, name, items, calories, protein, carbs, fat }));
  },
});

export const saveMeal = internalMutation({
  args: {
    name: v.string(),
    items: v.array(mealItem),
    calories: v.number(),
    protein: v.number(),
    carbs: v.number(),
    fat: v.number(),
  },
  handler: async (ctx, meal) => {
    const key = slug(meal.name);
    const existing = await ctx.db
      .query("savedMeals")
      .withIndex("by_user_key", (q) => q.eq("userId", DEFAULT_USER).eq("key", key))
      .first();
    const row = { ...meal, updatedAt: new Date().toISOString() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("savedMeals", { userId: DEFAULT_USER, key, ...row });
    return { key, replaced: !!existing };
  },
});

export const deleteSaved = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const existing = await ctx.db
      .query("savedMeals")
      .withIndex("by_user_key", (q) => q.eq("userId", DEFAULT_USER).eq("key", key))
      .first();
    if (!existing) throw new Error(`No saved meal "${key}"`);
    await ctx.db.delete(existing._id);
    return { deleted: key };
  },
});

export const setTargets = internalMutation({
  args: {
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
  },
  handler: async (ctx, patch) => {
    const existing = await ctx.db
      .query("nutritionSettings")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    const base = existing
      ? { calories: existing.calories, protein: existing.protein, carbs: existing.carbs, fat: existing.fat }
      : { ...DEFAULT_TARGETS };
    const next = {
      calories: patch.calories ?? base.calories,
      protein: patch.protein ?? base.protein,
      carbs: patch.carbs ?? base.carbs,
      fat: patch.fat ?? base.fat,
    };
    const updatedAt = new Date().toISOString();
    if (existing) await ctx.db.patch(existing._id, { ...next, updatedAt });
    else await ctx.db.insert("nutritionSettings", { userId: DEFAULT_USER, ...next, updatedAt });
    return next;
  },
});

export const addWeighIn = internalMutation({
  args: { date: v.string(), lb: v.number() },
  handler: async (ctx, { date, lb }) => {
    if (!isDate(date)) throw new Error("date must be YYYY-MM-DD");
    if (!(lb > 50 && lb < 600)) throw new Error("lb looks wrong");
    await ctx.db.insert("weighIns", { userId: DEFAULT_USER, date, lb, createdAt: new Date().toISOString(), applied: false });
    return { date, lb, note: "Shows in the Life OS Health log the next time the app opens." };
  },
});

// Weight history: the app's Health log plus weigh-ins it hasn't picked up yet
export const weights = internalQuery({
  args: { days: v.number() },
  handler: async (ctx, { days }) => {
    const row = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    const data = row ? (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) : {};
    const byDate = new Map<string, number>();
    for (const e of data?.healthLog || []) if (e?.date && typeof e.weight === "number") byDate.set(e.date, e.weight);
    const pending = await ctx.db
      .query("weighIns")
      .withIndex("by_user_applied", (q) => q.eq("userId", DEFAULT_USER).eq("applied", false))
      .collect();
    for (const p of pending) byDate.set(p.date, p.lb);
    const cutoff = new Date(Date.now() - Math.max(1, days) * 864e5).toISOString().slice(0, 10);
    const list = [...byDate.entries()]
      .filter(([d]) => d >= cutoff)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, lb]) => ({ date, lb }));
    const last7 = list.filter((x) => x.date >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
    const avg7 = last7.length ? r1(last7.reduce((a, b) => a + b.lb, 0) / last7.length) : null;
    return { entries: list, sevenDayAverage: avg7 };
  },
});
