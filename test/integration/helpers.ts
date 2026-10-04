import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Integration tests need a disposable Postgres database. They only run when TEST_DATABASE_URL
 * is set (never DATABASE_URL), because every test truncates all tables.
 */
export const TEST_DB = process.env.TEST_DATABASE_URL;

export async function connectTestDb() {
  process.env.DATABASE_URL = TEST_DB;
  const { sql } = await import("@/lib/db");
  const schema = await readFile(path.resolve(import.meta.dirname, "../../db/schema.sql"), "utf8");
  await sql.unsafe(schema);
  return {
    sql,
    reset: () => sql`truncate media, posts restart identity cascade`,
  };
}
