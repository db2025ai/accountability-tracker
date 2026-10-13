// Shared reminder logic: settings sync, "what's left today", and message text.
// The schedule rules mirror life-os.js (classifyFrequency, scoringKind, getGoalDays,
// isExpected) — keep them in sync.
import type { MutationCtx } from "../_generated/server";

export const DEFAULT_USER = "default";
export const SITE_URL = "https://db2025ai.github.io/accountability-tracker/";
export const TODAY_URL = "./?section=habits"; // resolved against the service worker scope

// A reminder goes out on the first cron run within this many minutes after its time
const SEND_WINDOW_MINUTES = 120;

export type ReminderKind = "morning" | "evening";
export type ReminderSettings = {
  enabled: boolean;
  morning: string;
  evening: string;
  timezone: string;
};

const isTime = (s: unknown): s is string => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);

export function extractReminderSettings(data: any): ReminderSettings | null {
  const r = data?.settings?.reminders;
  if (!r || typeof r !== "object") return null;
  return {
    enabled: !!r.enabled,
    morning: isTime(r.morning) ? r.morning : "08:00",
    evening: isTime(r.evening) ? r.evening : "21:00",
    timezone: typeof r.timezone === "string" && r.timezone ? r.timezone : "UTC",
  };
}

// Mirror data.settings.reminders into the small reminderSettings row (called from setData)
export async function syncReminderSettings(ctx: MutationCtx, payload: string) {
  let data: any;
  try {
    data = JSON.parse(payload);
  } catch {
    return;
  }
  const next = extractReminderSettings(data);
  const existing = await ctx.db
    .query("reminderSettings")
    .withIndex("by_userId", (q) => q.eq("userId", DEFAULT_USER))
    .first();
  if (!next) {
    if (existing?.enabled) await ctx.db.patch(existing._id, { enabled: false });
    return;
  }
  if (!existing) {
    await ctx.db.insert("reminderSettings", { userId: DEFAULT_USER, ...next });
  } else if (
    existing.enabled !== next.enabled ||
    existing.morning !== next.morning ||
    existing.evening !== next.evening ||
    existing.timezone !== next.timezone
  ) {
    await ctx.db.patch(existing._id, next);
  }
}

// ---- Local time in the reminder timezone ----

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function localParts(date: Date, timeZone: string) {
  const parts: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    dow: WEEKDAYS.indexOf(parts.weekday),
  };
}

function addDays(dateKey: string, n: number) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function dueKinds(settings: ReminderSettings, minutesNow: number): ReminderKind[] {
  return (["morning", "evening"] as ReminderKind[]).filter((kind) => {
    const at = toMinutes(settings[kind]);
    return minutesNow >= at && minutesNow < at + SEND_WINDOW_MINUTES;
  });
}

// ---- Goal schedule rules (mirror of life-os.js) ----

function classify(target?: string) {
  const t = (target || "").toLowerCase().trim();
  if (!t || t === "daily" || t === "weekdays" || t === "weeknights") return { group: "daily", isLimit: false };
  if (t === "weekly") return { group: "weekly", isLimit: false };
  if (t === "monthly") return { group: "monthly", isLimit: false };
  const x = t.match(/x(\d+)/);
  if (x) {
    if (t.includes("max")) return { group: "limit", isLimit: true };
    return { group: Number(x[1]) <= 1 ? "weekly" : "fewPerWeek", isLimit: false };
  }
  return { group: "daily", isLimit: false };
}

function customDays(goal: any, goals: any[]) {
  const current = goals.find((g) => g.name === goal.name);
  const days = current?.days ?? goal.days;
  return Array.isArray(days) ? (days as number[]) : null;
}

function isDailyGoal(goal: any, goals: any[]) {
  const freq = classify(goal.target);
  if (freq.isLimit || (goal.category || "").trim() === "Budgeting") return false;
  if (freq.group === "monthly") return false;
  return freq.group === "daily" || customDays(goal, goals) !== null;
}

function goalDays(goal: any, goals: any[]) {
  const days = customDays(goal, goals);
  if (days) return days;
  const t = (goal.target || "").toLowerCase().trim();
  if (t === "weekdays") return [1, 2, 3, 4, 5];
  if (t === "weeknights") return [0, 1, 2, 3, 4];
  return [0, 1, 2, 3, 4, 5, 6];
}

// Scheduled daily items still blank today (local to timeZone). weekFound is false when
// this week hasn't been started in the app yet.
export function uncheckedToday(data: any, timeZone: string, now: Date) {
  const { dateKey, dow } = localParts(now, timeZone);
  const weekStart = addDays(dateKey, -dow);
  const weeks: any[] = Array.isArray(data?.weeks) ? data.weeks : [];
  // startDate is Sunday midnight/noon where it was created; +12h absorbs timezone differences
  const week = [...weeks].reverse().find((w) => {
    const p = localParts(new Date(new Date(w.startDate).getTime() + 12 * 3600e3), timeZone);
    return addDays(p.dateKey, -p.dow) === weekStart;
  });
  if (!week) return { weekFound: false, items: [] as string[] };

  const vacation: number[] = week.vacationDays || (week.vacation ? [0, 1, 2, 3, 4, 5, 6] : []);
  if (vacation.includes(dow)) return { weekFound: true, items: [] as string[] };

  const goals: any[] = Array.isArray(data.goals) ? data.goals : [];
  const items = Object.values(week.entries || {})
    .filter((e: any) => {
      if (!e?.goal || !Array.isArray(e.tracking)) return false;
      if ((e.tracking[dow] ?? "") !== "") return false; // done, struck or skipped
      return isDailyGoal(e.goal, goals) && goalDays(e.goal, goals).includes(dow);
    })
    .map((e: any) => String(e.goal.name));
  return { weekFound: true, items };
}

// ---- Notification text ----

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function listNames(items: string[]) {
  const shown = items.slice(0, 3).join(" · ");
  return items.length > 3 ? `${shown} +${items.length - 3} more` : shown;
}

export function reminderMessage(kind: ReminderKind, items: string[], weekFound = true) {
  if (kind === "morning") {
    if (!weekFound) {
      return { title: "Good morning", body: "This week isn't set up yet — open Goals and tap + New Week.", tag: "life-os-morning" };
    }
    return { title: "Good morning", body: `${plural(items.length, "item")} on today's list.`, tag: "life-os-morning" };
  }
  return { title: `${plural(items.length, "item")} left today`, body: listNames(items), tag: "life-os-evening" };
}
