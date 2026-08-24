import pg from "pg";
export type { PoolClient } from "pg";

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var cyberscryPool: pg.Pool | undefined;
}

export const pool =
  global.cyberscryPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres@localhost:5432/mtg_cyberscry",
    max: process.env.NODE_ENV === "production" ? 10 : 4,
  });

if (process.env.NODE_ENV !== "production") global.cyberscryPool = pool;

export async function query<T extends pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return pool.query<T>(text, values);
}

export type LibraryCard = {
  id: string;
  external_id: string;
  name: string;
  set_code: string;
  set_name: string;
  mana_cost: string | null;
  type_line: string;
  oracle_text: string | null;
  image_url: string | null;
  commander_legal: boolean;
  price_usd_cents: number | null;
  quantity: number;
  foil_quantity: number;
  condition: string;
  location: string | null;
};
