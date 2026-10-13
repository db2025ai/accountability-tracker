import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Morning nudge + evening "N items left today" — sends only when a reminder time has come
crons.interval("push reminders", { minutes: 15 }, internal.pushNode.sendReminders, {});

export default crons;
