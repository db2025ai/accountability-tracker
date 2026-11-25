// Read-only views of the Life OS data blob for the Claude connector (convex/lifeos.ts).
// The schedule and scoring rules MIRROR life-os.js (classifyFrequency, getGoalDays, isExpected,
// scoringKind, scoreEntry, isMonthlyDone, practiceWeek) — change both together. The
// "connector scoring matches the app" test in tests/app.test.mjs runs both on the same data.
// Dates are local YYYY-MM-DD keys in the app's timezone, so no Date math depends on the server.
import { localParts } from "./reminders";
import { PRACTICE_LINKS, PRACTICE_TERM, SKINCARE } from "./practice";

export const DEFAULT_TZ = "America/New_York";
const DEFAULT_CUTOVER = "2026-10-11";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// Marks in a goal's 7-day row (Sun..Sat)
export const MARKS_LEGEND =
  "Sun..Sat: ✓ done, ✗ struck, ○ missed (scheduled, passed, never ticked), – doesn't apply (skipped), · not scheduled or vacation, _ open (today or later)";

export function addDays(key: string, n: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const dowOf = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();
export const sundayOf = (key: string) => addDays(key, -dowOf(key));
export const isDateKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export type Ctx = { data: any; goals: any[]; tz: string; today: string; minutes: number; cutover: string };

export function makeCtx(data: any, now: Date): Ctx {
  const tz = (typeof data?.settings?.reminders?.timezone === "string" && data.settings.reminders.timezone) || DEFAULT_TZ;
  let parts;
  try {
    parts = localParts(now, tz);
  } catch {
    parts = localParts(now, DEFAULT_TZ);
  }
  return {
    data: data || {},
    goals: Array.isArray(data?.goals) ? data.goals : [],
    tz,
    today: parts.dateKey,
    minutes: parts.minutes,
    cutover: data?.settings?.scoringCutover || DEFAULT_CUTOVER,
  };
}

// ---- Schedule rules (mirror of life-os.js) ----

export function classifyFrequency(target?: string): { group: string; label: string; perWeek: number; isLimit?: boolean } {
  if (!target) return { group: "daily", label: "Daily", perWeek: 7 };
  const t = target.toLowerCase().trim();
  if (t === "daily") return { group: "daily", label: "Every day", perWeek: 7 };
  if (t === "weekdays" || t === "weeknights") return { group: "daily", label: "Weekdays", perWeek: 5 };
  if (t === "weekly") return { group: "weekly", label: "1x/week", perWeek: 1 };
  if (t === "monthly") return { group: "monthly", label: "Monthly", perWeek: 0.25 };
  const x = t.match(/x(\d+)/);
  if (x) {
    const n = parseInt(x[1]);
    if (t.includes("max")) return { group: "limit", label: `${n}x max/week`, perWeek: n, isLimit: true };
    if (n <= 1) return { group: "weekly", label: "1x/week", perWeek: 1 };
    return { group: "fewPerWeek", label: `${n}x/week`, perWeek: n };
  }
  return { group: "daily", label: target, perWeek: 7 };
}

function customDays(c: Ctx, goal: any): number[] | null {
  const current = c.goals.find((g) => g.name === goal.name);
  const days = current?.days ?? goal.days;
  return Array.isArray(days) ? days : null;
}

export function goalDays(c: Ctx, goal: any): number[] {
  const days = customDays(c, goal);
  if (days) return days;
  const t = (goal.target || "").toLowerCase().trim();
  if (t === "weekdays") return [1, 2, 3, 4, 5];
  if (t === "weeknights") return [0, 1, 2, 3, 4];
  return ALL_DAYS;
}

export function scoringKind(c: Ctx, goal: any): "limit" | "monthly" | "daily" | "perWeek" {
  const freq = classifyFrequency(goal.target);
  if (freq.isLimit || (goal.category || "").trim() === "Budgeting") return "limit";
  if (freq.group === "monthly") return "monthly";
  if (freq.group === "daily" || customDays(c, goal) !== null) return "daily";
  return "perWeek";
}

const vacationDays = (week: any): number[] => week.vacationDays || (week.vacation ? ALL_DAYS : []);
const isDone = (v: unknown) => v === "X" || v === "x";
const isTracked = (v: unknown) => v !== "" && v !== "-" && v != null;

function isExpected(c: Ctx, week: any, entry: any, d: number) {
  if (vacationDays(week).includes(d)) return false;
  if (entry.tracking[d] === "-") return false;
  return goalDays(c, entry.goal).includes(d);
}

// The Sunday a stored week starts on (startDate + 12h, floored to Sunday, in the app's timezone)
export function weekStartKey(c: Ctx, week: any) {
  const t = new Date(week?.startDate).getTime();
  if (!Number.isFinite(t)) return "";
  return sundayOf(localParts(new Date(t + 12 * 3600e3), c.tz).dateKey);
}

export function weekFor(c: Ctx, sunday: string) {
  const weeks: any[] = Array.isArray(c.data.weeks) ? c.data.weeks : [];
  for (let i = weeks.length - 1; i >= 0; i--) if (weekStartKey(c, weeks[i]) === sunday) return weeks[i];
  return null;
}

const entriesOf = (week: any): any[] =>
  Object.values(week?.entries || {}).filter((e: any) => e?.goal?.name && Array.isArray(e.tracking));

function isMonthlyDone(c: Ctx, goalName: string, month: string) {
  const weeks: any[] = Array.isArray(c.data.weeks) ? c.data.weeks : [];
  return weeks.some((week) => {
    const entry = entriesOf(week).find((e) => e.goal.name === goalName);
    if (!entry) return false;
    const start = weekStartKey(c, week);
    return entry.tracking.some((v: unknown, d: number) => isDone(v) && addDays(start, d).slice(0, 7) === month);
  });
}

export type Score = { kind: string; done: number; expected: number; misses: number; checks: number; target: number; pending?: boolean };

// Mirror of LifeOS.scoreEntry
export function scoreEntry(c: Ctx, week: any, entry: any): Score {
  const t = entry.tracking || [];
  const vac = vacationDays(week);
  const days = ALL_DAYS.filter((d) => !vac.includes(d));
  const explicit = days.reduce((n, d) => n + (parseInt(t[d]) || 0), 0);
  const checks = days.filter((d) => isDone(t[d])).length;
  const withManual = (n: number) => Math.max(0, n + (entry.manual || 0));
  const target = Math.round(classifyFrequency(entry.goal.target).perWeek);
  const start = weekStartKey(c, week);
  const dayKey = (d: number) => addDays(start, d);

  if (start < c.cutover) {
    const marked = days.filter((d) => isTracked(t[d])).length;
    return { kind: "legacy", done: checks, expected: marked, misses: withManual(explicit), checks, target };
  }

  const kind = scoringKind(c, entry.goal);
  const weekOver = dayKey(6) < c.today;

  if (kind === "daily") {
    let done = 0, expected = 0, inferred = 0;
    for (let d = 0; d < 7; d++) {
      if (!isExpected(c, week, entry, d)) continue;
      const v = t[d] ?? "";
      if (isDone(v)) { done++; expected++; }
      else if (parseInt(v) > 0) expected++;
      else if (dayKey(d) < c.today) { expected++; inferred++; }
    }
    return { kind, done, expected, misses: withManual(explicit + inferred), checks, target: expected };
  }

  const available = days.filter((d) => t[d] !== "-").length;

  if (kind === "limit") {
    if (available === 0) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target };
    const over = Math.max(0, checks - target);
    const missed = Math.max(explicit, over);
    return { kind, done: Math.max(0, target - missed), expected: target, misses: withManual(missed), checks, target };
  }

  if (kind === "monthly") {
    const endDay = ALL_DAYS.find((d) => dayKey(d + 1).endsWith("-01"));
    if (endDay === undefined) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: 0 };
    const end = dayKey(endDay);
    if (isMonthlyDone(c, entry.goal.name, end.slice(0, 7))) return { kind, done: 1, expected: 1, misses: withManual(explicit), checks, target: 1 };
    if (end >= c.today) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: 1, pending: true };
    return { kind, done: 0, expected: 1, misses: withManual(Math.max(explicit, 1)), checks, target: 1 };
  }

  const need = Math.min(target, available);
  if (need === 0) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: 0 };
  if (checks >= need) return { kind, done: need, expected: need, misses: withManual(explicit), checks, target: need };
  if (!weekOver) return { kind, done: 0, expected: 0, misses: withManual(explicit), checks, target: need, pending: true };
  return { kind, done: checks, expected: need, misses: withManual(Math.max(explicit, need - checks)), checks, target: need };
}

export const pct = (s: { done: number; expected: number }) =>
  s.expected > 0 ? Math.min(100, Math.round((s.done / s.expected) * 100)) : null;

export function scoreWeek(c: Ctx, week: any) {
  const total = { done: 0, expected: 0, misses: 0 };
  const cats: Record<string, { done: number; expected: number; misses: number }> = {};
  for (const entry of entriesOf(week)) {
    const s = scoreEntry(c, week, entry);
    const cat = entry.goal.category || "Other";
    cats[cat] ||= { done: 0, expected: 0, misses: 0 };
    for (const k of ["done", "expected", "misses"] as const) {
      total[k] += s[k];
      cats[cat][k] += s[k];
    }
  }
  return { total, cats };
}

// One character per day for a goal's row (MARKS_LEGEND)
function marks(c: Ctx, week: any, entry: any) {
  const start = weekStartKey(c, week);
  const cutover = start >= c.cutover;
  const daily = scoringKind(c, entry.goal) === "daily";
  const vac = vacationDays(week);
  return ALL_DAYS.map((d) => {
    const v = entry.tracking[d] ?? "";
    if (isDone(v)) return "✓";
    if (parseInt(v) > 0) return "✗";
    if (v === "-") return "–";
    if (vac.includes(d) || (daily && !goalDays(c, entry.goal).includes(d))) return "·";
    if (addDays(start, d) >= c.today) return "_";
    return cutover && daily ? "○" : "_";
  }).join("");
}

function scheduleLabel(c: Ctx, goal: any) {
  const days = customDays(c, goal);
  const label = classifyFrequency(goal.target).label;
  return days ? `${label} (${days.map((d) => DAY_NAMES[d]).join(" ")})` : label;
}

// ---- Tools ----

export function listGoals(c: Ctx) {
  const byCat: Record<string, any[]> = {};
  for (const g of c.goals) {
    if (!g?.name) continue;
    const cat = g.category || "Other";
    (byCat[cat] ||= []).push({ name: g.name, target: g.target || "daily", schedule: scheduleLabel(c, g), kind: scoringKind(c, g) });
  }
  return {
    categories: Object.entries(byCat).map(([category, goals]) => ({ category, goals })),
    kinds:
      "daily: every scheduled day counts, a blank past day is a miss. perWeek: N ticks a week, shortfall counts when the week ends. " +
      "limit: a tick logs one use, over the limit is a strike (all Budgeting goals). monthly: done once in the month.",
  };
}

function weekGoalOf(c: Ctx, sunday: string) {
  const g = c.data.weekGoals?.[sunday];
  if (!g?.text) return null;
  return { text: g.text, firstStep: g.step || undefined, result: g.result || undefined, setOn: g.setAt ? localParts(new Date(g.setAt), c.tz).dateKey : undefined };
}

function weeklyReviewOf(c: Ctx, sunday: string) {
  const reviews: any[] = Array.isArray(c.data.weeklyReviews) ? c.data.weeklyReviews : [];
  const r = reviews.find((r) => r?.timestamp && sundayOf(localParts(new Date(r.timestamp), c.tz).dateKey) === sunday);
  if (!r) return null;
  return { wins: r.wins || undefined, improvements: r.improvements || undefined, priorities: r.priorities?.length ? r.priorities : undefined, rating: r.rating ?? undefined };
}

export function today(c: Ctx, date?: string) {
  const day = isDateKey(date) ? date : c.today;
  const sunday = sundayOf(day);
  const dow = dowOf(day);
  const week = weekFor(c, sunday);
  const base = { date: day, day: dayLabel(day), isToday: day === c.today };
  if (!week) {
    return { ...base, weekStarted: false, note: "This week hasn't been started in the app yet (Goals → New Week).", practice: practiceLine(day), skincareTonight: skincareFor(day) };
  }
  const vacation = vacationDays(week).includes(dow);
  const done: string[] = [], struck: string[] = [], missed: string[] = [], open: string[] = [], skipped: string[] = [];
  const thisWeek: any[] = [], limits: any[] = [], monthly: any[] = [];
  for (const e of entriesOf(week)) {
    const v = e.tracking[dow] ?? "";
    const kind = scoringKind(c, e.goal);
    const name = e.goal.name;
    if (isDone(v) && kind !== "limit") done.push(name);
    else if (parseInt(v) > 0) struck.push(name);
    else if (v === "-") skipped.push(name);
    else if (kind === "daily" && !vacation && goalDays(c, e.goal).includes(dow)) (day < c.today ? missed : open).push(name);
    if (kind === "perWeek") {
      const s = scoreEntry(c, week, e);
      thisWeek.push({ name, ticks: s.checks, target: s.target || Math.round(classifyFrequency(e.goal.target).perWeek), met: s.checks >= s.target && s.target > 0 });
    } else if (kind === "limit") {
      const used = e.tracking.filter(isDone).length;
      const limit = Math.round(classifyFrequency(e.goal.target).perWeek);
      limits.push({ name, usedThisWeek: used, limit, usedToday: isDone(v), over: used > limit });
    } else if (kind === "monthly") {
      monthly.push({ name, doneThisMonth: isMonthlyDone(c, name, day.slice(0, 7)) });
    }
  }
  return {
    ...base,
    weekStarted: true,
    vacation: vacation || undefined,
    stillOpen: open,
    done,
    struck,
    missed: missed.length ? missed : undefined,
    skipped: skipped.length ? skipped : undefined,
    thisWeek,
    limits,
    monthly,
    weekGoal: weekGoalOf(c, sunday),
    practice: practiceLine(day),
    skincareTonight: skincareFor(day),
  };
}

export function weekDetail(c: Ctx, date?: string) {
  const day = isDateKey(date) ? date : c.today;
  const sunday = sundayOf(day);
  const week = weekFor(c, sunday);
  const range = `${dayLabel(sunday)} to ${dayLabel(addDays(sunday, 6))}`;
  if (!week) return { weekOf: sunday, range, weekStarted: false, weekGoal: weekGoalOf(c, sunday) };
  const { total, cats } = scoreWeek(c, week);
  const prev = weekFor(c, addDays(sunday, -7));
  const prevPct = prev ? pct(scoreWeek(c, prev).total) : null;
  const goals = entriesOf(week).map((e) => {
    const s = scoreEntry(c, week, e);
    return {
      name: e.goal.name,
      category: e.goal.category || "Other",
      schedule: scheduleLabel(c, e.goal),
      marks: marks(c, week, e),
      done: s.done,
      expected: s.expected,
      strikes: s.misses,
      ...(s.pending ? { pending: true } : {}),
    };
  });
  return {
    weekOf: sunday,
    range,
    weekStarted: true,
    lifeScore: pct(total),
    lastWeekScore: prevPct,
    strikes: total.misses,
    vacationDays: vacationDays(week).map((d: number) => DAY_NAMES[d]),
    categories: Object.entries(cats).map(([category, s]) => ({ category, score: pct(s), done: s.done, expected: s.expected, strikes: s.misses })),
    mostStrikes: goals.filter((g) => g.strikes > 0).sort((a, b) => b.strikes - a.strikes).slice(0, 6).map((g) => `${g.name} (${g.strikes})`),
    goals,
    legend: MARKS_LEGEND,
    note: "Scores are done ÷ expected, as in the app. N×/week goals count once met or once the week ends (pending until then).",
    weekGoal: weekGoalOf(c, sunday),
    weeklyReview: weeklyReviewOf(c, sunday),
  };
}

export function trends(c: Ctx, count: number) {
  const n = Math.max(1, Math.min(26, Math.round(count) || 8));
  const thisSunday = sundayOf(c.today);
  const weeks: any[] = [];
  const goalMisses: Record<string, { strikes: number; expected: number; done: number; weeks: number }> = {};
  for (let i = n - 1; i >= 0; i--) {
    const sunday = addDays(thisSunday, -7 * i);
    const week = weekFor(c, sunday);
    const row: any = { weekOf: sunday, current: i === 0 || undefined };
    if (week) {
      const { total, cats } = scoreWeek(c, week);
      row.lifeScore = pct(total);
      row.strikes = total.misses;
      row.categories = Object.fromEntries(Object.entries(cats).map(([k, s]) => [k, pct(s)]));
      for (const e of entriesOf(week)) {
        const s = scoreEntry(c, week, e);
        const g = (goalMisses[e.goal.name] ||= { strikes: 0, expected: 0, done: 0, weeks: 0 });
        g.strikes += s.misses;
        g.expected += s.expected;
        g.done += s.done;
        g.weeks++;
      }
    } else row.weekStarted = false;
    const wg = weekGoalOf(c, sunday);
    if (wg) row.weekGoal = wg.result ? `${wg.text} (${wg.result})` : wg.text;
    weeks.push(row);
  }
  const ranked = Object.entries(goalMisses).map(([name, g]) => ({ name, strikes: g.strikes, score: pct(g), weeks: g.weeks }));
  return {
    weeks,
    mostStrikes: ranked.filter((g) => g.strikes > 0).sort((a, b) => b.strikes - a.strikes).slice(0, 8),
    mostConsistent: ranked.filter((g) => g.score !== null && g.weeks >= 2).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5),
    note: "lifeScore and category scores are %. The current week counts N×/week goals only once met.",
  };
}

// ---- Practice curriculum and skincare (content from life-os.js, see lib/practice.ts) ----

const term: any = PRACTICE_TERM;
const links = (keys?: string[]) =>
  (keys || []).map((k) => (PRACTICE_LINKS as any)[k]).filter(Boolean).map((l: any) => ({ label: l.label, url: l.url }));

export function practiceWeek(day: string) {
  const DAY = 864e5;
  const t = Date.parse(`${day}T12:00:00Z`);
  const start = Date.parse(`${term.start}T12:00:00Z`);
  const total = term.weeks.filter((w: any) => !w.pause).length;
  if (t < start) return { state: "before", days: Math.round((start - t) / DAY), total };
  const idx = Math.floor((t - start) / (7 * DAY));
  if (idx >= term.weeks.length) return { state: "done", total };
  const num = term.weeks.slice(0, idx + 1).filter((w: any) => !w.pause).length;
  return { state: term.weeks[idx].pause ? "pause" : "on", idx, num, total, week: term.weeks[idx] };
}

function practiceLine(day: string) {
  const pw: any = practiceWeek(day);
  if (pw.state === "on") return `Week ${pw.num} of ${pw.total}: cook ${pw.week.cook.method}; write ${pw.week.write.focus}`;
  if (pw.state === "pause") return `${pw.week.title} (no practice this week)`;
  if (pw.state === "before") return `${term.title} starts in ${pw.days} days`;
  return `${term.title} is finished`;
}

export function practice(c: Ctx, date?: string, outline?: boolean) {
  const day = isDateKey(date) ? date : c.today;
  const pw: any = practiceWeek(day);
  const out: any = { term: term.title, start: term.start, state: pw.state, journalRule: term.journalRule };
  if (pw.state === "before") {
    out.startsInDays = pw.days;
    out.prep = term.prep;
    out.prepLinks = links(term.prepLinks);
  } else if (pw.state === "done") {
    out.next = term.next;
  } else {
    out.weekOf = addDays(term.start, 7 * pw.idx);
    if (pw.state === "pause") {
      out.pause = { title: pw.week.title, note: pw.week.note };
    } else {
      const { links: cl, ...cook } = pw.week.cook;
      const { links: wl, ...write } = pw.week.write;
      out.week = `${pw.num} of ${pw.total}`;
      out.cook = { ...cook, links: links(cl) };
      out.write = { ...write, links: links(wl) };
    }
    const nextIdx = term.weeks.findIndex((w: any, i: number) => i > pw.idx && !w.pause);
    if (nextIdx >= 0) out.nextWeek = { weekOf: addDays(term.start, 7 * nextIdx), cook: term.weeks[nextIdx].cook.method, write: term.weeks[nextIdx].write.focus };
    // How the Cooking and Writing goals stand this week
    const week = weekFor(c, sundayOf(day));
    if (week) {
      out.goalsThisWeek = entriesOf(week)
        .filter((e) => /^(Cooking|Writing)$/.test(e.goal.category || ""))
        .map((e) => {
          const s = scoreEntry(c, week, e);
          return { name: e.goal.name, ticks: s.checks, target: s.target || Math.round(classifyFrequency(e.goal.target).perWeek) };
        });
    }
  }
  if (outline) {
    out.outline = term.weeks.map((w: any, i: number) => ({
      weekOf: addDays(term.start, 7 * i),
      ...(w.pause ? { pause: w.title } : { cook: w.cook.method, write: w.write.focus }),
    }));
  }
  return out;
}

export function skincareFor(day: string) {
  const sc: any = SKINCARE;
  const dow = dowOf(day);
  const night = sc.tretDays.includes(dow) ? sc.pm.tret : sc.maskDays.includes(dow) ? sc.pm.mask : sc.pm.regular;
  return { night: night.title, steps: night.steps };
}

// ---- Journal: reflections, weekly reviews, meditation, check-ins ----

const LATE_NIGHT_HOURS = 3;

// The day a saved reflection is for (mirror of LifeOS.reflectionKey): its own date when backdated or
// without a timestamp, else the local day it was saved, counting until 3 AM as the night before
function reflectionKey(c: Ctx, r: any) {
  if (r.backdated || !r.timestamp) return String(r.date || "").slice(0, 10);
  const t = new Date(r.timestamp);
  if (!Number.isFinite(t.getTime())) return String(r.date || "").slice(0, 10);
  const p = localParts(t, c.tz);
  return p.minutes < LATE_NIGHT_HOURS * 60 ? addDays(p.dateKey, -1) : p.dateKey;
}

export function journal(c: Ctx, from: string, to: string) {
  const inRange = (k: string) => k >= from && k <= to;
  const reflections = (Array.isArray(c.data.eveningReflections) ? c.data.eveningReflections : [])
    .map((r: any) => ({ r, day: reflectionKey(c, r) }))
    .filter(({ day }: any) => inRange(day))
    .sort((a: any, b: any) => (a.day < b.day ? -1 : 1))
    .map(({ r, day }: any) => ({
      date: day,
      wentWell: r.wentWell || undefined,
      fellShort: r.fellShort || undefined,
      highlights: r.highlights?.length ? r.highlights : r.gratitude ? [r.gratitude] : undefined,
      valuesRating: r.valuesRating ?? undefined,
      intention: r.intention || undefined,
      writtenLater: r.backdated || undefined,
    }));
  const meditation = (Array.isArray(c.data.meditationLog) ? c.data.meditationLog : [])
    .filter((m: any) => inRange(String(m?.date || "")))
    .map((m: any) => ({ date: m.date, kind: m.kind, minutes: m.minutes, theme: m.theme || undefined }));
  const checkins = (Array.isArray(c.data.healthLog) ? c.data.healthLog : [])
    .filter((h: any) => inRange(String(h?.date || "")) && (h.energy != null || h.weight != null || h.sleep != null))
    .map((h: any) => ({ date: h.date, energy: h.energy ?? undefined, weight: h.weight ?? undefined, sleep: h.sleep ?? undefined }));
  const reviews = (Array.isArray(c.data.weeklyReviews) ? c.data.weeklyReviews : [])
    .filter((r: any) => r?.timestamp && inRange(localParts(new Date(r.timestamp), c.tz).dateKey))
    .map((r: any) => ({ written: localParts(new Date(r.timestamp), c.tz).dateKey, wins: r.wins || undefined, improvements: r.improvements || undefined, priorities: r.priorities, rating: r.rating ?? undefined }));
  const imported = (Array.isArray(c.data.journalImportDates) ? c.data.journalImportDates : []).filter((d: any) => inRange(String(d)));
  return {
    from,
    to,
    reflections,
    journalStreak: journalStreak(c),
    meditation,
    checkins: checkins.length ? checkins : undefined,
    weeklyReviews: reviews.length ? reviews : undefined,
    importedEntryDays: imported.length ? imported : undefined,
    note: "Energy is 1-5 from the daily check-in. valuesRating is 1-10.",
  };
}

// Mirror of LifeOS.getJournalStreak: days with a reflection or an imported entry,
// today not done yet doesn't break it
function journalStreak(c: Ctx) {
  const days = new Set<string>();
  for (const r of Array.isArray(c.data.eveningReflections) ? c.data.eveningReflections : []) days.add(reflectionKey(c, r));
  for (const d of Array.isArray(c.data.journalImportDates) ? c.data.journalImportDates : []) days.add(String(d));
  const open = c.minutes < LATE_NIGHT_HOURS * 60 ? addDays(c.today, -1) : c.today; // reflectionDay()
  let current = 0;
  for (let day = days.has(open) ? open : addDays(open, -1); days.has(day); day = addDays(day, -1)) current++;
  let best = 0, run = 0, prev = "";
  for (const key of [...days].filter(isDateKey).sort()) {
    run = prev && addDays(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return { current, best, daysJournaled: days.size, doneToday: days.has(open) };
}
