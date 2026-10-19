// Workouts: sessions, their exercises and the key lifts (bench, squat, deadlift, overhead press).
// Claude writes through the /mcp connector (http.ts), which calls the internal functions here.
// The app only reads (getRange) and ticks the workout goals from it.
import { query, internalQuery, internalMutation, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { DEFAULT_USER } from "./lib/reminders";

export const WORKOUT_TYPES = ["strength", "cardio", "swim", "core", "mobility", "other"];
export const LIFTS = ["bench", "squat", "deadlift", "ohp"];
export const MUSCLES = ["chest", "back", "shoulders", "arms", "legs", "core"];
export const DISTANCE_UNITS = ["mi", "km", "m", "yd"];

const exercise = v.object({
  name: v.string(),
  lift: v.optional(v.string()),
  muscles: v.array(v.string()),
  sets: v.array(v.object({ reps: v.number(), weight: v.number() })),
});
type Exercise = { name: string; lift?: string; muscles: string[]; sets: { reps: number; weight: number }[] };
type Workout = Doc<"workouts">;
type Best = { e1rm: number; weight: number; reps: number };

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// Estimated one-rep max (Epley). Sets over 12 reps say little about a max, so they're left out.
export const e1rm = (weight: number, reps: number) =>
  weight > 0 && reps >= 1 && reps <= 12 ? Math.round(reps === 1 ? weight : weight * (1 + reps / 30)) : 0;

// Best set of each key lift in one session
function liftBests(exercises: Exercise[]) {
  const out: Record<string, Best> = {};
  for (const ex of exercises) {
    if (!ex.lift) continue;
    for (const s of ex.sets) {
      const est = e1rm(s.weight, s.reps);
      if (est && (!out[ex.lift] || est > out[ex.lift].e1rm)) out[ex.lift] = { e1rm: est, weight: s.weight, reps: s.reps };
    }
  }
  return out;
}

// Muscle groups a session worked, in MUSCLES order. A core session counts as core.
const musclesOf = (w: { type: string; exercises: Exercise[] }) => {
  const hit = new Set(w.exercises.flatMap((e) => e.muscles));
  if (w.type === "core") hit.add("core");
  return MUSCLES.filter((m) => hit.has(m));
};

// Leave out undefined fields so replies stay clean
const compact = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, val]) => val !== undefined)) as Partial<T>;

const summarize = (w: Workout) =>
  compact({
    id: w._id,
    date: w.date,
    time: w.time,
    type: w.type,
    name: w.name,
    minutes: w.minutes,
    distance: w.distance,
    distanceUnit: w.distanceUnit,
    calories: w.calories,
    avgHr: w.avgHr,
    source: w.source,
    muscles: musclesOf(w),
    lifts: liftBests(w.exercises),
    exercises: w.exercises.length,
    sets: w.exercises.reduce((n, e) => n + e.sets.length, 0),
  });

const byDate = (a: Workout, b: Workout) =>
  a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.createdAt.localeCompare(b.createdAt);

async function workoutsBetween(ctx: QueryCtx, from: string, to: string) {
  if (!isDate(from) || !isDate(to)) throw new Error("Dates must be YYYY-MM-DD");
  const rows = await ctx.db
    .query("workouts")
    .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER).gte("date", from).lte("date", to))
    .collect();
  return rows.sort(byDate);
}

async function allWorkouts(ctx: QueryCtx) {
  return ctx.db
    .query("workouts")
    .withIndex("by_user_date", (q) => q.eq("userId", DEFAULT_USER))
    .collect();
}

// Clear errors so Claude can correct the call
function validate(w: { date?: string; type?: string; minutes?: number; distanceUnit?: string; exercises?: Exercise[] }) {
  if (w.date !== undefined && !isDate(w.date)) throw new Error("date must be YYYY-MM-DD");
  if (w.type !== undefined && !WORKOUT_TYPES.includes(w.type))
    throw new Error(`type must be one of: ${WORKOUT_TYPES.join(", ")}`);
  if (w.minutes !== undefined && !(w.minutes >= 0 && w.minutes < 1000)) throw new Error("minutes looks wrong");
  if (w.distanceUnit !== undefined && !DISTANCE_UNITS.includes(w.distanceUnit))
    throw new Error(`distanceUnit must be one of: ${DISTANCE_UNITS.join(", ")}`);
  for (const ex of w.exercises || []) {
    if (ex.lift !== undefined && !LIFTS.includes(ex.lift))
      throw new Error(`lift must be one of: ${LIFTS.join(", ")} (leave it out for other exercises)`);
    const unknown = ex.muscles.find((m) => !MUSCLES.includes(m));
    if (unknown) throw new Error(`Unknown muscle group "${unknown}". Use: ${MUSCLES.join(", ")}`);
    if (ex.sets.some((s) => !(s.reps > 0) || !(s.weight >= 0)))
      throw new Error(`Each set of ${ex.name} needs reps above 0 and a weight of 0 or more (0 = bodyweight)`);
  }
}

// Key lifts in this session that beat every other logged session
function newBests(row: Workout, others: Workout[]) {
  const before: Record<string, number> = {};
  for (const o of others)
    for (const [lift, b] of Object.entries(liftBests(o.exercises))) before[lift] = Math.max(before[lift] || 0, b.e1rm);
  return Object.entries(liftBests(row.exercises))
    .filter(([lift, b]) => b.e1rm > (before[lift] || 0))
    .map(([lift, b]) => ({ lift, e1rm: b.e1rm, set: `${b.weight} × ${b.reps}`, previous: before[lift] ?? null }));
}

// ---- Read by the app ----

// Session summaries for the Health tab card and the goal ticks
export const getRange = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => ({
    sessions: (await workoutsBetween(ctx, from, to)).map(summarize),
  }),
});

// ---- Called by the Claude connector (http.ts) ----

const workoutFields = {
  date: v.string(),
  time: v.optional(v.string()),
  type: v.string(),
  name: v.string(),
  minutes: v.optional(v.number()),
  exercises: v.optional(v.array(exercise)),
  distance: v.optional(v.number()),
  distanceUnit: v.optional(v.string()),
  calories: v.optional(v.number()),
  avgHr: v.optional(v.number()),
  source: v.optional(v.string()),
  externalId: v.optional(v.string()),
  notes: v.optional(v.string()),
};

export const addWorkout = internalMutation({
  args: workoutFields,
  handler: async (ctx, w) => {
    const row = { ...w, exercises: w.exercises || [] };
    validate(row);
    const all = await allWorkouts(ctx);
    // The same Apple Watch workout sent again is not logged twice
    const same = row.externalId && all.find((x) => x.externalId === row.externalId);
    if (same) return { id: same._id, duplicate: true, newBests: [] };
    const id = await ctx.db.insert("workouts", { userId: DEFAULT_USER, ...row, createdAt: new Date().toISOString() });
    return { id, newBests: newBests((await ctx.db.get(id))!, all) };
  },
});

export const updateWorkout = internalMutation({
  args: {
    id: v.string(),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    type: v.optional(v.string()),
    name: v.optional(v.string()),
    minutes: v.optional(v.number()),
    exercises: v.optional(v.array(exercise)),
    distance: v.optional(v.number()),
    distanceUnit: v.optional(v.string()),
    calories: v.optional(v.number()),
    avgHr: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const workoutId = ctx.db.normalizeId("workouts", id);
    const row = workoutId && (await ctx.db.get(workoutId));
    if (!workoutId || !row) throw new Error(`No workout with id ${id}`);
    validate(patch);
    await ctx.db.patch(workoutId, compact(patch));
    const others = (await allWorkouts(ctx)).filter((x) => x._id !== workoutId);
    return { id, newBests: newBests((await ctx.db.get(workoutId))!, others) };
  },
});

export const deleteWorkout = internalMutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const workoutId = ctx.db.normalizeId("workouts", id);
    if (!workoutId || !(await ctx.db.get(workoutId))) throw new Error(`No workout with id ${id}`);
    await ctx.db.delete(workoutId);
    return { deleted: id };
  },
});

// Sessions with their exercises, totals and which muscle groups went untrained
export const list = internalQuery({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const rows = await workoutsBetween(ctx, from, to);
    const byType: Record<string, number> = {};
    const muscleSessions = Object.fromEntries(MUSCLES.map((m) => [m, 0]));
    for (const w of rows) {
      byType[w.type] = (byType[w.type] || 0) + 1;
      for (const m of musclesOf(w)) muscleSessions[m]++;
    }
    return {
      from,
      to,
      totals: { sessions: rows.length, minutes: rows.reduce((n, w) => n + (w.minutes || 0), 0), byType },
      muscleSessions,
      untrainedMuscles: MUSCLES.filter((m) => !muscleSessions[m]),
      sessions: rows.map((w) => ({ ...summarize(w), exercises: w.exercises, notes: w.notes })),
    };
  },
});

// Each key lift's best set per session between two dates, plus its all-time best
export const liftProgress = internalQuery({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    if (!isDate(from) || !isDate(to)) throw new Error("Dates must be YYYY-MM-DD");
    const all = (await allWorkouts(ctx)).sort(byDate);
    const lifts = Object.fromEntries(
      LIFTS.map((lift) => {
        const sessions = all
          .map((w) => ({ date: w.date, best: liftBests(w.exercises)[lift] }))
          .filter((s) => s.best)
          .map((s) => ({ date: s.date, e1rm: s.best.e1rm, set: `${s.best.weight} × ${s.best.reps}` }));
        const inRange = sessions.filter((s) => s.date >= from && s.date <= to);
        const top = sessions.reduce<(typeof sessions)[number] | null>((a, s) => (!a || s.e1rm > a.e1rm ? s : a), null);
        return [
          lift,
          {
            allTimeBest: top,
            lastTrained: sessions.length ? sessions[sessions.length - 1].date : null,
            sessions: inRange,
            change: inRange.length > 1 ? inRange[inRange.length - 1].e1rm - inRange[0].e1rm : null,
          },
        ];
      }),
    );
    return { from, to, note: "e1rm = estimated one-rep max (Epley), from sets of 12 reps or fewer, in lb", lifts };
  },
});
