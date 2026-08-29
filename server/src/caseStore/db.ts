import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const DB_PATH = process.env.CASE_STORE_DB_PATH ?? join(import.meta.dirname, "../../warden.sqlite");

export function openDb(path: string = DB_PATH): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  const schema = readFileSync(join(import.meta.dirname, "schema.sql"), "utf8");
  db.exec(schema);
  return db;
}
