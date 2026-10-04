import { readFile } from "node:fs/promises";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (add it to .env.local).");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");

try {
  await sql.unsafe(schema);
  console.log("Database schema is up to date.");
} finally {
  await sql.end();
}
