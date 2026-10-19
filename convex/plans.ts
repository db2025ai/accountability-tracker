// Workout mode: Claude plans a session (plan_workout), the app runs it set by set, and Finish
// saves it as a `workouts` row (workouts.finishSession) and marks the plan done. The training
// profile is what Claude should remember between chats: injuries, equipment, schedule, goals.
import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_USER } from "./lib/reminders";
import { validate } from "./workouts";
import { requireAppKey } from "./lib/auth";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const plannedExercise = v.object({
  name: v.string(),
  lift: v.optional(v.string()),
  muscles: v.array(v.string()),
  note: v.optional(v.string()),
  restSec: v.optional(v.number()),
  sets: v.array(v.object({ reps: v.number(), repsMax: v.optional(v.number()), weight: v.number(), warmup: v.optional(v.boolean()) })),
});

// ---- Read by the app ----

// Plans between two dates, oldest first
export const forRange = query({
  args: { from: v.string(), to: v.string(), appKey: v.optional(v.string()) },
  handler: async (ctx, { from, to, appKey }) => {
    requireAppKey(appKey);
    if (!isDate(from) || !isDate(to)) throw new Error("Dates must be YYYY-MM-DD");
    const rows = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER).gte("date", from).lte("date", to))
      .collect();
    return rows
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map(({ _id, date, name, note, exercises, status }) => ({ id: _id, date, name, note, exercises, status }));
  },
});

// ---- Called by the Claude connector (http.ts) ----

export const planWorkout = internalMutation({
  args: { date: v.string(), name: v.string(), note: v.optional(v.string()), exercises: v.array(plannedExercise) },
  handler: async (ctx, plan) => {
    if (!isDate(plan.date)) throw new Error("date must be YYYY-MM-DD");
    if (!plan.exercises.length) throw new Error("A plan needs at least one exercise");
    validate({ exercises: plan.exercises });
    for (const ex of plan.exercises) {
      if (!ex.sets.length) throw new Error(`${ex.name} needs at least one set`);
      if (ex.sets.some((s) => s.repsMax !== undefined && s.repsMax < s.reps))
        throw new Error(`${ex.name}: repsMax must be at least reps`);
      if (ex.restSec !== undefined && !(ex.restSec >= 0 && ex.restSec <= 600)) throw new Error(`${ex.name}: restSec must be 0-600`);
    }
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER).eq("date", plan.date))
      .first();
    if (existing?.status === "done") throw new Error(`The ${plan.date} plan is already done; pick another date`);
    if (existing) {
      // note: plan.note clears an old summary when the new plan has none
      await ctx.db.patch(existing._id, { ...plan, note: plan.note, updatedAt: now });
      return { id: existing._id, replaced: true };
    }
    const id = await ctx.db.insert("workoutPlans", { userId: DEFAULT_USER, ...plan, status: "planned", createdAt: now, updatedAt: now });
    return { id, replaced: false };
  },
});

export const listPlans = internalQuery({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    if (!isDate(from) || !isDate(to)) throw new Error("Dates must be YYYY-MM-DD");
    const rows = await ctx.db
      .query("workoutPlans")
      .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER).gte("date", from).lte("date", to))
      .collect();
    return rows.map(({ _id, date, name, note, exercises, status, workoutId }) => ({ id: _id, date, name, note, status, workoutId, exercises }));
  },
});

export const deletePlan = internalMutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const planId = ctx.db.normalizeId("workoutPlans", id);
    if (!planId || !(await ctx.db.get(planId))) throw new Error(`No plan with id ${id}`);
    await ctx.db.delete(planId);
    return { deleted: id };
  },
});

export const getProfile = internalQuery({
  handler: async (ctx) => {
    const row = await ctx.db
      .query("trainingProfile")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    return row ? { notes: row.notes, daysPerWeek: row.daysPerWeek ?? null, updatedAt: row.updatedAt } : null;
  },
});

export const setProfile = internalMutation({
  args: { notes: v.string(), daysPerWeek: v.optional(v.number()) },
  handler: async (ctx, profile) => {
    if (!profile.notes.trim()) throw new Error("notes can't be empty");
    if (profile.daysPerWeek !== undefined && !(profile.daysPerWeek >= 1 && profile.daysPerWeek <= 7))
      throw new Error("daysPerWeek must be 1-7");
    const existing = await ctx.db
      .query("trainingProfile")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    const row = { ...profile, updatedAt: new Date().toISOString() };
    if (existing) await ctx.db.replace(existing._id, { userId: DEFAULT_USER, ...row });
    else await ctx.db.insert("trainingProfile", { userId: DEFAULT_USER, ...row });
    return { saved: true };
  },
});
