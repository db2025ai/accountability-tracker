// Ad-hoc tasks from Claude ("add X to my to-dos").
// Claude writes through the /mcp connector (http.ts) into the taskInbox table. The app copies new
// rows into data.adhocTasks (its Ad-Hoc Tasks list) the next time it opens, then marks them applied,
// the same pattern as weigh-ins, so the server never rewrites the userData blob the app also saves.
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_USER } from "./lib/reminders";
import { requireAppKey } from "./lib/auth";

export const MAX_TASK_LENGTH = 200;

// ---- Called by the app ----

export const pending = query({
  args: { appKey: v.optional(v.string()) },
  handler: async (ctx, { appKey }) => {
    requireAppKey(appKey);
    const rows = await ctx.db
      .query("taskInbox")
      .withIndex("by_user_applied", (q) => q.eq("userId", DEFAULT_USER).eq("applied", false))
      .collect();
    return rows.map((r) => ({ id: r._id, text: r.text, createdAt: r.createdAt }));
  },
});

export const markApplied = mutation({
  args: { ids: v.array(v.id("taskInbox")), appKey: v.optional(v.string()) },
  handler: async (ctx, { ids, appKey }) => {
    requireAppKey(appKey);
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (row && !row.applied) await ctx.db.patch(id, { applied: true });
    }
  },
});

// ---- Called by the Claude connector (http.ts) ----

export const addTask = internalMutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) throw new Error("text is empty");
    if (clean.length > MAX_TASK_LENGTH) throw new Error(`keep a task under ${MAX_TASK_LENGTH} characters`);
    // The same task sent twice before the app picks it up is kept once
    const waiting = await ctx.db
      .query("taskInbox")
      .withIndex("by_user_applied", (q) => q.eq("userId", DEFAULT_USER).eq("applied", false))
      .collect();
    if (waiting.some((r) => r.text.toLowerCase() === clean.toLowerCase())) {
      return { text: clean, note: "Already waiting to be added." };
    }
    await ctx.db.insert("taskInbox", { userId: DEFAULT_USER, text: clean, createdAt: new Date().toISOString(), applied: false });
    return { text: clean, note: "Added. It shows in Life OS's Ad-Hoc Tasks (Today tab) the next time the app opens." };
  },
});

// Open tasks: what's on the app's list (from its saved data) plus any still waiting in the inbox
export const listTasks = internalQuery({
  args: { includeDone: v.optional(v.boolean()) },
  handler: async (ctx, { includeDone }) => {
    const row = await ctx.db
      .query("userData")
      .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
      .first();
    const data = row ? (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) : {};
    // The app lists a task in the week it was added; look back four weeks
    const cutoff = new Date(Date.now() - 28 * 864e5).toISOString();
    const inApp = (Array.isArray(data?.adhocTasks) ? data.adhocTasks : [])
      .filter((t: any) => t && typeof t.text === "string" && (t.created || t.weekStart || "") >= cutoff)
      .filter((t: any) => includeDone || !t.completed)
      .map((t: any) => ({ text: t.text, done: !!t.completed, added: (t.created || t.weekStart || "").slice(0, 10) }));
    const waiting = await ctx.db
      .query("taskInbox")
      .withIndex("by_user_applied", (q) => q.eq("userId", DEFAULT_USER).eq("applied", false))
      .collect();
    return {
      tasks: inApp,
      waitingForApp: waiting.map((r) => ({ text: r.text, added: r.createdAt.slice(0, 10) })),
      note: "The app shows tasks under the week they were added.",
    };
  },
});
