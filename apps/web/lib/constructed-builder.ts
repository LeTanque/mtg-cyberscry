import { pool } from "@cyberscry/database";
import { searchScryfall, type ScryfallCard } from "@/lib/mtg";
import { askDeckAssistant } from "@/lib/deck-assistant";
import { saveCard } from "@/lib/commander-builder";

export type ConstructedFormat = "standard" | "modern" | "legacy" | "vintage" | "pauper" | "casual";

const basicNames: Record<string, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

function formatQuery(format: ConstructedFormat) {
  return format === "casual" ? "game:paper -is:funny" : `f:${format} -is:funny`;
}

function colorQuery(colors: string[]) {
  return colors.length ? `id<=${colors.join("")}` : "";
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

function selectCards(plan: string[], candidates: ScryfallCard[], count: number) {
  const byName = new Map(candidates.map((card) => [card.name.toLowerCase(), card]));
  const selected: ScryfallCard[] = [];
  const copies = new Map<string, number>();
  for (const name of plan) {
    if (selected.length >= count) break;
    const card = byName.get(name.toLowerCase());
    const key = card?.name.toLowerCase();
    if (card && key && (copies.get(key) ?? 0) < 4) {
      selected.push(card);
      copies.set(key, (copies.get(key) ?? 0) + 1);
    }
  }
  for (const card of candidates) {
    if (selected.length >= count) break;
    const key = card.name.toLowerCase();
    if ((copies.get(key) ?? 0) < 4) {
      selected.push(card);
      copies.set(key, (copies.get(key) ?? 0) + 1);
    }
  }
  return selected.slice(0, count);
}

async function findBasics(format: ConstructedFormat, colors: string[]) {
  const preferredColors = colors.length ? colors : ["W", "U", "B", "R", "G"];
  const query = formatQuery(format);
  const cards = await Promise.all(
    preferredColors.map(async (color) => {
      const result = await searchScryfall(`${query} !"${basicNames[color]}"`, 1);
      return result[0];
    }),
  );
  return cards.filter((card): card is ScryfallCard => Boolean(card));
}

export async function createConstructedDeck(input: {
  name: string;
  format: ConstructedFormat;
  budgetCents: number | null;
  theme: string | null;
  colors: string[];
}) {
  const query = [formatQuery(input.format), colorQuery(input.colors), "-t:land"].filter(Boolean).join(" ");
  const spellCandidates = dedupe(await searchScryfall(query, 120));
  if (spellCandidates.length < 36) throw new Error(`Not enough legal ${input.format} cards were found to build this deck.`);

  const ownedNames = new Set<string>();
  let assistantSummary: string | null = null;
  let assistantUsed = false;
  let spells = selectCards([], spellCandidates, 36);
  try {
    const plan = await askDeckAssistant({
      format: input.format,
      candidates: spellCandidates,
      ownedNames,
      budgetCents: input.budgetCents,
      theme: input.theme,
      colors: input.colors,
      targetNonlandCount: 36,
    });
    if (plan) {
      spells = selectCards(plan.cardNames, spellCandidates, 36);
      assistantSummary = plan.summary.slice(0, 700);
      assistantUsed = true;
    }
  } catch (error) {
    console.error("Deck assistant fallback:", error instanceof Error ? error.message : error);
  }

  const basics = await findBasics(input.format, input.colors);
  if (!basics.length) throw new Error(`No legal basic lands were found for ${input.format}.`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const description = assistantUsed
      ? `AI-assisted ${input.format} build. ${assistantSummary}`
      : `Generated legal ${input.format} deck using the local Scryfall fallback.`;
    const deck = await client.query<{ id: string }>(
      "INSERT INTO decks (name,format,target_budget_cents,description) VALUES ($1,$2,$3,$4) RETURNING id",
      [input.name, input.format, input.budgetCents, description],
    );
    for (const card of spells) {
      const cardId = await saveCard(client, card);
      await client.query(
        "INSERT INTO deck_cards (deck_id,card_id,quantity,section) VALUES ($1,$2,1,'mainboard') ON CONFLICT (deck_id,card_id,section) DO UPDATE SET quantity=deck_cards.quantity+EXCLUDED.quantity,updated_at=now()",
        [deck.rows[0].id, cardId],
      );
    }
    const basicTotal = 60 - spells.length;
    for (let index = 0; index < basics.length; index++) {
      const card = basics[index];
      const quantity = Math.floor(basicTotal / basics.length) + (index < basicTotal % basics.length ? 1 : 0);
      if (quantity <= 0) continue;
      const cardId = await saveCard(client, card);
      await client.query(
        "INSERT INTO deck_cards (deck_id,card_id,quantity,section) VALUES ($1,$2,$3,'mainboard') ON CONFLICT DO NOTHING",
        [deck.rows[0].id, cardId, quantity],
      );
    }
    await client.query("COMMIT");
    return deck.rows[0].id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
