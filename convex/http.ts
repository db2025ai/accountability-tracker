// Life OS connector for Claude: a small MCP server (JSON-RPC over HTTP POST) at
//   https://<deployment>.convex.site/mcp/<MCP_TOKEN>
// Add that URL in Claude → Settings → Connectors. The token in the path is the only key,
// so keep the URL private. Set it with: npx convex env set MCP_TOKEN <long random string>
import { httpRouter } from "convex/server";
import { httpAction, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { WORKOUT_TYPES, LIFTS, MUSCLES, DISTANCE_UNITS } from "./workouts";

const PROTOCOL_VERSION = "2025-06-18";

const num = { type: "number" };
const str = { type: "string" };
const item = {
  type: "object",
  properties: { name: str, qty: str, calories: num, protein: num, carbs: num, fat: num },
  required: ["name", "calories", "protein", "carbs", "fat"],
};
const date = { type: "string", description: "Local date, YYYY-MM-DD (America/New_York)" };
const exercise = {
  type: "object",
  properties: {
    name: str,
    lift: {
      type: "string",
      enum: LIFTS,
      description:
        "Only for the key lifts: barbell bench press, back squat, deadlift (conventional or sumo), standing barbell overhead press. Leave out for everything else",
    },
    muscles: { type: "array", items: { type: "string", enum: MUSCLES }, description: "1-2 primary muscle groups" },
    note: { type: "string", description: 'How it felt, e.g. "Felt discomfort at the bottom"' },
    sets: {
      type: "array",
      items: {
        type: "object",
        properties: { reps: num, weight: { type: "number", description: "lb, 0 for bodyweight" } },
        required: ["reps", "weight"],
      },
    },
  },
  required: ["name", "muscles", "sets"],
};
const workoutProps = {
  date,
  time: { type: "string", description: 'e.g. "6:30 AM"' },
  type: {
    type: "string",
    enum: WORKOUT_TYPES,
    description: 'Use "core" only for a dedicated core workout (it ticks the Core goal); core moves inside a lift stay "strength"',
  },
  name: { type: "string", description: 'Short readable name, e.g. "Push day", "Pool swim"' },
  minutes: num,
  exercises: { type: "array", items: exercise },
  distance: num,
  distanceUnit: { type: "string", enum: DISTANCE_UNITS },
  calories: num,
  avgHr: { type: "number", description: "Average heart rate" },
  notes: str,
};

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (ctx: ActionCtx, args: any) => Promise<unknown>;
};

const TOOLS: Tool[] = [
  {
    name: "log_meal",
    description:
      "Log one meal to Life OS. Totals must equal the sum of items. Confirm the estimate with the user before calling.",
    inputSchema: {
      type: "object",
      properties: {
        date,
        time: { type: "string", description: 'e.g. "7:45 AM"' },
        label: { type: "string", enum: ["Breakfast", "Lunch", "Pre-lift", "Dinner", "Snack"] },
        name: { type: "string", description: "Short readable name of the meal" },
        items: { type: "array", items: item },
        calories: num,
        protein: num,
        carbs: num,
        fat: num,
        source: { type: "string", enum: ["photo", "voice", "text", "saved"] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["date", "label", "name", "items", "calories", "protein", "carbs", "fat"],
    },
    run: (ctx, a) => ctx.runMutation(internal.nutrition.addMeal, pick(a, MEAL_KEYS)),
  },
  {
    name: "update_meal",
    description: "Correct a logged meal by id (from get_day). Pass only the fields that change.",
    inputSchema: {
      type: "object",
      properties: {
        id: str,
        date,
        time: str,
        label: str,
        name: str,
        items: { type: "array", items: item },
        calories: num,
        protein: num,
        carbs: num,
        fat: num,
        confidence: str,
      },
      required: ["id"],
    },
    run: (ctx, a) => ctx.runMutation(internal.nutrition.updateMeal, pick(a, ["id", ...MEAL_KEYS.filter((k) => k !== "source")])),
  },
  {
    name: "delete_meal",
    description: "Delete a logged meal by id (from get_day).",
    inputSchema: { type: "object", properties: { id: str }, required: ["id"] },
    run: (ctx, a) => ctx.runMutation(internal.nutrition.deleteMeal, { id: String(a.id) }),
  },
  {
    name: "get_day",
    description: "Meals, totals, targets and what's left for one day.",
    inputSchema: { type: "object", properties: { date }, required: ["date"] },
    run: (ctx, a) => ctx.runQuery(internal.nutrition.day, { date: String(a.date) }),
  },
  {
    name: "get_summary",
    description: "Per-day totals, averages and protein-target hits between two dates (inclusive).",
    inputSchema: { type: "object", properties: { from: date, to: date }, required: ["from", "to"] },
    run: (ctx, a) => ctx.runQuery(internal.nutrition.summary, { from: String(a.from), to: String(a.to) }),
  },
  {
    name: "list_saved_meals",
    description: "Meals saved for quick logging (\"had my smoothie\"). Check these before estimating.",
    inputSchema: { type: "object", properties: {} },
    run: (ctx) => ctx.runQuery(internal.nutrition.listSaved, {}),
  },
  {
    name: "save_meal",
    description: "Save (or replace, by name) a meal for quick logging.",
    inputSchema: {
      type: "object",
      properties: { name: str, items: { type: "array", items: item }, calories: num, protein: num, carbs: num, fat: num },
      required: ["name", "items", "calories", "protein", "carbs", "fat"],
    },
    run: (ctx, a) => ctx.runMutation(internal.nutrition.saveMeal, pick(a, ["name", "items", "calories", "protein", "carbs", "fat"])),
  },
  {
    name: "delete_saved_meal",
    description: "Remove a saved meal by key (from list_saved_meals).",
    inputSchema: { type: "object", properties: { key: str }, required: ["key"] },
    run: (ctx, a) => ctx.runMutation(internal.nutrition.deleteSaved, { key: String(a.key) }),
  },
  {
    name: "set_targets",
    description: "Change daily targets (calories, protein, carbs, fat). Omitted fields keep their value.",
    inputSchema: { type: "object", properties: { calories: num, protein: num, carbs: num, fat: num } },
    run: (ctx, a) => ctx.runMutation(internal.nutrition.setTargets, pick(a, ["calories", "protein", "carbs", "fat"])),
  },
  {
    name: "log_weight",
    description: "Log a bodyweight in pounds for a date. It goes into the Life OS Health log.",
    inputSchema: { type: "object", properties: { date, lb: num }, required: ["date", "lb"] },
    run: (ctx, a) => ctx.runMutation(internal.nutrition.addWeighIn, { date: String(a.date), lb: Number(a.lb) }),
  },
  {
    name: "get_weights",
    description: "Bodyweight entries for the last N days and the 7-day average.",
    inputSchema: { type: "object", properties: { days: { type: "number", description: "Default 30" } } },
    run: (ctx, a) => ctx.runQuery(internal.nutrition.weights, { days: Number(a?.days) || 30 }),
  },
  {
    name: "log_workout",
    description:
      "Log one workout to Life OS. Strength: list each exercise with its sets and set `lift` on the key lifts so progress is tracked. " +
      "Cardio and swims: minutes and distance. If get_workouts shows an Apple Watch session of the same type that day, " +
      "add the exercises to it with update_workout instead of logging a second one. " +
      "Confirm what you read from a photo or screenshot before calling. Returns any new best estimated 1-rep max.",
    inputSchema: {
      type: "object",
      properties: {
        ...workoutProps,
        source: { type: "string", enum: ["voice", "text", "photo", "watch"] },
        externalId: { type: "string", description: "Stable id from the source (e.g. Apple Watch workout start) so a resend isn't logged twice" },
      },
      required: ["date", "type", "name"],
    },
    run: (ctx, a) => ctx.runMutation(internal.workouts.addWorkout, pickWorkout(a, WORKOUT_KEYS)),
  },
  {
    name: "update_workout",
    description: "Correct a logged workout by id (from get_workouts), or add exercises to it. Pass only the fields that change; exercises replaces the whole list.",
    inputSchema: { type: "object", properties: { id: str, ...workoutProps }, required: ["id"] },
    run: (ctx, a) =>
      ctx.runMutation(internal.workouts.updateWorkout, pickWorkout(a, ["id", ...WORKOUT_KEYS.filter((k) => k !== "source" && k !== "externalId")])),
  },
  {
    name: "delete_workout",
    description: "Delete a logged workout by id (from get_workouts).",
    inputSchema: { type: "object", properties: { id: str }, required: ["id"] },
    run: (ctx, a) => ctx.runMutation(internal.workouts.deleteWorkout, { id: String(a.id) }),
  },
  {
    name: "get_workouts",
    description: "Workouts with their exercises between two dates (inclusive), totals by type, and which muscle groups went untrained.",
    inputSchema: { type: "object", properties: { from: date, to: date }, required: ["from", "to"] },
    run: (ctx, a) => ctx.runQuery(internal.workouts.list, { from: String(a.from), to: String(a.to) }),
  },
  {
    name: "get_lift_progress",
    description:
      "Bench, squat, deadlift and overhead press: best set and estimated 1-rep max per session between two dates, the change over that span, all-time best and when each was last trained.",
    inputSchema: { type: "object", properties: { from: date, to: date }, required: ["from", "to"] },
    run: (ctx, a) => ctx.runQuery(internal.workouts.liftProgress, { from: String(a.from), to: String(a.to) }),
  },
  {
    name: "get_training_profile",
    description: "What to remember when planning workouts: injuries and how they're going, equipment, schedule, goals. Read it before plan_workout.",
    inputSchema: { type: "object", properties: {} },
    run: (ctx) => ctx.runQuery(internal.plans.getProfile, {}),
  },
  {
    name: "set_training_profile",
    description:
      "Save the training profile. It replaces the old one, so include everything still true (update injury notes as they change).",
    inputSchema: {
      type: "object",
      properties: { notes: { type: "string", description: "Plain text: injuries, equipment, schedule, goals, preferences" }, daysPerWeek: num },
      required: ["notes"],
    },
    run: (ctx, a) => ctx.runMutation(internal.plans.setProfile, pick(a, ["notes", "daysPerWeek"])),
  },
  {
    name: "plan_workout",
    description:
      "Plan one lifting session for Life OS workout mode; Daniel runs it in the app, ticking off each set, and Finish logs it. " +
      "First read get_training_profile, the last 2-3 weeks of get_workouts (including exercise notes like \"Felt discomfort\" and session notes) and get_lift_progress. " +
      "Build full-body sessions around bench, squat, deadlift and overhead press (set `lift` on those) plus accessories for muscle groups that went untrained. " +
      "Progress from his last numbers: if every working set reached the top of its rep range, add about 5 lb (upper body) or 10 lb (lower body); if he missed reps or flagged discomfort, hold or switch to a friendlier variation. " +
      "Work within the profile's injury notes. Put form cues and pain rules in each exercise's note. Replaces an unstarted plan on the same date.",
    inputSchema: {
      type: "object",
      properties: {
        date,
        name: { type: "string", description: 'e.g. "Full body A"' },
        note: { type: "string", description: "The day's focus in a sentence or two" },
        exercises: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: str,
              lift: exercise.properties.lift,
              muscles: exercise.properties.muscles,
              note: { type: "string", description: "Form cue or pain rule shown under the exercise" },
              restSec: { type: "number", description: "Rest after each set; about 150-180 for key lifts, 60-90 for accessories" },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    reps: { type: "number", description: "Target reps (the bottom of the range if repsMax is set)" },
                    repsMax: { type: "number", description: "Top of the rep range" },
                    weight: { type: "number", description: "lb, 0 for bodyweight" },
                    warmup: { type: "boolean" },
                  },
                  required: ["reps", "weight"],
                },
              },
            },
            required: ["name", "muscles", "sets"],
          },
        },
      },
      required: ["date", "name", "exercises"],
    },
    run: (ctx, a) => ctx.runMutation(internal.plans.planWorkout, pickPlan(a)),
  },
  {
    name: "get_plans",
    description: "Planned sessions between two dates with their status (planned or done).",
    inputSchema: { type: "object", properties: { from: date, to: date }, required: ["from", "to"] },
    run: (ctx, a) => ctx.runQuery(internal.plans.listPlans, { from: String(a.from), to: String(a.to) }),
  },
  {
    name: "delete_plan",
    description: "Delete a planned session by id (from get_plans).",
    inputSchema: { type: "object", properties: { id: str }, required: ["id"] },
    run: (ctx, a) => ctx.runMutation(internal.plans.deletePlan, { id: String(a.id) }),
  },
];

// Same clean-up as pickWorkout, for a plan's exercises and their target sets
function pickPlan(a: any) {
  const out = pick(a, ["date", "name", "note"]);
  out.exercises = (Array.isArray(a?.exercises) ? a.exercises : []).map((e: any) => {
    const [ex] = pickWorkout({ exercises: [e] }, ["exercises"]).exercises;
    if (e?.restSec !== undefined && Number.isFinite(Number(e.restSec))) ex.restSec = Number(e.restSec);
    ex.sets = (Array.isArray(e?.sets) ? e.sets : []).map((s: any) => {
      const set: Record<string, unknown> = { reps: Number(s?.reps) || 0, weight: Number(s?.weight) || 0 };
      if (s?.repsMax !== undefined && s?.repsMax !== null && Number.isFinite(Number(s.repsMax))) set.repsMax = Number(s.repsMax);
      if (s?.warmup) set.warmup = true;
      return set;
    });
    return ex;
  });
  return out;
}

const WORKOUT_KEYS = ["date", "time", "type", "name", "minutes", "exercises", "distance", "distanceUnit", "calories", "avgHr", "source", "externalId", "notes"];

// Keep only known keys and coerce types, so Convex validators see clean args. Enums are
// lower-cased; workouts.ts rejects values that still don't fit, with a message Claude can act on.
function pickWorkout(a: any, keys: string[]) {
  const out = pick(a, keys);
  for (const k of ["type", "distanceUnit"]) if (out[k] !== undefined) out[k] = String(out[k]).toLowerCase();
  for (const k of ["minutes", "distance", "calories", "avgHr"]) {
    if (out[k] === undefined) continue;
    const n = Number(out[k]);
    if (Number.isFinite(n)) out[k] = n;
    else delete out[k];
  }
  if (out.externalId !== undefined) out.externalId = String(out.externalId);
  if (Array.isArray(out.exercises)) {
    out.exercises = out.exercises.map((e: any) => {
      const ex: Record<string, unknown> = {
        name: String(e?.name ?? ""),
        muscles: (Array.isArray(e?.muscles) ? e.muscles : []).map((m: any) => String(m).toLowerCase()),
        sets: (Array.isArray(e?.sets) ? e.sets : []).map((s: any) => ({ reps: Number(s?.reps) || 0, weight: Number(s?.weight) || 0 })),
      };
      if (e?.lift !== undefined && e?.lift !== null && e?.lift !== "") ex.lift = String(e.lift).toLowerCase();
      if (e?.note) ex.note = String(e.note);
      return ex;
    });
  }
  return out;
}

const MEAL_KEYS = ["date", "time", "label", "name", "items", "calories", "protein", "carbs", "fat", "source", "confidence"];

// Keep only known keys and drop nulls, so Convex validators see clean args
function pick(a: any, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (a?.[k] !== undefined && a?.[k] !== null) out[k] = a[k];
  if (Array.isArray(out.items)) {
    out.items = (out.items as any[]).map((i) => {
      const it: Record<string, unknown> = {
        name: String(i?.name ?? ""),
        calories: Number(i?.calories) || 0,
        protein: Number(i?.protein) || 0,
        carbs: Number(i?.carbs) || 0,
        fat: Number(i?.fat) || 0,
      };
      if (i?.qty !== undefined && i?.qty !== null) it.qty = String(i.qty);
      return it;
    });
  }
  return out as any;
}

const INSTRUCTIONS =
  "Life OS is Daniel's accountability app. Use these tools to log meals, weigh-ins and workouts he describes, " +
  "photographs or dictates, and to answer how his day, week or training is going. Always confirm an estimate before " +
  "log_meal. For lifting, bench, squat, deadlift and overhead press are the focus: say when one hits a new best " +
  "or hasn't been trained in a while. When he asks for a workout, plan it with plan_workout so he can run it in the " +
  "app's workout mode, and keep the training profile current. Dates are local (America/New_York) YYYY-MM-DD.";

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: any };

async function handle(ctx: ActionCtx, msg: Rpc) {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "life-os", title: "Life OS", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return fail(-32602, `Unknown tool: ${msg.params?.name}`);
      try {
        const out = await tool.run(ctx, msg.params?.arguments || {});
        return reply({ content: [{ type: "text", text: JSON.stringify(out) }], isError: false });
      } catch (e: any) {
        return reply({ content: [{ type: "text", text: `Error: ${e?.message || String(e)}` }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

// Constant-time string compare so the token can't be guessed by timing
function sameToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const authorized = (req: Request) => {
  const token = process.env.MCP_TOKEN;
  const given = new URL(req.url).pathname.replace(/^\/mcp\//, "").replace(/\/$/, "");
  return !!token && token.length >= 24 && sameToken(given, token);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const mcp = httpAction(async (ctx, req) => {
  if (!authorized(req)) return new Response("Not found", { status: 404 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const batch = Array.isArray(body) ? body : [body];
  const replies = [];
  for (const msg of batch) {
    if (!msg || typeof msg.method !== "string") {
      replies.push({ jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32600, message: "Invalid request" } });
    } else if (msg.id === undefined || msg.id === null) {
      // Notification (e.g. notifications/initialized): no reply
    } else {
      replies.push(await handle(ctx, msg));
    }
  }
  if (!replies.length) return new Response(null, { status: 202 });
  return json(Array.isArray(body) ? replies : replies[0]);
});

// This server never pushes messages, so there is no event stream to open
const noStream = httpAction(async (_ctx, req) =>
  authorized(req) ? new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } }) : new Response("Not found", { status: 404 }),
);

const http = httpRouter();
http.route({ pathPrefix: "/mcp/", method: "POST", handler: mcp });
http.route({ pathPrefix: "/mcp/", method: "GET", handler: noStream });
http.route({ pathPrefix: "/mcp/", method: "DELETE", handler: noStream });
export default http;
