/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as functions from "../functions.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as journal from "../journal.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_reminders from "../lib/reminders.js";
import type * as lib_sleep from "../lib/sleep.js";
import type * as nutrition from "../nutrition.js";
import type * as plans from "../plans.js";
import type * as push from "../push.js";
import type * as pushNode from "../pushNode.js";
import type * as workouts from "../workouts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  functions: typeof functions;
  health: typeof health;
  http: typeof http;
  journal: typeof journal;
  "lib/auth": typeof lib_auth;
  "lib/reminders": typeof lib_reminders;
  "lib/sleep": typeof lib_sleep;
  nutrition: typeof nutrition;
  plans: typeof plans;
  push: typeof push;
  pushNode: typeof pushNode;
  workouts: typeof workouts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
