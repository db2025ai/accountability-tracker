import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Morning nudge + evening "N items left today" — sends only when a reminder time has come
crons.interval("push reminders", { minutes: 15 }, internal.pushNode.sendReminders, {});

// Learning ledger: Goodreads shelves and Spotify listening, daily at 10:00 UTC (5-6 AM Eastern)
crons.daily("learning sync", { hourUTC: 10, minuteUTC: 0 }, internal.learningSync.run, {});

export default crons;
