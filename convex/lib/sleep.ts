// Turns the Apple Watch Shortcut's sleep samples into one night: hours asleep, bedtime, wake time.
// Each sample is a line "START|END|VALUE": ISO 8601 times with the phone's offset
// (e.g. 2026-10-19T23:02:00-04:00) and the Sleep Analysis value ("In Bed", "Core", "Deep",
// "REM", "Awake", "Asleep (Unspecified)", or HealthKit's 0-5 codes). Dates and times are read
// as wall-clock from the strings, so they're the phone's local time without a timezone table.

type Wall = { date: string; minutes: number }; // local YYYY-MM-DD, minutes after midnight
export type SleepSample = { start: number; end: number; startWall: Wall; endWall: Wall; kind: "asleep" | "inbed" | "awake" };
export type Night = { date: string; nightOf: string; hours: number; bedtime: string; wake: string };

const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

function parseIso(s: string) {
  const m = ISO.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, sec, tz] = m;
  let offset = 0; // minutes ahead of UTC
  if (tz && tz !== "Z") {
    const sign = tz[0] === "-" ? -1 : 1;
    const digits = tz.slice(1).replace(":", "");
    offset = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
  }
  const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(sec || 0)) - offset * 60e3;
  return { ms, wall: { date: `${y}-${mo}-${d}`, minutes: +h * 60 + +mi } };
}

function kindOf(value: string): SleepSample["kind"] | null {
  const v = value.trim().toLowerCase();
  if (/^\d$/.test(v)) return v === "0" ? "inbed" : v === "2" ? "awake" : +v <= 5 ? "asleep" : null;
  if (/awake/.test(v)) return "awake";
  if (/in ?bed/.test(v)) return "inbed";
  if (/asleep|core|deep|rem|unspecified/.test(v)) return "asleep";
  return null;
}

// Lines that don't parse are skipped and counted
export function parseSamples(text: string) {
  const samples: SleepSample[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [a, b, value = ""] = line.split(/\s*[|\t;]\s*/);
    const start = a ? parseIso(a) : null;
    const end = b ? parseIso(b) : null;
    const kind = kindOf(value);
    if (!start || !end || !kind || end.ms <= start.ms) {
      skipped++;
      continue;
    }
    samples.push({ start: start.ms, end: end.ms, startWall: start.wall, endWall: end.wall, kind });
  }
  return { samples, skipped };
}

export const prevDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// The evening a bedtime belongs to: 23:02 on the 19th is the 19th's night, 00:40 on the 20th too
export const nightOfBedtime = (date: string, minutes: number) => (minutes >= 12 * 60 ? date : prevDate(date));

// The most recent night: asleep time merged across sources and stages, split into sessions at
// gaps over 2 hours (so an afternoon nap stays separate), latest session of 2+ hours asleep.
export function summarizeNight(samples: SleepSample[]): Night | null {
  const asleep = samples.filter((s) => s.kind === "asleep").sort((a, b) => a.start - b.start);
  if (!asleep.length) return null;
  const merged: SleepSample[] = [];
  for (const s of asleep) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      if (s.end > last.end) Object.assign(last, { end: s.end, endWall: s.endWall });
    } else merged.push({ ...s });
  }
  const sessions: SleepSample[][] = [];
  for (const s of merged) {
    const cur = sessions[sessions.length - 1];
    if (cur && s.start - cur[cur.length - 1].end <= 2 * 3600e3) cur.push(s);
    else sessions.push([s]);
  }
  const total = (ss: SleepSample[]) => ss.reduce((n, s) => n + (s.end - s.start), 0);
  const night = [...sessions].reverse().find((ss) => total(ss) >= 2 * 3600e3) || sessions[sessions.length - 1];
  const first = night[0];
  const last = night[night.length - 1];
  // Bedtime: when "In Bed" began, if the phone recorded it around this night; else falling asleep
  const inBed = samples
    .filter((s) => s.kind === "inbed" && s.end >= first.start - 4 * 3600e3 && s.start <= last.end)
    .sort((a, b) => a.start - b.start)[0];
  const bed = inBed && inBed.start < first.start ? inBed.startWall : first.startWall;
  return {
    date: last.endWall.date,
    nightOf: nightOfBedtime(bed.date, bed.minutes),
    hours: Math.round((total(night) / 3600e3) * 10) / 10,
    bedtime: hhmm(bed.minutes),
    wake: hhmm(last.endWall.minutes),
  };
}

// "Tue, Oct 20" and "11:02 PM" for the Shortcut's reply
export function dayLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
export function timeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
