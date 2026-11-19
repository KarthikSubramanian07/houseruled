/// <reference types="@cloudflare/workers-types" />

// LibraryDO - the community library's database: one SQLite-backed Durable
// Object (the instance named "library") holding saved custom games, public
// profiles, favorites, and per-player write auth.
//
// The app never talks SQL to it directly. src/lib/durable-db.ts wraps the stub
// in the prepare/bind/first/all/run/batch interface the library code is written
// against, and each of those calls lands on one of the RPC methods below.

import { DurableObject } from "cloudflare:workers";
import { LibraryStore, type LibrarySnapshot, type LibraryTable, type SqlResult, type SqlStatement, type TableRows } from "./library-store";

export class LibraryDO extends DurableObject<unknown> {
  private readonly store: LibraryStore;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.store = new LibraryStore(ctx.storage);
    // Schema setup only (synchronous SQL, so nothing can run before it
    // finishes); a no-op once the latest migration is recorded.
    this.store.migrate();
  }

  query(statement: SqlStatement): SqlResult {
    return this.store.query(statement);
  }

  batch(statements: SqlStatement[]): SqlResult[] {
    return this.store.batch(statements);
  }

  counts(): Record<LibraryTable, number> {
    return this.store.counts();
  }

  snapshot(): LibrarySnapshot {
    return this.store.snapshot();
  }

  replaceAll(snapshot: Partial<Record<string, TableRows>>): Record<LibraryTable, number> {
    return this.store.replaceAll(snapshot);
  }
}
