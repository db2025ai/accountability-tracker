"use node";

import webpush from "web-push";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  SITE_URL,
  TODAY_URL,
  dueKinds,
  localParts,
  reminderMessage,
  uncheckedToday,
} from "./lib/reminders";

type Subscription = { endpoint: string; p256dh: string; auth: string };

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || SITE_URL, publicKey, privateKey);
}

async function sendToAll(subscriptions: Subscription[], payload: object) {
  let delivered = 0;
  let failed = 0;
  const gone: string[] = [];
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 6 * 3600, urgency: "high" },
        );
        delivered++;
      } catch (err: any) {
        failed++;
        if (err?.statusCode === 404 || err?.statusCode === 410) gone.push(s.endpoint);
        else console.error("Push failed", err?.statusCode, err?.body ?? String(err));
      }
    }),
  );
  return { delivered, failed, gone };
}

function parsePayload(payload: string | null) {
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// Runs every 15 minutes (crons.ts). Cheap unless a reminder is due: only then is the
// data blob read. dryRun reports what would be sent without claiming or sending;
// `now` (ms) overrides the clock for testing.
export const sendReminders = internalAction({
  args: { dryRun: v.optional(v.boolean()), now: v.optional(v.number()) },
  handler: async (ctx, { dryRun, now: nowMs }): Promise<Record<string, unknown>> => {
    const { settings, subscriptions } = await ctx.runQuery(internal.push.getReminderState, {});
    if (!settings?.enabled) return { skipped: "reminders are off" };
    if (!dryRun && subscriptions.length === 0) return { skipped: "no subscribed devices" };

    const now = new Date(nowMs ?? Date.now());
    let local;
    try {
      local = localParts(now, settings.timezone);
    } catch {
      return { skipped: `unknown timezone ${settings.timezone}` };
    }

    const sent = new Set(await ctx.runQuery(internal.push.getSentKinds, { date: local.dateKey }));
    const due = dueKinds(settings, local.minutes).filter((k) => dryRun || !sent.has(k));
    if (due.length === 0) return { local, due };

    const data = parsePayload(await ctx.runQuery(internal.push.getPayload, {}));
    const { weekFound, items } = data ? uncheckedToday(data, settings.timezone, now) : { weekFound: false, items: [] };

    const results = [];
    for (const kind of due) {
      const message = reminderMessage(kind, items, weekFound);
      // Evening: only when something is left. Morning: when there's a list (or no week yet).
      const worthSending = kind === "evening" ? items.length > 0 : items.length > 0 || !weekFound;
      if (dryRun) {
        results.push({ kind, alreadySent: sent.has(kind), wouldSend: worthSending, count: items.length, message });
        continue;
      }
      const claimed = await ctx.runMutation(internal.push.claimSend, {
        date: local.dateKey,
        kind,
        count: items.length,
        status: worthSending ? "sending" : "skipped",
      });
      if (!claimed || !worthSending) {
        results.push({ kind, claimed, sent: false, count: items.length });
        continue;
      }
      configureVapid();
      const r = await sendToAll(subscriptions, { ...message, count: items.length, url: TODAY_URL });
      await ctx.runMutation(internal.push.finishSend, {
        date: local.dateKey,
        kind,
        status: r.delivered > 0 ? "sent" : "failed",
        delivered: r.delivered,
        failed: r.failed,
        gone: r.gone,
      });
      results.push({ kind, sent: r.delivered > 0, count: items.length, ...r });
    }
    return { local, due, results };
  },
});

// "Send test" button in Settings: sends the evening message right now to every device
export const sendTest = action({
  args: { timezone: v.optional(v.string()) },
  handler: async (ctx, { timezone }): Promise<{ sent: number; failed: number }> => {
    configureVapid();
    const { settings, subscriptions } = await ctx.runQuery(internal.push.getReminderState, {});
    const tz = timezone || settings?.timezone || "UTC";
    const data = parsePayload(await ctx.runQuery(internal.push.getPayload, {}));
    const { items } = data ? uncheckedToday(data, tz, new Date()) : { items: [] };
    const message = reminderMessage("evening", items);
    const r = await sendToAll(subscriptions, {
      ...message,
      title: `Test: ${message.title}`,
      body: message.body || "Reminders are working.",
      tag: "life-os-test",
      count: items.length,
      url: TODAY_URL,
    });
    if (r.gone.length > 0) await ctx.runMutation(internal.push.dropSubscriptions, { endpoints: r.gone });
    return { sent: r.delivered, failed: r.failed };
  },
});
