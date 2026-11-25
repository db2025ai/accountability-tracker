import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
import * as L from "../convex/lib/lifeos";
import * as P from "../convex/lib/practice";
// @ts-ignore: Vite raw import of the app, for the scoring cross-check
import appSource from "../life-os.js?raw";
const TOKEN = "t".repeat(32);
const APP_KEY = "a".repeat(32);
const appKey = APP_KEY;

test("connector end to end", async () => {
  process.env.MCP_TOKEN = TOKEN;
  process.env.APP_KEY = APP_KEY;
  const t = convexTest(schema, modules);
  const call = async (method: string, params?: any, id: any = 1, path = TOKEN) => {
    const r = await t.fetch(`/mcp/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
    const txt = await r.text(); let body: any = null; try { body = JSON.parse(txt); } catch {} return { status: r.status, body };
  };
  const tool = async (name: string, args: any) => {
    const r = await call("tools/call", { name, arguments: args });
    return { err: r.body.result.isError, data: r.body.result.isError ? r.body.result.content[0].text : JSON.parse(r.body.result.content[0].text) };
  };
  expect((await call("initialize", { protocolVersion: "2025-06-18" }, 1, "wrong")).status).toBe(404);
  const init = await call("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "1" } });
  expect(init.body.result.serverInfo.name).toBe("life-os");
  expect((await call("notifications/initialized", {}, null)).status).toBe(202);
  const list = await call("tools/list");
  expect(list.body.result.tools.map((x: any) => x.name)).toContain("log_meal");
  const logged = await tool("log_meal", { date: "2026-10-19", time: "7:45 AM", label: "Breakfast", name: "Smoothie", source: "voice",
    items: [{ name: "Whey", qty: "1 scoop", calories: 120, protein: 24, carbs: 3, fat: 1.5 }, { name: "Berries", calories: 70, protein: 1, carbs: 17, fat: 0.5 }],
    calories: 190, protein: 25, carbs: 20, fat: 2 });
  expect(logged.err).toBe(false);
  await tool("log_meal", { date: "2026-10-19", label: "Lunch", name: "Steak salad", items: [], calories: 540, protein: 57, carbs: 10, fat: 30 });
  let day = await tool("get_day", { date: "2026-10-19" });
  expect(day.data.totals).toEqual({ calories: 730, protein: 82, carbs: 30, fat: 32 });
  expect(day.data.remaining.protein).toBe(108);
  const upd = await tool("update_meal", { id: logged.data.id, protein: 30, calories: 210 });
  expect(upd.err).toBe(false);
  day = await tool("get_day", { date: "2026-10-19" });
  expect(day.data.totals.protein).toBe(87);
  expect((await tool("delete_meal", { id: "bogus" })).err).toBe(true);
  await tool("set_targets", { protein: 200 });
  const sum = await tool("get_summary", { from: "2026-10-13", to: "2026-10-19" });
  expect(sum.data.targets.protein).toBe(200);
  expect(sum.data.daysLogged).toBe(1);
  await tool("save_meal", { name: "Breakfast smoothie", items: [], calories: 317, protein: 42, carbs: 29, fat: 4.5 });
  expect((await tool("list_saved_meals", {})).data[0].key).toBe("breakfast-smoothie");
  expect((await tool("log_weight", { date: "2026-10-19", lb: 205.4 })).err).toBe(false);
  expect((await tool("log_weight", { date: "2026-10-19", lb: 5 })).err).toBe(true);
  // app side
  const range = await t.query(api.nutrition.getRange, { from: "2026-10-01", to: "2026-10-31", appKey });
  expect(range.days).toEqual([{ date: "2026-10-19", meals: 2, calories: 750, protein: 87, carbs: 30, fat: 32 }]);
  const pending = await t.query(api.nutrition.pendingWeighIns, { appKey });
  expect(pending.length).toBe(1);
  await t.mutation(api.nutrition.markWeighInsApplied, { ids: pending.map(p => p.id), appKey });
  expect((await t.query(api.nutrition.pendingWeighIns, { appKey })).length).toBe(0);
  expect((await call("bogus/method")).body.error.code).toBe(-32601);
});

test("workouts end to end", async () => {
  process.env.MCP_TOKEN = TOKEN;
  process.env.APP_KEY = APP_KEY;
  const t = convexTest(schema, modules);
  const call = async (method: string, params?: any) => {
    const r = await t.fetch(`/mcp/${TOKEN}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    return r.json();
  };
  const tool = async (name: string, args: any) => {
    const r = (await call("tools/call", { name, arguments: args })).result;
    return { err: r.isError, data: r.isError ? r.content[0].text : JSON.parse(r.content[0].text) };
  };
  const names = (await call("tools/list")).result.tools.map((x: any) => x.name);
  expect(names).toEqual(expect.arrayContaining(["log_meal", "log_workout", "update_workout", "delete_workout", "get_workouts", "get_lift_progress"]));

  // Strength: enums are case-insensitive; best set per key lift is reported as a new best
  const push = await tool("log_workout", { date: "2026-10-12", type: "Strength", name: "Push day", minutes: "55", source: "voice",
    exercises: [
      { name: "Bench press", lift: "Bench", muscles: ["Chest"], sets: [{ reps: 5, weight: 225 }, { reps: 5, weight: 225 }, { reps: 8, weight: 185 }] },
      { name: "Overhead press", lift: "ohp", muscles: ["shoulders"], sets: [{ reps: 3, weight: 135 }] },
      { name: "Dips", muscles: ["chest", "arms"], sets: [{ reps: 15, weight: 0 }] },
    ] });
  expect(push.err).toBe(false);
  expect(push.data.newBests).toEqual([
    { lift: "bench", e1rm: 263, set: "225 × 5", previous: null },
    { lift: "ohp", e1rm: 149, set: "135 × 3", previous: null },
  ]);
  const bench2 = await tool("log_workout", { date: "2026-10-15", type: "strength", name: "Bench day",
    exercises: [{ name: "Bench press", lift: "bench", muscles: ["chest"], sets: [{ reps: 5, weight: 235 }, { reps: 20, weight: 185 }] }] });
  expect(bench2.data.newBests).toEqual([{ lift: "bench", e1rm: 274, set: "235 × 5", previous: 263 }]); // 20-rep set ignored

  // Bad values come back as errors Claude can fix
  expect((await tool("log_workout", { date: "2026-10-15", type: "yoga", name: "x" })).data).toMatch(/type must be one of/);
  expect((await tool("log_workout", { date: "2026-10-15", type: "strength", name: "x", exercises: [{ name: "Hip thrust", muscles: ["glutes"], sets: [] }] })).data).toMatch(/Unknown muscle group "glutes"/);
  expect((await tool("log_workout", { date: "2026-10-15", type: "strength", name: "x", exercises: [{ name: "Curl", lift: "curl", muscles: ["arms"], sets: [] }] })).err).toBe(true);
  expect((await tool("log_workout", { date: "Oct 15", type: "swim", name: "x" })).err).toBe(true);

  // Swim from the watch: no exercises needed, and a resend isn't logged twice
  const swim = { date: "2026-10-13", type: "swim", name: "Pool swim", minutes: 40, distance: 1500, distanceUnit: "yd", source: "watch", externalId: "2026-10-13T06:30:00-04:00" };
  const s1 = await tool("log_workout", swim);
  const s2 = await tool("log_workout", swim);
  expect(s2.data).toEqual({ id: s1.data.id, duplicate: true, newBests: [] });

  // Watch strength session, then Claude adds the lifts to it
  const watch = await tool("log_workout", { date: "2026-10-16", type: "strength", name: "Traditional strength", minutes: 50, avgHr: 121, source: "watch", externalId: "w-16" });
  expect(watch.data.newBests).toEqual([]);
  const added = await tool("update_workout", { id: watch.data.id, name: "Leg day",
    exercises: [{ name: "Back squat", lift: "squat", muscles: ["legs"], sets: [{ reps: 5, weight: 275 }] }] });
  expect(added.data.newBests).toEqual([{ lift: "squat", e1rm: 321, set: "275 × 5", previous: null }]);
  expect((await tool("update_workout", { id: "bogus", name: "x" })).err).toBe(true);

  const week = await tool("get_workouts", { from: "2026-10-11", to: "2026-10-17" });
  expect(week.data.totals).toEqual({ sessions: 4, minutes: 145, byType: { strength: 3, swim: 1 } });
  expect(week.data.untrainedMuscles).toEqual(["back", "core"]);
  expect(week.data.sessions.map((s: any) => s.name)).toEqual(["Push day", "Pool swim", "Bench day", "Leg day"]);
  expect(week.data.sessions[3].exercises[0].sets).toEqual([{ reps: 5, weight: 275 }]);

  const prog = await tool("get_lift_progress", { from: "2026-10-01", to: "2026-10-31" });
  expect(prog.data.lifts.bench.sessions.map((s: any) => s.e1rm)).toEqual([263, 274]);
  expect(prog.data.lifts.bench.change).toBe(11);
  expect(prog.data.lifts.bench.allTimeBest).toEqual({ date: "2026-10-15", e1rm: 274, set: "235 × 5" });
  expect(prog.data.lifts.deadlift).toEqual({ allTimeBest: null, lastTrained: null, sessions: [], change: null });

  // App side: summaries carry muscle groups and key-lift bests; a core session counts as core
  await tool("log_workout", { date: "2026-10-17", type: "core", name: "Core circuit", minutes: 20 });
  const range = await t.query(api.workouts.getRange, { from: "2026-10-11", to: "2026-10-17", appKey });
  expect(range.sessions[0]).toMatchObject({ date: "2026-10-12", type: "strength", minutes: 55, muscles: ["chest", "shoulders", "arms"],
    lifts: { bench: { e1rm: 263, weight: 225, reps: 5 }, ohp: { e1rm: 149, weight: 135, reps: 3 } }, exercises: 3, sets: 5 });
  expect(range.sessions.map((s: any) => s.muscles)).toEqual([["chest", "shoulders", "arms"], [], ["chest"], ["legs"], ["core"]]);

  expect((await tool("delete_workout", { id: s1.data.id })).err).toBe(false);
  expect((await tool("get_workouts", { from: "2026-10-13", to: "2026-10-13" })).data.totals.sessions).toBe(0);
});

test("workout mode: profile, plans, Previous and Finish", async () => {
  process.env.MCP_TOKEN = TOKEN;
  process.env.APP_KEY = APP_KEY;
  const t = convexTest(schema, modules);
  const tool = async (name: string, args: any) => {
    const r = await t.fetch(`/mcp/${TOKEN}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) });
    const res = (await r.json()).result;
    return { err: res.isError, data: res.isError ? res.content[0].text : JSON.parse(res.content[0].text) };
  };

  // Training profile: empty, saved, replaced
  expect((await tool("get_training_profile", {})).data).toBe(null);
  await tool("set_training_profile", { notes: "Right shoulder: aggravated by DB bench, improving.", daysPerWeek: 3 });
  expect((await tool("get_training_profile", {})).data).toMatchObject({ notes: "Right shoulder: aggravated by DB bench, improving.", daysPerWeek: 3 });
  expect((await tool("set_training_profile", { notes: "x", daysPerWeek: 9 })).err).toBe(true);

  // History for the Previous column
  await tool("log_workout", { date: "2026-10-15", type: "strength", name: "Thu lift",
    exercises: [{ name: "Bench Press", lift: "bench", muscles: ["chest"], sets: [{ reps: 8, weight: 185 }, { reps: 7, weight: 185 }] }] });

  // Plan: validated, then replaced on the same date
  expect((await tool("plan_workout", { date: "2026-10-19", name: "x", exercises: [{ name: "Curl", lift: "curl", muscles: ["arms"], sets: [{ reps: 8, weight: 30 }] }] })).data).toMatch(/lift must be one of/);
  expect((await tool("plan_workout", { date: "2026-10-19", name: "x", exercises: [{ name: "Row", muscles: ["back"], sets: [{ reps: 10, repsMax: 8, weight: 100 }] }] })).data).toMatch(/repsMax/);
  const plan = { date: "2026-10-19", name: "Full body A", note: "Bench focus, shoulder-friendly",
    exercises: [
      { name: "Bench press", lift: "Bench", muscles: ["chest"], restSec: "150", note: "Slight arch, stop if >3/10",
        sets: [{ reps: 10, weight: 95, warmup: true }, { reps: "8", repsMax: 10, weight: "190" }, { reps: 8, repsMax: 10, weight: 190 }] },
      { name: "Romanian deadlift", muscles: ["legs"], sets: [{ reps: 10, weight: 135 }] },
    ] };
  const p1 = await tool("plan_workout", { ...plan, name: "Draft" });
  const p2 = await tool("plan_workout", plan);
  expect(p2.data).toEqual({ id: p1.data.id, replaced: true });
  const plans = await t.query(api.plans.forRange, { from: "2026-10-19", to: "2026-10-25", appKey });
  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({ id: p1.data.id, name: "Full body A", status: "planned", note: "Bench focus, shoulder-friendly" });
  expect(plans[0].exercises[0]).toEqual({ name: "Bench press", lift: "bench", muscles: ["chest"], restSec: 150, note: "Slight arch, stop if >3/10",
    sets: [{ reps: 10, weight: 95, warmup: true }, { reps: 8, repsMax: 10, weight: 190 }, { reps: 8, repsMax: 10, weight: 190 }] });

  // Previous: most recent sets per exercise name, case-insensitive
  const prev = await t.query(api.workouts.lastSets, { names: ["Bench press", "Romanian deadlift"], appKey });
  expect(prev).toEqual({ "bench press": { date: "2026-10-15", sets: [{ reps: 8, weight: 185 }, { reps: 7, weight: 185 }] } });

  // Finish from the app: saved as a strength session, plan marked done, a retry isn't a duplicate
  const session = { externalId: "app-1", planId: p1.data.id, date: "2026-10-19", name: "Full body A", minutes: 52,
    exercises: [{ name: "Bench press", lift: "bench", muscles: ["chest"], note: "Felt discomfort", sets: [{ reps: 10, weight: 190 }, { reps: 8, weight: 190 }] }],
    notes: "Skipped: Romanian deadlift" };
  const done = await t.mutation(api.workouts.finishSession, { ...session, appKey });
  expect(done.newBests).toEqual([{ lift: "bench", e1rm: 253, set: "190 × 10", previous: 234 }]);
  expect(await t.mutation(api.workouts.finishSession, { ...session, appKey })).toEqual({ id: done.id, duplicate: true, newBests: [] });
  expect((await t.query(api.plans.forRange, { from: "2026-10-19", to: "2026-10-19", appKey }))[0].status).toBe("done");
  const day = await tool("get_workouts", { from: "2026-10-19", to: "2026-10-19" });
  expect(day.data.sessions).toHaveLength(1);
  expect(day.data.sessions[0]).toMatchObject({ type: "strength", source: "app", minutes: 52, notes: "Skipped: Romanian deadlift" });
  expect(day.data.sessions[0].exercises[0].note).toBe("Felt discomfort");
  expect((await tool("get_plans", { from: "2026-10-19", to: "2026-10-19" })).data[0]).toMatchObject({ status: "done", workoutId: done.id });

  // A done day can't be re-planned; plans can be deleted
  expect((await tool("plan_workout", plan)).data).toMatch(/already done/);
  const p3 = await tool("plan_workout", { ...plan, date: "2026-10-21", name: "Full body B" });
  expect((await tool("delete_plan", { id: p3.data.id })).err).toBe(false);
  expect(await t.query(api.plans.forRange, { from: "2026-10-21", to: "2026-10-21", appKey })).toEqual([]);
});

test("the app key locks every public function", async () => {
  const t = convexTest(schema, modules);
  // Every function the app (or anyone with the deployment URL) can call, with valid other args
  const calls: [string, any, any][] = [
    ["query", api.functions.getUpdatedAt, {}],
    ["query", api.functions.getData, {}],
    ["mutation", api.functions.setData, { payload: "{}" }],
    ["mutation", api.journal.importEntries, { entries: [], source: "x" }],
    ["query", api.journal.listArchive, {}],
    ["mutation", api.journal.clearArchive, {}],
    ["query", api.nutrition.getRange, { from: "2026-10-01", to: "2026-10-31" }],
    ["query", api.nutrition.pendingWeighIns, {}],
    ["mutation", api.nutrition.markWeighInsApplied, { ids: [] }],
    ["query", api.plans.forRange, { from: "2026-10-01", to: "2026-10-31" }],
    ["query", api.push.getVapidPublicKey, {}],
    ["mutation", api.push.saveSubscription, { subscription: { endpoint: "https://e", keys: { p256dh: "p", auth: "a" } } }],
    ["mutation", api.push.removeSubscription, { endpoint: "https://e" }],
    ["action", api.pushNode.sendTest, {}],
    ["query", api.workouts.getRange, { from: "2026-10-01", to: "2026-10-31" }],
    ["mutation", api.workouts.finishSession, { externalId: "x", date: "2026-10-19", name: "x", exercises: [] }],
    ["query", api.workouts.lastSets, { names: ["Bench press"] }],
    ["query", api.health.pendingSleep, {}],
    ["mutation", api.health.markSleepApplied, { ids: [] }],
    ["query", api.tasks.pending, {}],
    ["mutation", api.tasks.markApplied, { ids: [] }],
  ];
  const run = (kind: string, fn: any, args: any) => (t as any)[kind](fn, args);
  const refused = async (kind: string, fn: any, args: any) => {
    try { await run(kind, fn, args); return false; } catch (e: any) { return /Unauthorized/.test(String(e?.data ?? e?.message)); }
  };
  process.env.APP_KEY = APP_KEY;
  for (const [kind, fn, args] of calls) {
    expect(await refused(kind, fn, args), "no key").toBe(true);
    expect(await refused(kind, fn, { ...args, appKey: "b".repeat(32) }), "wrong key").toBe(true);
    expect(await refused(kind, fn, { ...args, appKey: APP_KEY.slice(1) }), "short key").toBe(true);
  }
  // With the key they work (sendTest needs web-push keys, so it stops later for another reason)
  for (const [kind, fn, args] of calls) {
    if (kind === "action") continue;
    await expect(run(kind, fn, { ...args, appKey })).resolves.not.toThrow();
  }
  // No APP_KEY set on the server (or a short one): everything is refused, even an empty key
  delete process.env.APP_KEY;
  expect(await refused("query", api.functions.getData, { appKey: "" })).toBe(true);
  process.env.APP_KEY = "short";
  expect(await refused("query", api.functions.getData, { appKey: "short" })).toBe(true);
  process.env.APP_KEY = APP_KEY;
});

test("Apple Watch sleep: Shortcut endpoint, the night's math, app pickup, get_sleep", async () => {
  process.env.MCP_TOKEN = TOKEN;
  process.env.APP_KEY = APP_KEY;
  process.env.SHORTCUT_KEY = "s".repeat(32);
  const t = convexTest(schema, modules);
  const post = async (body: string, key: string | null = "s".repeat(32)) => {
    const r = await t.fetch("/ingest/sleep", { method: "POST", headers: key === null ? {} : { Authorization: `Bearer ${key}` }, body });
    return { status: r.status, text: await r.text() };
  };
  // Only the Shortcut's own key gets in (not the app key), and nothing without SHORTCUT_KEY set
  expect((await post("{}", null)).status).toBe(401);
  expect((await post("{}", APP_KEY)).status).toBe(401);

  // Monday night from the watch (Eastern time): a nap Sunday afternoon, In Bed, stages, an awake gap
  const night = [
    "2026-10-18T14:00:00-04:00|2026-10-18T14:30:00-04:00|Asleep (Core)",
    "2026-10-19T22:55:00-04:00|2026-10-20T06:45:00-04:00|In Bed",
    "2026-10-19T23:05:00-04:00|2026-10-20T01:00:00-04:00|Asleep (Core)",
    "2026-10-20T01:00:00-04:00|2026-10-20T02:00:00-04:00|Asleep (Deep)",
    "2026-10-20T02:00:00-04:00|2026-10-20T03:00:00-04:00|Asleep (REM)",
    "2026-10-20T03:00:00-04:00|2026-10-20T03:10:00-04:00|Awake",
    "2026-10-20T03:10:00-04:00|2026-10-20T06:40:00-04:00|Core",
    "2026-10-20T03:30:00-04:00|2026-10-20T04:00:00-04:00|Asleep (Core)", // a second source overlapping: not double counted
    "not a sample",
  ].join("\n");
  const first = await post(JSON.stringify({ samples: night }));
  expect(first).toEqual({ status: 200, text: "Logged 7.4 h of sleep for Tue, Oct 20 (in bed 10:55 PM, up 6:40 AM). 1 line skipped." });
  // Plain text body works too, and re-sending replaces rather than duplicates
  expect((await post(night)).text).toMatch(/Replaced the earlier entry/);
  // HealthKit's numeric codes (0 in bed, 3 core) and a bedtime after midnight
  const late = await post(JSON.stringify({ samples: "2026-10-21T00:40:00-04:00|2026-10-21T06:50:00-04:00|3\n2026-10-21T00:30:00-04:00|2026-10-21T06:55:00-04:00|0" }));
  expect(late.text).toBe("Logged 6.2 h of sleep for Wed, Oct 21 (in bed 12:30 AM, up 6:50 AM).");
  // Typed by hand
  expect((await post(JSON.stringify({ date: "2026-10-22", hours: 8, bedtime: "22:30" }))).text).toBe("Logged 8 h of sleep for Thu, Oct 22 (in bed 10:30 PM).");
  expect((await post(JSON.stringify({ date: "2026-10-22", hours: 30 }))).status).toBe(400);
  expect((await post(JSON.stringify({ samples: "garbage" }))).text).toMatch(/^No sleep found/);
  expect((await post(JSON.stringify({ hello: 1 }))).status).toBe(400);

  // The app picks them up once
  const pending = await t.query(api.health.pendingSleep, { appKey });
  expect(pending.map((p: any) => [p.date, p.hours, p.bedtime, p.nightOf])).toEqual([
    ["2026-10-20", 7.4, "22:55", "2026-10-19"],
    ["2026-10-21", 6.2, "00:30", "2026-10-20"],
    ["2026-10-22", 8, "22:30", "2026-10-21"],
  ]);
  await t.mutation(api.health.markSleepApplied, { ids: pending.map((p: any) => p.id), appKey });
  expect(await t.query(api.health.pendingSleep, { appKey })).toEqual([]);

  // Claude: watch nights plus check-in sleep on other days
  await t.mutation(api.functions.setData, { payload: JSON.stringify({ healthLog: [{ date: "2026-10-19", sleep: 6.5 }, { date: "2026-10-20", sleep: 7.4, sleepSource: "watch" }] }), appKey });
  const res = await t.fetch(`/mcp/${TOKEN}`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_sleep", arguments: { from: "2026-10-19", to: "2026-10-22" } } }) });
  const sleep = JSON.parse((await res.json()).result.content[0].text);
  expect(sleep.nights.map((n: any) => [n.date, n.hours, n.source])).toEqual([
    ["2026-10-19", 6.5, "check-in"], ["2026-10-20", 7.4, "watch"], ["2026-10-21", 6.2, "watch"], ["2026-10-22", 8, "watch"],
  ]);
  expect(sleep.averageHours).toBe(7);
  delete process.env.SHORTCUT_KEY;
  expect((await post("{}")).status).toBe(401);
});

test("to-dos from chat: add_task, list_tasks, then the app picks them up", async () => {
  process.env.MCP_TOKEN = TOKEN;
  process.env.APP_KEY = APP_KEY;
  const t = convexTest(schema, modules);
  const tool = async (name: string, args: any) => {
    const r = await t.fetch(`/mcp/${TOKEN}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) });
    const body: any = await r.json();
    return { err: body.result.isError, data: body.result.isError ? body.result.content[0].text : JSON.parse(body.result.content[0].text) };
  };
  const added = await tool("add_task", { text: "  Create Spotify   developer app  " });
  expect(added.data.text).toBe("Create Spotify developer app");
  expect((await tool("add_task", { text: "create spotify developer app" })).data.note).toMatch(/Already waiting/);
  expect((await tool("add_task", { text: "   " })).err).toBe(true);
  expect((await tool("add_task", { text: "x".repeat(201) })).err).toBe(true);
  await tool("add_task", { text: "Allow Hugging Face in Claude settings" });

  // The app already has one open and one finished task in its saved data
  const now = new Date().toISOString();
  await t.mutation(api.functions.setData, { appKey, payload: JSON.stringify({ adhocTasks: [
    { id: "a", text: "Book dentist", completed: false, weekStart: now, created: now },
    { id: "b", text: "Return package", completed: true, weekStart: now, created: now },
  ] }) });
  const listed = await tool("list_tasks", {});
  expect(listed.data.tasks.map((x: any) => x.text)).toEqual(["Book dentist"]);
  expect(listed.data.waitingForApp.map((x: any) => x.text)).toEqual(["Create Spotify developer app", "Allow Hugging Face in Claude settings"]);
  expect((await tool("list_tasks", { includeDone: true })).data.tasks.length).toBe(2);

  const pending = await t.query(api.tasks.pending, { appKey });
  expect(pending.map((p: any) => p.text)).toEqual(["Create Spotify developer app", "Allow Hugging Face in Claude settings"]);
  await t.mutation(api.tasks.markApplied, { ids: pending.map((p: any) => p.id), appKey });
  expect((await t.query(api.tasks.pending, { appKey })).length).toBe(0);
  expect((await tool("list_tasks", {})).data.waitingForApp).toEqual([]);
});

// ---- The rest of Life OS, read-only: get_today, get_week, get_trends, get_goals, get_practice, get_journal ----
// Wed Nov 25, 2026 at noon in Boston. The data is saved by the app (setData) the way it stores it.
const LIFEOS_NOW = new Date("2026-11-25T17:00:00Z");
function lifeOsData() {
  const goals = [
    { category: "Morning Protocol", name: "Skincare AM", target: "daily" },
    { category: "Morning Protocol", name: "Up by 7:15AM", target: "weekdays" },
    { category: "Physical Health", name: "2 Strength Training", target: "x2" },
    { category: "Physical Health", name: "1 Night of Drinking, 2 drinks max", target: "x1 max" },
    { category: "Budgeting", name: "Buy lunch max x2/weekdays", target: "x2" },
    { category: "Monthly", name: "1 networking event", target: "monthly" },
    { category: "Cooking", name: "Weekend cooking project (this week's method)", target: "weekly" },
    { category: "Evening Protocol", name: "Gym nights", target: "daily", days: [1, 3] },
  ];
  const week = (startDate: string, rows: string[][], extra: any = {}) => ({
    startDate, ...extra,
    entries: Object.fromEntries(goals.map((g, i) => [i, { goal: { ...g }, tracking: rows[i] }])),
  });
  const blank = ["", "", "", "", "", "", ""];
  return {
    goals,
    settings: { scoringCutover: "2026-10-11", reminders: { enabled: false, morning: "08:00", evening: "21:00", timezone: "America/New_York" } },
    weeks: [
      week("2026-11-15T05:00:00.000Z", [
        ["X", "X", "X", "X", "X", "X", "X"], ["", "X", "X", "X", "X", "X", ""], ["", "X", "", "", "X", "", ""],
        ["", "", "", "", "", "X", ""], ["", "X", "", "", "", "", ""], ["", "", "", "", "", "", ""],
        ["", "", "", "", "", "", ""], ["", "X", "", "", "", "", ""],
      ]),
      week("2026-11-22T05:00:00.000Z", [
        ["X", "X", "", "X", "", "", ""], ["", "X", "1", "", "", "", ""], ["", "X", "", "", "", "", ""],
        ["X", "", "X", "", "", "", ""], ["", "", "X", "", "", "", ""], ["", "", "", "", "", "", ""],
        [...blank], ["", "-", "", "", "", "", ""],
      ]),
    ],
    weekGoals: {
      "2026-11-15": { text: "Finish the board memo", step: "Outline", setAt: "2026-11-16T13:00:00Z", result: "hit" },
      "2026-11-22": { text: "Ship the Q4 plan", step: "Draft section 1", setAt: "2026-11-23T14:00:00Z" },
    },
    eveningReflections: [
      { date: "2026-11-24", timestamp: "2026-11-25T03:30:00Z", wentWell: "Lifted", fellShort: "Late night", highlights: ["Dinner with C"], valuesRating: 8, intention: "Bed by 11" },
      { date: "2026-11-23", timestamp: "2026-11-24T06:30:00Z", wentWell: "Past midnight still counts for Monday" },
    ],
    meditationLog: [{ date: "2026-11-24", ts: "2026-11-25T03:00:00Z", kind: "reflect", minutes: 3, theme: "control" }],
    healthLog: [{ date: "2026-11-24", energy: 4, sleep: 7.2 }],
    weeklyReviews: [{ weekDate: "Nov 15 - Nov 21, 2026", timestamp: "2026-11-21T20:00:00Z", wins: "Gym twice", improvements: "Sleep", priorities: ["Plan"], rating: 7 }],
  };
}

test("the rest of Life OS: today, week, trends, goals, practice, journal", async () => {
  process.env.MCP_TOKEN = TOKEN;
  process.env.APP_KEY = APP_KEY;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(LIFEOS_NOW);
  try {
    const t = convexTest(schema, modules);
    const tool = async (name: string, args: any) => {
      const r = await t.fetch(`/mcp/${TOKEN}`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) });
      const body: any = await r.json();
      return { err: body.result.isError, data: body.result.isError ? body.result.content[0].text : JSON.parse(body.result.content[0].text) };
    };
    // Nothing saved yet: answers, doesn't throw
    expect((await tool("get_today", {})).data.weekStarted).toBe(false);
    await t.mutation(api.functions.setData, { appKey, payload: JSON.stringify(lifeOsData()) });

    const today = (await tool("get_today", {})).data;
    expect(today.date).toBe("2026-11-25");
    expect(today.stillOpen).toEqual(["Up by 7:15AM", "Gym nights"]);
    expect(today.done).toEqual(["Skincare AM"]);
    expect(today.thisWeek).toEqual([
      { name: "2 Strength Training", ticks: 1, target: 2, met: false },
      { name: "Weekend cooking project (this week's method)", ticks: 0, target: 1, met: false },
    ]);
    expect(today.limits.find((l: any) => /Drinking/.test(l.name))).toMatchObject({ usedThisWeek: 2, limit: 1, over: true });
    expect(today.weekGoal).toMatchObject({ text: "Ship the Q4 plan", firstStep: "Draft section 1", setOn: "2026-11-23" });
    expect(today.practice).toMatch(/^Week 3 of \d+: cook /);
    expect(today.skincareTonight.night).toMatch(/Regular night|Tretinoin night|Mask night/);
    // A past day: blank scheduled habits are misses, struck ones are struck
    const tue = (await tool("get_today", { date: "2026-11-24" })).data;
    expect(tue.missed).toEqual(["Skincare AM"]);
    expect(tue.struck).toEqual(["Up by 7:15AM"]);
    expect((await tool("get_today", { date: "Nov 24" })).err).toBe(true);

    const week = (await tool("get_week", {})).data;
    expect(week.weekOf).toBe("2026-11-22");
    const row = (n: string) => week.goals.find((g: any) => g.name === n);
    expect(row("Skincare AM")).toMatchObject({ marks: "✓✓○✓___", done: 3, expected: 4, strikes: 1 });
    expect(row("Up by 7:15AM")).toMatchObject({ marks: "·✓✗___·", strikes: 1 });
    expect(row("Gym nights").marks).toBe("·–·_···");
    expect(row("2 Strength Training")).toMatchObject({ pending: true, strikes: 0 });
    expect(week.strikes).toBe(3);
    expect(week.lifeScore).toBe(67);
    expect(week.lastWeekScore).toBeGreaterThan(0);
    expect(week.mostStrikes[0]).toMatch(/\(1\)$/);

    const trends = (await tool("get_trends", { weeks: 3 })).data;
    expect(trends.weeks.map((w: any) => w.weekOf)).toEqual(["2026-11-08", "2026-11-15", "2026-11-22"]);
    expect(trends.weeks[0].weekStarted).toBe(false);
    expect(trends.weeks[1].weekGoal).toBe("Finish the board memo (hit)");

    const goals = (await tool("get_goals", {})).data;
    expect(goals.categories.find((c: any) => c.category === "Budgeting").goals[0].kind).toBe("limit");
    expect(goals.categories.find((c: any) => c.category === "Evening Protocol").goals[0].schedule).toBe("Every day (Mon Wed)");

    const practice = (await tool("get_practice", { outline: true })).data;
    expect(practice.week).toMatch(/^3 of /);
    expect(practice.weekOf).toBe("2026-11-22");
    expect(practice.cook.method).toBeTruthy();
    expect(practice.goalsThisWeek).toEqual([{ name: "Weekend cooking project (this week's method)", ticks: 0, target: 1 }]);
    expect(practice.outline[0].weekOf).toBe(practice.start);
    for (const l of [...practice.cook.links, ...practice.write.links]) expect(l.url).toMatch(/^https:\/\//);

    const journal = (await tool("get_journal", { from: "2026-11-22", to: "2026-11-25" })).data;
    expect(journal.reflections.map((r: any) => r.date)).toEqual(["2026-11-23", "2026-11-24"]);
    expect(journal.reflections[1]).toMatchObject({ highlights: ["Dinner with C"], valuesRating: 8 });
    expect(journal.journalStreak).toMatchObject({ current: 2, best: 2 });
    expect(journal.meditation).toEqual([{ date: "2026-11-24", kind: "reflect", minutes: 3, theme: "control" }]);
    expect(journal.checkins).toEqual([{ date: "2026-11-24", energy: 4, sleep: 7.2 }]);
    expect((await tool("get_journal", { from: "2026-10-01", to: "2026-11-25" })).err).toBe(true);
    await t.mutation(api.journal.importEntries, { appKey, entries: [{ date: "2026-11-22", text: "Old app entry" }], source: "Journal app" } as any);
    const withImported = (await tool("get_journal", { from: "2026-11-22", to: "2026-11-25", includeImported: true })).data;
    expect(withImported.importedEntries.map((e: any) => e.text)).toEqual(["Old app entry"]);
  } finally {
    vi.useRealTimers();
  }
});

// The connector's copy of the scoring rule (convex/lib/lifeos.ts) must give the app's numbers.
// Runs life-os.js's own scoreEntry on the same data and compares every goal of every week.
test("connector scoring matches the app", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(LIFEOS_NOW);
  try {
    const code = appSource.slice(0, appSource.indexOf("document.addEventListener('DOMContentLoaded'"));
    const { LifeOS, ...content } = new Function(`${code}\nreturn { LifeOS, PRACTICE_TERM, PRACTICE_LINKS, PRACTICE_GOALS, SKINCARE };`)();
    // convex/lib/practice.ts is a copy made by build_docs.py: run it after editing life-os.js
    expect({ PRACTICE_TERM: P.PRACTICE_TERM, PRACTICE_LINKS: P.PRACTICE_LINKS, PRACTICE_GOALS: P.PRACTICE_GOALS, SKINCARE: P.SKINCARE }).toEqual(content);
    const data = lifeOsData();
    // A second, legacy week (before the cutover) and a monthly goal ticked on Oct 2
    data.weeks.unshift({
      startDate: "2026-09-27T04:00:00.000Z",
      entries: Object.fromEntries(data.goals.map((g, i) => [i, { goal: { ...g }, tracking: i === 5 ? ["", "", "", "", "X", "", ""] : ["X", "1", "-", "", "X", "", ""] }])),
    } as any);
    const app = Object.create(LifeOS.prototype);
    app.data = data;
    const c = L.makeCtx(data, new Date());
    for (const week of data.weeks) {
      expect(L.weekStartKey(c, week)).toBe(app.localDateKey(app.weekStartOf(week)));
      for (const entry of Object.values(week.entries) as any[]) {
        const mine = L.scoreEntry(c, week, entry);
        const theirs = app.scoreEntry(week, entry);
        expect({ goal: entry.goal.name, done: mine.done, expected: mine.expected, misses: mine.misses })
          .toEqual({ goal: entry.goal.name, done: theirs.done, expected: theirs.expected, misses: theirs.misses });
        expect(L.scoringKind(c, entry.goal)).toBe(app.scoringKind(entry.goal));
      }
    }
    // Practice week and the copied curriculum
    for (const day of ["2026-11-01", "2026-11-08", "2026-11-25", "2026-12-27", "2027-03-01"]) {
      const a = app.practiceWeek(new Date(`${day}T12:00:00`));
      const b: any = L.practiceWeek(day);
      expect({ state: b.state, num: b.num, idx: b.idx }).toEqual({ state: a.state, num: a.num, idx: a.idx });
    }
  } finally {
    vi.useRealTimers();
  }
});
