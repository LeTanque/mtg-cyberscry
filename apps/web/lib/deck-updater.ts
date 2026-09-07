import { pool, type PoolClient } from "@cyberscry/database";
import { enrichCard, findScryfallCard, searchScryfall, type ScryfallCard } from "@/lib/mtg";
import { askDeckAssistant } from "@/lib/deck-assistant";
import { saveCard } from "@/lib/commander-builder";

type DeckRow = {
  id: string;
  name: string;
  format: string;
  description: string | null;
  target_budget_cents: number | null;
  commander_external_id: string | null;
  commander_name: string | null;
};

type CurrentCard = {
  name: string;
  quantity: number;
  section: string;
  color_identity: string[];
  type_line: string;
};

const basicNames: Record<string, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
  C: "Wastes",
};

function formatQuery(format: string) {
  return format === "casual" ? "game:paper -is:funny" : `f:${format} -is:funny`;
}

function identityQuery(colors: string[]) {
  return colors.length ? `id<=${colors.join("")}` : "id=c";
}

const scryfallIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loadCommander(externalId: string | null, name: string | null) {
  const scryfallId = externalId?.replace(/^scryfall:/, "");
  if (scryfallId && scryfallIdPattern.test(scryfallId)) {
    try {
      return await findScryfallCard(scryfallId);
    } catch {
      // Fall through to the name lookup for cards whose catalog ID is stale.
    }
  }
  return name ? (await enrichCard(name)) ?? undefined : undefined;
}

function dedupe(cards: ScryfallCard[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = card.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectCards(plan: string[], candidates: ScryfallCard[], count: number, singleton: boolean) {
  const byName = new Map(candidates.map((card) => [card.name.toLowerCase(), card]));
  const selected: ScryfallCard[] = [];
  const copies = new Map<string, number>();
  const add = (card: ScryfallCard) => {
    if (selected.length >= count) return;
    const key = card.name.toLowerCase();
    const maxCopies = singleton ? 1 : 4;
    if ((copies.get(key) ?? 0) >= maxCopies) return;
    selected.push(card);
    copies.set(key, (copies.get(key) ?? 0) + 1);
  };
  for (const name of plan) {
    const card = byName.get(name.toLowerCase());
    if (card) add(card);
  }
  for (const card of candidates) add(card);
  return selected;
}

function selectExactCards(plan: string[], candidates: ScryfallCard[], count: number, singleton: boolean) {
  const byName = new Map(candidates.map((card) => [card.name.toLowerCase(), card]));
  const selected: ScryfallCard[] = [];
  const copies = new Map<string, number>();
  for (const name of plan) {
    const card = byName.get(name.toLowerCase());
    if (!card) return null;
    const key = card.name.toLowerCase();
    const maxCopies = singleton ? 1 : 4;
    if ((copies.get(key) ?? 0) >= maxCopies) return null;
    selected.push(card);
    copies.set(key, (copies.get(key) ?? 0) + 1);
  }
  return selected.length === count ? selected : null;
}

type RequestedCard = { card: ScryfallCard; quantity: number };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findExplicitCardRequests(prompt: string, candidates: ScryfallCard[]): RequestedCard[] {
  return candidates.flatMap((card) => {
    const namePattern = card.name
      .trim()
      .split(/\s+/)
      .map(escapeRegExp)
      .join("\\s+");
    const match = prompt.match(
      new RegExp(`(?:^|\\D)(\\d{1,3})\\s*x\\s+${namePattern}s?(?=\\s|$|[,.;])`, "i"),
    );
    if (!match) return [];
    return [{ card, quantity: Number(match[1]) }];
  });
}

function selectCardsWithRequirements(
  plan: string[],
  candidates: ScryfallCard[],
  count: number,
  singleton: boolean,
  requirements: RequestedCard[],
) {
  const byName = new Map(candidates.map((card) => [card.name.toLowerCase(), card]));
  const selected: ScryfallCard[] = [];
  const copies = new Map<string, number>();
  const maxCopies = singleton ? 1 : 4;
  const add = (card: ScryfallCard) => {
    if (selected.length >= count) return;
    const key = card.name.toLowerCase();
    if ((copies.get(key) ?? 0) >= maxCopies) return;
    selected.push(card);
    copies.set(key, (copies.get(key) ?? 0) + 1);
  };
  for (const requirement of requirements) {
    for (let index = 0; index < requirement.quantity; index += 1) add(requirement.card);
  }
  for (const name of plan) {
    const card = byName.get(name.toLowerCase());
    if (card && !requirements.some((requirement) => requirement.card.name.toLowerCase() === card.name.toLowerCase())) add(card);
  }
  for (const card of candidates) add(card);
  return selected;
}

function ensurePackageChanged(selected: ScryfallCard[], candidates: ScryfallCard[], currentNames: Set<string>) {
  if (selected.some((card) => !currentNames.has(card.name.toLowerCase()))) return selected;
  const replacement = candidates.find((card) => !currentNames.has(card.name.toLowerCase()));
  return replacement ? [...selected.slice(0, -1), replacement] : selected;
}

function packageChangeSummary(currentCards: CurrentCard[], selected: ScryfallCard[], prompt: string, usedFallback: boolean, basicTotal: number) {
  const previous = new Map<string, number>();
  for (const card of currentCards) {
    if (card.section === "mainboard" && !card.type_line.includes("Land")) previous.set(card.name.toLowerCase(), (previous.get(card.name.toLowerCase()) ?? 0) + card.quantity);
  }
  const next = new Map<string, { name: string; quantity: number }>();
  for (const card of selected) {
    const key = card.name.toLowerCase();
    const existing = next.get(key);
    if (existing) existing.quantity += 1;
    else next.set(key, { name: card.name, quantity: 1 });
  }
  const added: string[] = [];
  const removed: string[] = [];
  for (const [key, card] of next) {
    const difference = card.quantity - (previous.get(key) ?? 0);
    if (difference > 0) added.push(`${difference}× ${card.name}`);
    if (difference < 0) removed.push(`${Math.abs(difference)}× ${card.name}`);
  }
  for (const card of currentCards) {
    if (card.section !== "mainboard" || card.type_line.includes("Land")) continue;
    const key = card.name.toLowerCase();
    if (!next.has(key)) removed.push(`${previous.get(key)}× ${card.name}`);
  }
  const mode = usedFallback ? "The agent was unavailable, so I applied a legal catalog update" : "Applied the agent update";
  const changes = [
    `${mode} for: ${prompt}`,
    added.length ? `Added ${added.slice(0, 6).join(", ")}.` : "No new nonland cards were added.",
    removed.length ? `Removed ${removed.slice(0, 6).join(", ")}.` : "No nonland cards were removed.",
    `The final package contains ${selected.length} nonland cards and ${basicTotal} basic lands.`,
  ];
  return changes.join(" ");
}

async function findBasics(format: string, colors: string[]) {
  const basicColors = colors.length ? colors : format === "commander" ? ["C"] : ["W", "U", "B", "R", "G"];
  const query = formatQuery(format);
  const cards = await Promise.all(
    basicColors.map(async (color) => {
      const result = await searchScryfall(`${query} !"${basicNames[color]}"`, 1);
      return result[0];
    }),
  );
  return cards.filter((card): card is ScryfallCard => Boolean(card));
}

async function insertCard(client: PoolClient, deckId: string, card: ScryfallCard, quantity: number) {
  if (quantity <= 0) return;
  const cardId = await saveCard(client, card);
  await client.query(
    `INSERT INTO deck_cards (deck_id,card_id,quantity,section) VALUES ($1,$2,$3,'mainboard')
     ON CONFLICT (deck_id,card_id,section) DO UPDATE SET quantity=EXCLUDED.quantity,updated_at=now()`,
    [deckId, cardId, quantity],
  );
}

export async function updateDeckWithAgent(deckId: string, prompt: string) {
  const deck = (await pool.query<DeckRow>(
    `SELECT d.id,d.name,d.format,d.description,d.target_budget_cents,c.external_id commander_external_id,c.name commander_name
     FROM decks d LEFT JOIN cards c ON c.id=d.commander_card_id WHERE d.id=$1`,
    [deckId],
  )).rows[0];
  if (!deck) throw new Error("Deck not found.");

  const currentCards = (await pool.query<CurrentCard>(
    `SELECT c.name,c.color_identity,c.type_line,dc.quantity,dc.section
     FROM deck_cards dc JOIN cards c ON c.id=dc.card_id WHERE dc.deck_id=$1 ORDER BY dc.section,c.name`,
    [deckId],
  )).rows;
  const commander = deck.format === "commander"
    ? await loadCommander(deck.commander_external_id, deck.commander_name)
    : undefined;
  if (deck.format === "commander" && (!commander || commander.legalities?.commander !== "legal")) {
    throw new Error("Choose a valid Commander before updating this deck.");
  }

  const colors = commander?.color_identity ?? [...new Set(currentCards.flatMap((card) => card.color_identity))];
  const spellQuery = [formatQuery(deck.format), identityQuery(colors), "-t:land"].filter(Boolean).join(" ");
  const catalogCandidates = await searchScryfall(spellQuery, 120);
  const commanderName = commander?.name.toLowerCase();
  const candidates = dedupe(catalogCandidates).filter((card) =>
    !card.type_line?.includes("Land") && card.name.toLowerCase() !== commanderName,
  );
  const targetNonlandCount = deck.format === "commander" ? 63 : 36;
  if (candidates.length < targetNonlandCount) {
    throw new Error(`Not enough legal ${deck.format} cards were found to update this deck.`);
  }
  const ownedNames = new Set((await pool.query<{ name: string }>(
    `SELECT DISTINCT c.name FROM collection_items ci JOIN cards c ON c.id=ci.card_id WHERE ci.quantity>0`,
  )).rows.map((row) => row.name.toLowerCase()));
  let plan: Awaited<ReturnType<typeof askDeckAssistant>> = null;
  let usedFallback = false;
  try {
    plan = await askDeckAssistant({
      format: deck.format,
      commander,
      candidates,
      ownedNames,
      budgetCents: deck.target_budget_cents,
      theme: prompt,
      colors,
      targetNonlandCount,
      currentDeck: currentCards.map(({ name, quantity, section }) => ({ name, quantity, section })),
    });
  } catch (error) {
    console.error("Deck update agent fallback:", error instanceof Error ? error.message : error);
    usedFallback = true;
  }
  if (!plan) usedFallback = true;
  const currentNames = new Set(currentCards.filter((card) => card.section === "mainboard" && !card.type_line.includes("Land")).map((card) => card.name.toLowerCase()));
  const fallbackCandidates = usedFallback
    ? candidates.toSorted((left, right) => Number(currentNames.has(left.name.toLowerCase())) - Number(currentNames.has(right.name.toLowerCase())))
    : candidates;
  const explicitRequests = findExplicitCardRequests(prompt, candidates);
  const singleton = deck.format === "commander";
  const invalidRequest = explicitRequests.find((request) => request.quantity > (singleton ? 1 : 4));
  if (invalidRequest) {
    throw new Error(`${invalidRequest.card.name} is limited to ${singleton ? "one copy" : "four copies"} in this format.`);
  }
  if (explicitRequests.reduce((total, request) => total + request.quantity, 0) > targetNonlandCount) {
    throw new Error("The requested card quantities exceed the deck's available nonland slots.");
  }
  let selected = explicitRequests.length
    ? selectCardsWithRequirements(
        usedFallback ? [] : plan?.cardNames ?? [],
        usedFallback ? fallbackCandidates : candidates,
        targetNonlandCount,
        singleton,
        explicitRequests,
      )
    : usedFallback
      ? selectCards([], fallbackCandidates, targetNonlandCount, singleton)
      : selectExactCards(plan?.cardNames ?? [], candidates, targetNonlandCount, singleton);
  if (!selected) {
    usedFallback = true;
    selected = selectCardsWithRequirements([], fallbackCandidates, targetNonlandCount, singleton, explicitRequests);
  }
  if (selected.length < targetNonlandCount) throw new Error("Not enough legal cards were available to update this deck.");
  selected = ensurePackageChanged(selected, fallbackCandidates, currentNames);
  const basics = await findBasics(deck.format, colors);
  if (!basics.length) throw new Error(`No legal basic lands were found for ${deck.format}.`);
  const basicTotal = (deck.format === "commander" ? 99 : 60) - selected.length;
  const summary = packageChangeSummary(currentCards, selected, prompt, usedFallback, basicTotal);
  const description = `${deck.description?.trim() ? `${deck.description.trim()} ` : ""}Agent update: ${summary.slice(0, 650)}`.slice(0, 800);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM deck_cards WHERE deck_id=$1 AND section='mainboard'", [deckId]);
    const counts = new Map<string, { card: ScryfallCard; quantity: number }>();
    for (const card of selected) {
      const key = card.name.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.quantity += 1;
      else counts.set(key, { card, quantity: 1 });
    }
    for (const { card, quantity } of counts.values()) await insertCard(client, deckId, card, quantity);
    for (let index = 0; index < basics.length; index += 1) {
      const quantity = Math.floor(basicTotal / basics.length) + (index < basicTotal % basics.length ? 1 : 0);
      await insertCard(client, deckId, basics[index], quantity);
    }
    await client.query("UPDATE decks SET description=$2,updated_at=now() WHERE id=$1", [deckId, description]);
    await client.query("COMMIT");
    return { summary: summary.slice(0, 700), cardCount: selected.length + basicTotal, usedFallback };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
