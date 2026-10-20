import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getFunctionName } from "convex/server";
const modules = import.meta.glob("../convex/**/*.ts");
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
    ["mutation", api.push.saveSubscription, { subscription: { endpoint: "https://web.push.apple.com/probe", keys: { p256dh: "p", auth: "a" } } }],
    ["mutation", api.push.removeSubscription, { endpoint: "https://e" }],
    ["action", api.pushNode.sendTest, {}],
    ["query", api.workouts.getRange, { from: "2026-10-01", to: "2026-10-31" }],
    ["mutation", api.workouts.finishSession, { externalId: "x", date: "2026-10-19", name: "x", exercises: [] }],
    ["query", api.workouts.lastSets, { names: ["Bench press"] }],
    ["query", api.health.pendingSleep, {}],
    ["mutation", api.health.markSleepApplied, { ids: [] }],
  ];
  // That list must name every public function: a new one fails here until it's added
  const exported: string[] = [];
  for (const [path, load] of Object.entries(modules)) {
    if (path.includes("/_generated/")) continue;
    const mod: any = await (load as any)();
    const file = path.replace(/^.*\/convex\//, "").replace(/\.ts$/, "");
    for (const [name, fn] of Object.entries(mod)) if ((fn as any)?.isPublic) exported.push(`${file}:${name}`);
  }
  expect(exported.sort()).toEqual(calls.map(([, fn]) => getFunctionName(fn)).sort());

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

test("push subscriptions only for browser push services", async () => {
  const t = convexTest(schema, modules);
  process.env.APP_KEY = APP_KEY;
  const save = (endpoint: string) =>
    t.mutation(api.push.saveSubscription, { subscription: { endpoint, keys: { p256dh: "p", auth: "a" } }, appKey: APP_KEY });
  for (const endpoint of ["https://web.push.apple.com/abc", "https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://wns2-par02p.notify.windows.com/w/?token=abc"]) {
    await expect(save(endpoint), endpoint).resolves.toBeTruthy();
  }
  for (const endpoint of ["https://evil.example/collect", "http://web.push.apple.com/abc", "https://web.push.apple.com.evil.example/abc", "not a url"]) {
    await expect(save(endpoint), endpoint).rejects.toThrow();
  }
});
