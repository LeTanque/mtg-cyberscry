export type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  mana_cost?: string;
  cmc?: number;
  colors?: string[];
  color_identity: string[];
  rarity?: string;
  prices?: { usd?: string | null };
  legalities?: { commander?: string };
  oracle_text?: string;
  type_line?: string;
  collector_number?: string;
  image_uris?: { normal?: string };
  card_faces?: { image_uris?: { normal?: string } }[];
};

export async function enrichCard(name: string): Promise<ScryfallCard | null> {
  try {
    const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`, {
      headers: { "User-Agent": "MTG-Cyberscry/0.1", Accept: "application/json" },
      next: { revalidate: 60 * 60 * 12 },
    });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

async function scryfallRequest(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "MTG-Cyberscry/0.1", Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Card catalog request failed (${response.status}).`);
  return response.json();
}

export async function findCommander(name: string): Promise<ScryfallCard> {
  const card = await scryfallRequest(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`) as ScryfallCard;
  const canLead = card.type_line?.includes("Legendary Creature") || card.oracle_text?.toLowerCase().includes("can be your commander");
  if (card.legalities?.commander !== "legal" || !canLead) throw new Error(`${card.name} cannot be used as a Commander.`);
  return card;
}

export async function findScryfallCard(id: string): Promise<ScryfallCard> {
  return scryfallRequest(`https://api.scryfall.com/cards/${encodeURIComponent(id)}`) as Promise<ScryfallCard>;
}

export async function searchScryfallPrintings(name:string, page = 1):Promise<{ cards: ScryfallCard[]; hasMore: boolean }> {
  const safeName=name.replace(/["\\]/g," ").trim().slice(0,80);
  const pageSize = 16;
  const start = (page - 1) * pageSize;
  const cards: ScryfallCard[] = [];
  let sourcePage = 1;
  let hasMore = true;
  while (cards.length < start + pageSize && hasMore) {
    const url=new URL("https://api.scryfall.com/cards/search");
    url.searchParams.set("q",`name:"${safeName}"`);
    url.searchParams.set("order","released");
    url.searchParams.set("dir","desc");
    url.searchParams.set("unique","prints");
    url.searchParams.set("page",String(sourcePage));
    const result=await scryfallRequest(url.toString()) as {data:ScryfallCard[];has_more?:boolean};
    cards.push(...result.data);
    hasMore = Boolean(result.has_more && result.data.length);
    sourcePage += 1;
  }
  return {cards:cards.slice(start,start + pageSize),hasMore:start + pageSize < cards.length || hasMore};
}

export async function searchScryfall(query: string, limit = 80): Promise<ScryfallCard[]> {
  const url = new URL("https://api.scryfall.com/cards/search");
  url.searchParams.set("q", query);
  url.searchParams.set("order", "edhrec");
  url.searchParams.set("unique", "cards");
  const result = await scryfallRequest(url.toString()) as { data: ScryfallCard[] };
  return result.data.slice(0, limit);
}

export type ScryfallPage = {
  data: ScryfallCard[];
  has_more: boolean;
  total_cards: number;
};

export async function searchScryfallPage(
  query: string,
  order: "name" | "color",
  page: number,
): Promise<ScryfallPage> {
  const url = new URL("https://api.scryfall.com/cards/search");
  url.searchParams.set("q", query);
  url.searchParams.set("order", order);
  url.searchParams.set("dir", "asc");
  url.searchParams.set("unique", "cards");
  url.searchParams.set("page", String(page));
  return scryfallRequest(url.toString()) as Promise<ScryfallPage>;
}

export async function getScryfallCreatureTypes(): Promise<string[]> {
  const response = await fetch("https://api.scryfall.com/catalog/creature-types", {
    headers: { "User-Agent": "MTG-Cyberscry/0.1", Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!response.ok) throw new Error(`Creature type catalog request failed (${response.status}).`);
  const result = await response.json() as { data: string[] };
  return result.data;
}
