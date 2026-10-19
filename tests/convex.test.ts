import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
const TOKEN = "t".repeat(32);

test("connector end to end", async () => {
  process.env.MCP_TOKEN = TOKEN;
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
  const range = await t.query(api.nutrition.getRange, { from: "2026-10-01", to: "2026-10-31" });
  expect(range.days).toEqual([{ date: "2026-10-19", meals: 2, calories: 750, protein: 87, carbs: 30, fat: 32 }]);
  const pending = await t.query(api.nutrition.pendingWeighIns, {});
  expect(pending.length).toBe(1);
  await t.mutation(api.nutrition.markWeighInsApplied, { ids: pending.map(p => p.id) });
  expect((await t.query(api.nutrition.pendingWeighIns, {})).length).toBe(0);
  expect((await call("bogus/method")).body.error.code).toBe(-32601);
});

test("workouts end to end", async () => {
  process.env.MCP_TOKEN = TOKEN;
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
  const range = await t.query(api.workouts.getRange, { from: "2026-10-11", to: "2026-10-17" });
  expect(range.sessions[0]).toMatchObject({ date: "2026-10-12", type: "strength", minutes: 55, muscles: ["chest", "shoulders", "arms"],
    lifts: { bench: { e1rm: 263, weight: 225, reps: 5 }, ohp: { e1rm: 149, weight: 135, reps: 3 } }, exercises: 3, sets: 5 });
  expect(range.sessions.map((s: any) => s.muscles)).toEqual([["chest", "shoulders", "arms"], [], ["chest"], ["legs"], ["core"]]);

  expect((await tool("delete_workout", { id: s1.data.id })).err).toBe(false);
  expect((await tool("get_workouts", { from: "2026-10-13", to: "2026-10-13" })).data.totals.sessions).toBe(0);
});
