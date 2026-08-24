import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pool } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const sql = await readFile(resolve(here, "../src/schema.sql"), "utf8");

try {
  await pool.query(sql);
  console.log("Database schema is up to date.");
} finally {
  await pool.end();
}
