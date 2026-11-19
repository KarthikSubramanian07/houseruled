// The library's SQL engine, independent of the Workers runtime.
//
// LibraryDO (library-do.ts) hands this its SQLite storage; the tests hand it an
// in-memory SQLite with the same shape. Everything here is synchronous, so each
// call is atomic inside the Durable Object: no other request can interleave.

import { LIBRARY_MIGRATIONS, type Migration } from "./library-migrations";

// ── The slice of Durable Object SQLite storage this needs ─────────────────────
export interface SqlCursorLike {
  readonly columnNames: string[];
  raw(): Iterable<unknown[]>;
  readonly rowsRead: number;
  readonly rowsWritten: number;
}
export interface SqlLike {
  exec(query: string, ...bindings: unknown[]): SqlCursorLike;
}
export interface SqlStorageLike {
  sql: SqlLike;
  /** Runs `callback` in a transaction; a throw rolls everything back. */
  transactionSync<T>(callback: () => T): T;
}

// ── Wire shapes (plain data, safe to send over Durable Object RPC) ────────────
export interface SqlStatement {
  sql: string;
  params?: unknown[];
}
export interface SqlResult {
  columns: string[];
  /** Row values in `columns` order. */
  rows: unknown[][];
  changes: number;
  lastRowId: number;
  rowsRead: number;
  rowsWritten: number;
}

/** Tables that hold library data, parents before children. */
export const LIBRARY_TABLES = ["users", "custom_games", "favorites", "player_auth"] as const;
export type LibraryTable = (typeof LIBRARY_TABLES)[number];
export type TableRows = Record<string, unknown>[];
export type LibrarySnapshot = Record<LibraryTable, TableRows>;

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function toBinding(value: unknown): unknown {
  if (value === undefined) throw new Error("Cannot bind undefined; use null.");
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

export class LibraryStore {
  constructor(private readonly storage: SqlStorageLike) {}

  /** Apply any migrations newer than the recorded version. Safe to call often. */
  migrate(migrations: Migration[] = LIBRARY_MIGRATIONS): number {
    const { sql } = this.storage;
    sql.exec(
      "create table if not exists schema_migrations (version integer primary key, name text not null, applied_at text not null default (datetime('now')))",
    );
    let current = 0;
    for (const row of sql.exec("select coalesce(max(version), 0) from schema_migrations").raw()) current = Number(row[0]);
    const pending = migrations.filter((m) => m.version > current).sort((a, b) => a.version - b.version);
    for (const migration of pending) {
      this.storage.transactionSync(() => {
        for (const statement of migration.statements) sql.exec(statement);
        sql.exec("insert into schema_migrations (version, name) values (?, ?)", migration.version, migration.name);
      });
      current = migration.version;
    }
    return current;
  }

  /** Run one statement. */
  query(statement: SqlStatement): SqlResult {
    const { sql } = this.storage;
    const cursor = sql.exec(statement.sql, ...(statement.params ?? []).map(toBinding));
    const rows = [...cursor.raw()];
    const columns = cursor.columnNames;
    const rowsRead = cursor.rowsRead;
    const rowsWritten = cursor.rowsWritten;
    let changes = 0;
    let lastRowId = 0;
    // changes() keeps its value across reads, so only trust it after a write.
    if (rowsWritten > 0) {
      for (const row of sql.exec("select changes(), last_insert_rowid()").raw()) {
        changes = Number(row[0]);
        lastRowId = Number(row[1]);
      }
    }
    return { columns, rows, changes, lastRowId, rowsRead, rowsWritten };
  }

  /** Run statements in order as one transaction: all commit, or none do. */
  batch(statements: SqlStatement[]): SqlResult[] {
    return this.storage.transactionSync(() => statements.map((statement) => this.query(statement)));
  }

  /** Every library row, with rowids (list ordering depends on them). */
  snapshot(): LibrarySnapshot {
    const out = {} as LibrarySnapshot;
    for (const table of LIBRARY_TABLES) {
      const result = this.query({ sql: `select rowid, * from ${table} order by rowid` });
      out[table] = result.rows.map((row) => Object.fromEntries(result.columns.map((column, i) => [column, row[i]])));
    }
    return out;
  }

  counts(): Record<LibraryTable, number> {
    const out = {} as Record<LibraryTable, number>;
    for (const table of LIBRARY_TABLES) {
      out[table] = Number(this.query({ sql: `select count(*) from ${table}` }).rows[0][0]);
    }
    return out;
  }

  /**
   * Replace the library's contents with `snapshot`, in one transaction. Running
   * it again with the same input leaves the same rows, so it is safe to repeat.
   */
  replaceAll(snapshot: Partial<Record<string, TableRows>>): Record<LibraryTable, number> {
    for (const table of Object.keys(snapshot)) {
      if (!(LIBRARY_TABLES as readonly string[]).includes(table)) throw new Error(`Unknown table: ${table}`);
    }
    return this.storage.transactionSync(() => {
      const { sql } = this.storage;
      // Children first, so clearing users can't null out creator ids mid-way.
      for (const table of [...LIBRARY_TABLES].reverse()) sql.exec(`delete from ${table}`);
      for (const table of LIBRARY_TABLES) {
        for (const row of snapshot[table] ?? []) {
          const columns = Object.keys(row);
          if (columns.length === 0) continue;
          for (const column of columns) {
            if (!IDENTIFIER.test(column)) throw new Error(`Bad column name in ${table}: ${column}`);
          }
          sql.exec(
            `insert into ${table} (${columns.join(", ")}) values (${columns.map(() => "?").join(", ")})`,
            ...columns.map((column) => toBinding(row[column])),
          );
        }
      }
      return this.counts();
    });
  }
}
