import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = import("node:sqlite").DatabaseSync;
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from 'node:url';

/** Minimal D1-compatible shim over node:sqlite, enough for our queries. Not a perf/behaviour clone of D1. */
class Stmt {
  constructor(private db: DatabaseSync, public sql: string, public args: unknown[] = []) {}
  bind(...a: unknown[]) { return new Stmt(this.db, this.sql, a); }
  private run0() { return this.db.prepare(this.sql).run(...(this.args as any[])); }
  async first<T = unknown>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...(this.args as any[])) as T) ?? null;
  }
  async all<T = unknown>() { return { results: this.db.prepare(this.sql).all(...(this.args as any[])) as T[], success: true }; }
  async run() { const r = this.run0(); return { success: true, meta: { changes: Number(r.changes) } }; }
}

export function makeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const dir = fileURLToPath(new URL("../../migrations", import.meta.url));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, f), "utf8"));
  const d1 = {
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: Stmt[]) {
      db.exec("BEGIN");
      try { const out = []; for (const s of stmts) out.push(await s.run()); db.exec("COMMIT"); return out; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    },
  };
  return { db, d1: d1 as unknown as D1Database };
}
