// Test double for a Durable Object's SQLite storage, backed by Node's built-in
// SQLite. Mirrors the parts LibraryStore uses: `sql.exec` returning a cursor,
// and `transactionSync`, which rolls back when its callback throws.

import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { SqlCursorLike, SqlStorageLike } from "../server/library-store";

export function sqliteStorage(): SqlStorageLike & { close(): void } {
  const db = new DatabaseSync(":memory:");
  db.exec("pragma foreign_keys = on");
  const totalChanges = db.prepare("select total_changes() as n");
  let depth = 0;

  return {
    sql: {
      exec(query: string, ...bindings: unknown[]): SqlCursorLike {
        if (/^\s*(begin|commit|rollback|savepoint|release)\b/i.test(query)) {
          throw new Error("Transaction statements are not allowed; use transactionSync().");
        }
        const before = Number(totalChanges.get()?.n);
        const statement = db.prepare(query);
        statement.setReturnArrays(true);
        const rows = statement.all(...(bindings as SQLInputValue[])) as unknown as unknown[][];
        const after = Number(totalChanges.get()?.n);
        return {
          columnNames: statement.columns().map((column) => column.name),
          raw: () => rows,
          rowsRead: rows.length,
          rowsWritten: after - before,
        };
      },
    },
    transactionSync<T>(callback: () => T): T {
      const savepoint = `sp_${depth++}`;
      db.exec(`savepoint ${savepoint}`);
      try {
        const result = callback();
        db.exec(`release ${savepoint}`);
        return result;
      } catch (err) {
        db.exec(`rollback to ${savepoint}`);
        db.exec(`release ${savepoint}`);
        throw err;
      } finally {
        depth--;
      }
    },
    close: () => db.close(),
  };
}
