// Life OS connector for Claude: a small MCP server (JSON-RPC over HTTP POST) at
//   https://<deployment>.convex.site/mcp/<MCP_TOKEN>
// Add that URL in Claude → Settings → Connectors. The token in the path is the only key,
// so keep the URL private. Set it with: npx convex env set MCP_TOKEN <long random string>
import { httpRouter } from "convex/server";
import { httpAction, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

const PROTOCOL_VERSION = "2025-06-18";

const num = { type: "number" };
const str = { type: "string" };
const item = {
  type: "object",
  properties: { name: str, qty: str, calories: num, protein: num, carbs: num, fat: num },
  required: ["name", "calories", "protein", "carbs", "fat"],
};
const date = { type: "string", description: "Local date, YYYY-MM-DD (America/New_York)" };

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
];

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
  "Life OS is Daniel's accountability app. Use these tools to log meals and weigh-ins he describes, " +
  "photographs or dictates, and to answer how his day or week is going. Always confirm an estimate before " +
  "log_meal. Dates are local (America/New_York) YYYY-MM-DD.";

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
