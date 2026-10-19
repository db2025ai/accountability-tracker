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
