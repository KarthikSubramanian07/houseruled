/// <reference types="@cloudflare/workers-types" />

// Gives the app its library database: `env.DB`, the handle src/lib/library.ts
// queries, backed by the LibraryDO Durable Object.

import { durableDatabase, type SqlRpc } from "../lib/durable-db";
import type { LibraryDO } from "./library-do";

export const LIBRARY_INSTANCE = "library";

export interface LibraryBindings {
  LIBRARY_DO?: DurableObjectNamespace<LibraryDO>;
  [key: string]: unknown;
}

export function libraryStub(env: LibraryBindings): DurableObjectStub<LibraryDO> | null {
  if (!env.LIBRARY_DO) return null;
  return env.LIBRARY_DO.get(env.LIBRARY_DO.idFromName(LIBRARY_INSTANCE));
}

/** The env the app sees: the same bindings plus DB, the library database. */
export function withLibrary<E extends LibraryBindings>(env: E): E {
  const stub = libraryStub(env);
  if (!stub) return env;
  return { ...env, DB: durableDatabase(stub as unknown as SqlRpc) };
}
