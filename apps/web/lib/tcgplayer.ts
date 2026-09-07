import { query } from "@cyberscry/database";

const DEFAULT_KICKBACKS_URL =
  "https://kickbacks-api.tcgplayer.com/Kickbacks?api-version=1.0";
const CACHE_KEY = "tcgplayer-kickbacks";
const CACHE_TTL_MS = 60 * 60 * 1000;

export type TcgplayerKickback = {
  startDateTime: string | null;
  endDateTime: string | null;
  percent: string | null;
  productTypes: string[] | null;
  productLines: string[] | null;
};

export type TcgplayerKickbackStatus = TcgplayerKickback & {
  active: boolean;
  fetchedAt: string;
  stale: boolean;
};

type CacheRow = {
  payload: TcgplayerKickback;
  fetched_at: string | Date;
};

let memoryCache: TcgplayerKickbackStatus | null = null;
let memoryCacheExpiresAt = 0;

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeKickback(value: unknown): TcgplayerKickback {
  const source = value && typeof value === "object" ? value : {};
  const record = source as Record<string, unknown>;
  return {
    startDateTime: nullableString(record.startDateTime),
    endDateTime: nullableString(record.endDateTime),
    percent: nullableString(record.percent),
    productTypes: stringList(record.productTypes),
    productLines: stringList(record.productLines),
  };
}

function withStatus(
  kickback: TcgplayerKickback,
  fetchedAt: string,
  stale: boolean,
): TcgplayerKickbackStatus {
  return {
    ...kickback,
    active: Boolean(kickback.percent),
    fetchedAt,
    stale,
  };
}

async function readCachedKickback() {
  try {
    return (
      await query<CacheRow>(
        "SELECT payload, fetched_at FROM external_api_cache WHERE cache_key=$1",
        [CACHE_KEY],
      )
    ).rows[0];
  } catch {
    return undefined;
  }
}

async function writeCachedKickback(
  kickback: TcgplayerKickback,
  fetchedAt: string,
) {
  try {
    await query(
      `INSERT INTO external_api_cache (cache_key, payload, fetched_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (cache_key) DO UPDATE
       SET payload=EXCLUDED.payload, fetched_at=EXCLUDED.fetched_at`,
      [CACHE_KEY, JSON.stringify(kickback), fetchedAt],
    );
  } catch {
    // A live result is still useful if persistence is temporarily unavailable.
  }
}

export async function getTcgplayerKickbackStatus(): Promise<TcgplayerKickbackStatus> {
  if (memoryCache && Date.now() < memoryCacheExpiresAt) return memoryCache;

  const cached = await readCachedKickback();
  const cachedFetchedAt = cached
    ? new Date(cached.fetched_at).getTime()
    : Number.NaN;
  if (
    cached &&
    Number.isFinite(cachedFetchedAt) &&
    Date.now() - cachedFetchedAt < CACHE_TTL_MS
  ) {
    const result = withStatus(
      normalizeKickback(cached.payload),
      new Date(cachedFetchedAt).toISOString(),
      false,
    );
    memoryCache = result;
    memoryCacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return result;
  }

  const url =
    process.env.TCGPLAYER_KICKBACKS_URL?.trim() || DEFAULT_KICKBACKS_URL;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`TCGplayer kickbacks request failed (${response.status}).`);
    }
    const kickback = normalizeKickback(await response.json());
    const fetchedAt = new Date().toISOString();
    await writeCachedKickback(kickback, fetchedAt);
    const result = withStatus(kickback, fetchedAt, false);
    memoryCache = result;
    memoryCacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return result;
  } catch (error) {
    if (cached && Number.isFinite(cachedFetchedAt)) {
      return withStatus(
        normalizeKickback(cached.payload),
        new Date(cachedFetchedAt).toISOString(),
        true,
      );
    }
    throw error;
  }
}
