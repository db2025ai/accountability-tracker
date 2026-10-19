// Every public function the app calls takes `appKey`, which must match the APP_KEY env var.
// Without it, the deployment URL alone (it's in this public repo) would let anyone read and
// change all the data. The Claude connector has its own key (MCP_TOKEN, http.ts).
import { ConvexError } from "convex/values";

// Constant-time compare, so a key can't be guessed by timing
export function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Throws "Unauthorized" unless appKey matches; refuses everything if APP_KEY is unset or short
export function requireAppKey(appKey: string | undefined) {
  const expected = process.env.APP_KEY;
  if (!expected || expected.length < 24 || !appKey || !sameSecret(appKey, expected)) {
    throw new ConvexError("Unauthorized");
  }
}
