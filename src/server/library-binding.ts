/// <reference types="@cloudflare/workers-types" />

// Decides where `env.DB` (the handle the library code queries) points.
//
// The library is moving from D1 to the LibraryDO Durable Object. While both
// exist, D1 keeps serving until the LIBRARY_STORE secret is set to "do"; with no
// D1 binding at all, the Durable Object is the only store.

import { durableDatabase, type SqlRpc } from "../lib/durable-db";
import type { LibraryDO } from "./library-do";

export const LIBRARY_INSTANCE = "library";

export interface LibraryBindings {
  LIBRARY_DO?: DurableObjectNamespace<LibraryDO>;
  LIBRARY_STORE?: string;
  DB?: unknown;
  [key: string]: unknown;
}

export function libraryStub(env: LibraryBindings): DurableObjectStub<LibraryDO> | null {
  if (!env.LIBRARY_DO) return null;
  return env.LIBRARY_DO.get(env.LIBRARY_DO.idFromName(LIBRARY_INSTANCE));
}

export function servedByDurableObject(env: LibraryBindings): boolean {
  return Boolean(env.LIBRARY_DO) && (env.LIBRARY_STORE === "do" || !env.DB);
}

/** The env the app sees: same bindings, with DB pointing at the active store. */
export function withLibrary<E extends LibraryBindings>(env: E): E {
  const stub = servedByDurableObject(env) ? libraryStub(env) : null;
  if (!stub) return env;
  return { ...env, DB: durableDatabase(stub as unknown as SqlRpc) };
}
