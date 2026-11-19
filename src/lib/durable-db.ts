// A database handle backed by the LibraryDO Durable Object, shaped like the
// prepared-statement API the library code already uses:
//
//   db.prepare(sql).bind(...values).first() / .all() / .run() / .raw()
//   db.batch([stmt, stmt])   ← one transaction: all commit, or none do
//
// Each call is one RPC to the Durable Object, which runs it against its own
// SQLite storage. Kept free of Workers runtime types so the Next app, the
// Worker, and the tests can all import it.

/** One statement as sent to the Durable Object. */
export interface WireStatement {
  sql: string;
  params?: unknown[];
}
/** One statement's outcome as returned by the Durable Object. */
export interface WireResult {
  columns: string[];
  rows: unknown[][];
  changes: number;
  lastRowId: number;
  rowsRead: number;
  rowsWritten: number;
}
/** The RPC surface this needs from the Durable Object stub. */
export interface SqlRpc {
  query(statement: WireStatement): WireResult | Promise<WireResult>;
  batch(statements: WireStatement[]): WireResult[] | Promise<WireResult[]>;
}

export interface QueryMeta {
  changes: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
  changed_db: boolean;
  duration: number;
}
export interface QueryResult<T = Record<string, unknown>> {
  success: true;
  meta: QueryMeta;
  results: T[];
}

const WIRE = Symbol("wire");

export interface DurableStatement {
  bind(...values: unknown[]): DurableStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<QueryResult<T>>;
  run<T = Record<string, unknown>>(): Promise<QueryResult<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
  /** @internal what batch() sends */
  [WIRE](): WireStatement;
}

export interface DurableDatabase {
  prepare(sql: string): DurableStatement;
  batch<T = Record<string, unknown>>(statements: DurableStatement[]): Promise<QueryResult<T>[]>;
}

function toResult<T>(wire: WireResult, duration: number): QueryResult<T> {
  const results = wire.rows.map((row) => {
    const record: Record<string, unknown> = {};
    wire.columns.forEach((column, i) => {
      record[column] = row[i];
    });
    return record as T;
  });
  return {
    success: true,
    meta: {
      changes: wire.changes,
      last_row_id: wire.lastRowId,
      rows_read: wire.rowsRead,
      rows_written: wire.rowsWritten,
      changed_db: wire.rowsWritten > 0,
      duration,
    },
    results,
  };
}

export function durableDatabase(rpc: SqlRpc): DurableDatabase {
  function statement(sql: string, params: unknown[]): DurableStatement {
    async function execute<T>(): Promise<QueryResult<T>> {
      const started = Date.now();
      return toResult<T>(await rpc.query({ sql, params }), Date.now() - started);
    }
    return {
      bind: (...values) => statement(sql, values),
      async first<T>(column?: string) {
        const { results } = await execute<Record<string, unknown>>();
        const row = results[0];
        if (!row) return null;
        if (column === undefined) return row as T;
        if (!(column in row)) throw new Error(`Column not found: ${column}`);
        return row[column] as T;
      },
      all: <T>() => execute<T>(),
      run: <T>() => execute<T>(),
      async raw<T>() {
        return (await rpc.query({ sql, params })).rows as T[];
      },
      [WIRE]: () => ({ sql, params }),
    };
  }

  return {
    prepare: (sql) => statement(sql, []),
    async batch<T>(statements: DurableStatement[]) {
      const started = Date.now();
      const wire = await rpc.batch(statements.map((s) => s[WIRE]()));
      const duration = Date.now() - started;
      return wire.map((result) => toResult<T>(result, duration));
    },
  };
}
