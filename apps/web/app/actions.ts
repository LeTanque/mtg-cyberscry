"use server";

import { query } from "@cyberscry/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { findScryfallCard } from "@/lib/mtg";
import { createCommanderDeck } from "@/lib/commander-builder";
import { createConstructedDeck } from "@/lib/constructed-builder";
import { updateDeckWithAgent as applyDeckAgentUpdate } from "@/lib/deck-updater";
import { deckCardQuantityLimit } from "@/lib/deck-quantity";

const idSchema = z.string().min(1).max(200);

export async function addCardToLibrary(formData: FormData) {
  const externalId = idSchema.parse(formData.get("externalId"));
  const quantity = z.coerce
    .number()
    .int()
    .min(1)
    .max(999)
    .parse(formData.get("quantity") ?? 1);
  const card = await findScryfallCard(externalId);
  const price = card.prices?.usd
    ? Math.round(Number(card.prices.usd) * 100)
    : null;
  const image =
    card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
  const saved = await query<{ id: string }>(
    `INSERT INTO cards (external_id,name,set_code,set_name,collector_number,mana_cost,mana_value,type_line,oracle_text,colors,color_identity,rarity,image_url,commander_legal,price_usd_cents,price_checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
     ON CONFLICT (external_id) DO UPDATE SET price_usd_cents=EXCLUDED.price_usd_cents, price_checked_at=now(), image_url=EXCLUDED.image_url, updated_at=now()
     RETURNING id`,
    [
      `scryfall:${card.id}`,
      card.name,
      card.set.toUpperCase(),
      card.set_name,
      card.collector_number ?? null,
      card.mana_cost ?? null,
      card.cmc ?? null,
      card.type_line ?? "",
      card.oracle_text ?? null,
      card.colors ?? [],
      card.color_identity,
      card.rarity ?? null,
      image,
      card.legalities?.commander === "legal",
      price,
    ],
  );
  await query(
    `INSERT INTO collection_items (card_id,quantity,location) VALUES ($1,$2,'Main collection')
     ON CONFLICT (card_id,condition,location) DO UPDATE SET quantity=collection_items.quantity + EXCLUDED.quantity, updated_at=now()`,
    [saved.rows[0].id, quantity],
  );
  revalidatePath("/library");
  revalidatePath("/");
}

export async function addScryfallCardToLibrary(formData: FormData) {
  const scryfallId = z.string().uuid().parse(formData.get("scryfallId"));
  const card = await findScryfallCard(scryfallId);
  const price = card.prices?.usd
    ? Math.round(Number(card.prices.usd) * 100)
    : null;
  const image =
    card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
  const saved = await query<{ id: string }>(
    `INSERT INTO cards (external_id,name,set_code,set_name,collector_number,mana_cost,mana_value,type_line,oracle_text,colors,color_identity,rarity,image_url,commander_legal,price_usd_cents,price_checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
     ON CONFLICT (external_id) DO UPDATE SET price_usd_cents=EXCLUDED.price_usd_cents,price_checked_at=now(),image_url=EXCLUDED.image_url,oracle_text=EXCLUDED.oracle_text,colors=EXCLUDED.colors,color_identity=EXCLUDED.color_identity,commander_legal=EXCLUDED.commander_legal,updated_at=now()
     RETURNING id`,
    [
      `scryfall:${card.id}`,
      card.name,
      card.set.toUpperCase(),
      card.set_name,
      card.collector_number ?? null,
      card.mana_cost ?? null,
      card.cmc ?? null,
      card.type_line ?? "",
      card.oracle_text ?? null,
      card.colors ?? [],
      card.color_identity,
      card.rarity ?? null,
      image,
      card.legalities?.commander === "legal",
      price,
    ],
  );
  await query(
    `INSERT INTO collection_items (card_id,quantity,location) VALUES ($1,1,'Main collection')
     ON CONFLICT (card_id,condition,location) DO UPDATE SET quantity=collection_items.quantity+1,updated_at=now()`,
    [saved.rows[0].id],
  );
  revalidatePath("/commanders");
  revalidatePath("/library");
  revalidatePath("/decks");
  revalidatePath("/");
}

export type UpdateCollectionQuantityState = { saved?: boolean; error?: string };

export async function updateCollectionQuantity(
  _previousState: UpdateCollectionQuantityState,
  formData: FormData,
): Promise<UpdateCollectionQuantityState> {
  const parsed = z
    .object({
      itemId: z.string().uuid(),
      quantity: z.coerce.number().int().min(0).max(999),
    })
    .safeParse({
      itemId: formData.get("itemId"),
      quantity: formData.get("quantity"),
    });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Enter a valid quantity.",
    };
  try {
    if (parsed.data.quantity === 0)
      await query("DELETE FROM collection_items WHERE id=$1", [
        parsed.data.itemId,
      ]);
    else
      await query(
        "UPDATE collection_items SET quantity=$2, updated_at=now() WHERE id=$1",
        [parsed.data.itemId, parsed.data.quantity],
      );
    revalidatePath("/library");
    revalidatePath("/");
    return { saved: true };
  } catch {
    return { error: "The collection could not be updated." };
  }
}

export type CreateDeckState = { error?: string };

export async function createDeck(
  _previousState: CreateDeckState,
  formData: FormData,
): Promise<CreateDeckState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Give the deck a name.").max(100),
      format: z.enum([
        "commander",
        "standard",
        "modern",
        "legacy",
        "vintage",
        "pauper",
        "casual",
      ]),
      commanderName: z.string().trim().max(200).optional(),
      commanderId: z.string().uuid().optional(),
      budget: z.coerce.number().min(0).max(100000).optional(),
      theme: z.string().trim().max(800).optional(),
      colors: z.string().trim().max(20).optional(),
      autoBuild: z.enum(["true", "false"]).default("false"),
    })
    .safeParse({
      name: formData.get("name"),
      format: formData.get("format") ?? "commander",
      commanderName: formData.get("commanderName") || undefined,
      commanderId: formData.get("commanderId") || undefined,
      budget: formData.get("budget") || undefined,
      theme: formData.get("theme") || undefined,
      colors: formData.get("colors") || undefined,
      autoBuild: formData.get("autoBuild") || "false",
    });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Check the deck details.",
    };
  const {
    name,
    format,
    commanderName,
    commanderId,
    budget,
    theme,
    colors: rawColors,
    autoBuild: autoBuildValue,
  } = parsed.data;
  const requestedColors = rawColors
    ? new Set(rawColors.split(",").filter(Boolean))
    : new Set<string>();
  const colors = ["W", "U", "B", "R", "G"].filter((color) =>
    requestedColors.has(color),
  );
  if (colors.some((color) => !["W", "U", "B", "R", "G"].includes(color)))
    return { error: "Choose valid deck colors." };
  const autoBuild = autoBuildValue === "true";
  const budgetCents = budget == null ? null : Math.round(budget * 100);
  let deckId: string;
  try {
    if (autoBuild && format === "commander") {
      if (!commanderName || !commanderId)
        return {
          error:
            "Select a commander from the autocomplete suggestions before creating the deck.",
        };
      deckId = await createCommanderDeck({
        name,
        commanderName,
        commanderId,
        budgetCents,
        theme: theme ?? null,
        colors,
      });
    } else if (autoBuild && format !== "commander") {
      deckId = await createConstructedDeck({
        name,
        format,
        budgetCents,
        theme: theme ?? null,
        colors,
      });
    } else {
      const result = await query<{ id: string }>(
        "INSERT INTO decks (name,format,target_budget_cents) VALUES ($1,$2,$3) RETURNING id",
        [name, format, budgetCents],
      );
      deckId = result.rows[0].id;
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "The deck could not be generated.",
    };
  }
  revalidatePath("/decks");
  redirect(`/decks/${deckId}`);
}

export async function addCardToDeck(formData: FormData) {
  const deckId = z.string().uuid().parse(formData.get("deckId"));
  const cardId = z.string().uuid().parse(formData.get("cardId"));
  const section = z
    .enum(["commander", "mainboard", "maybeboard"])
    .parse(formData.get("section") ?? "mainboard");
  await query(
    `INSERT INTO deck_cards (deck_id,card_id,quantity,section) VALUES ($1,$2,1,$3)
     ON CONFLICT (deck_id,card_id,section) DO UPDATE SET quantity=deck_cards.quantity+1, updated_at=now()`,
    [deckId, cardId, section],
  );
  if (section === "commander")
    await query(
      "UPDATE decks SET commander_card_id=$2,updated_at=now() WHERE id=$1",
      [deckId, cardId],
    );
  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/decks");
}

export async function removeCardFromDeck(formData: FormData) {
  const deckId = z.string().uuid().parse(formData.get("deckId"));
  const cardId = z.string().uuid().parse(formData.get("cardId"));
  const section = z
    .enum(["commander", "mainboard", "maybeboard"])
    .parse(formData.get("section"));
  await query(
    "DELETE FROM deck_cards WHERE deck_id=$1 AND card_id=$2 AND section=$3",
    [deckId, cardId, section],
  );
  if (section === "commander")
    await query(
      "UPDATE decks SET commander_card_id=null,updated_at=now() WHERE id=$1",
      [deckId],
    );
  revalidatePath(`/decks/${deckId}`);
  revalidatePath("/decks");
}

export async function deleteDeck(formData: FormData) {
  const deckId = z.string().uuid().parse(formData.get("deckId"));
  const result = await query("DELETE FROM decks WHERE id=$1", [deckId]);
  if (result.rowCount === 0) throw new Error("Deck not found.");
  revalidatePath("/decks");
  revalidatePath("/");
  redirect("/decks");
}

export type RenameDeckState = { error?: string };

export async function renameDeck(
  _previousState: RenameDeckState,
  formData: FormData,
): Promise<RenameDeckState> {
  const parsed = z
    .object({
      deckId: z.string().uuid(),
      name: z
        .string()
        .trim()
        .min(2, "Deck names need at least two characters.")
        .max(100, "Deck names cannot exceed 100 characters."),
    })
    .safeParse({ deckId: formData.get("deckId"), name: formData.get("name") });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Enter a valid deck name.",
    };
  const result = await query(
    "UPDATE decks SET name=$2,updated_at=now() WHERE id=$1",
    [parsed.data.deckId, parsed.data.name],
  );
  if (result.rowCount === 0) return { error: "Deck not found." };
  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/decks");
  revalidatePath("/");
  redirect(`/decks/${parsed.data.deckId}`);
}

export type UpdateDeckDescriptionState = { error?: string };

export async function updateDeckDescription(
  _previousState: UpdateDeckDescriptionState,
  formData: FormData,
): Promise<UpdateDeckDescriptionState> {
  const parsed = z
    .object({
      deckId: z.string().uuid(),
      description: z
        .string()
        .trim()
        .max(800, "Descriptions cannot exceed 800 characters."),
    })
    .safeParse({
      deckId: formData.get("deckId"),
      description: formData.get("description") ?? "",
    });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Enter a valid description.",
    };
  const result = await query(
    "UPDATE decks SET description=$2,updated_at=now() WHERE id=$1",
    [parsed.data.deckId, parsed.data.description || null],
  );
  if (result.rowCount === 0) return { error: "Deck not found." };
  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/decks");
  redirect(`/decks/${parsed.data.deckId}`);
}

export type UpdateDeckCardQuantityState = { saved?: boolean; error?: string };

export async function updateDeckCardQuantity(
  _previousState: UpdateDeckCardQuantityState,
  formData: FormData,
): Promise<UpdateDeckCardQuantityState> {
  const parsed = z
    .object({
      deckId: z.string().uuid(),
      cardId: z.string().uuid(),
      section: z.enum(["commander", "mainboard", "maybeboard"]),
      quantity: z.coerce.number().int().min(0).max(999),
    })
    .safeParse({
      deckId: formData.get("deckId"),
      cardId: formData.get("cardId"),
      section: formData.get("section"),
      quantity: formData.get("quantity"),
    });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Enter a valid quantity.",
    };
  const card = (
    await query<{
      format: string;
      section: string;
      type_line: string;
      oracle_text: string | null;
    }>(
      `SELECT d.format,dc.section,c.type_line,c.oracle_text FROM deck_cards dc JOIN decks d ON d.id=dc.deck_id JOIN cards c ON c.id=dc.card_id WHERE dc.deck_id=$1 AND dc.card_id=$2 AND dc.section=$3`,
      [parsed.data.deckId, parsed.data.cardId, parsed.data.section],
    )
  ).rows[0];
  if (!card) return { error: "Deck card not found." };
  const limit = deckCardQuantityLimit({
    format: card.format,
    section: card.section,
    typeLine: card.type_line,
    oracleText: card.oracle_text,
  });
  if (limit <= 1)
    return { error: "This card is limited to one copy in this format." };
  if (parsed.data.quantity > limit)
    return {
      error: `This card can have at most ${limit} copies in this format.`,
    };
  if (parsed.data.quantity === 0)
    await query(
      "DELETE FROM deck_cards WHERE deck_id=$1 AND card_id=$2 AND section=$3",
      [parsed.data.deckId, parsed.data.cardId, parsed.data.section],
    );
  else
    await query(
      "UPDATE deck_cards SET quantity=$4,updated_at=now() WHERE deck_id=$1 AND card_id=$2 AND section=$3",
      [
        parsed.data.deckId,
        parsed.data.cardId,
        parsed.data.section,
        parsed.data.quantity,
      ],
    );
  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/decks");
  revalidatePath("/");
  return { saved: true };
}

export type UpdateDeckWithAgentState = {
  prompt?: string;
  summary?: string;
  cardCount?: number;
  usedFallback?: boolean;
  error?: string;
};

export async function updateDeckWithAgent(
  _previousState: UpdateDeckWithAgentState,
  formData: FormData,
): Promise<UpdateDeckWithAgentState> {
  const parsed = z
    .object({
      deckId: z.string().uuid(),
      prompt: z
        .string()
        .trim()
        .min(1, "Tell the agent what you want to change.")
        .max(800, "Requests cannot exceed 800 characters."),
    })
    .safeParse({
      deckId: formData.get("deckId"),
      prompt: formData.get("prompt") ?? "",
    });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Enter an update request.",
      prompt: String(formData.get("prompt") ?? "").trim(),
    };
  try {
    const result = await applyDeckAgentUpdate(
      parsed.data.deckId,
      parsed.data.prompt,
    );
    revalidatePath(`/decks/${parsed.data.deckId}`);
    revalidatePath("/decks");
    revalidatePath("/");
    return {
      prompt: parsed.data.prompt,
      summary: result.summary,
      cardCount: result.cardCount,
      usedFallback: result.usedFallback,
    };
  } catch (error) {
    return {
      prompt: parsed.data.prompt,
      error:
        error instanceof Error
          ? error.message
          : "The deck could not be updated.",
    };
  }
}

export async function markDeckCardOwned(formData: FormData) {
  const parsed = z
    .object({ deckId: z.string().uuid(), cardId: z.string().uuid() })
    .parse({
      deckId: formData.get("deckId"),
      cardId: formData.get("cardId"),
    });
  const result = await query<{ added: number }>(
    `WITH needed AS (
       SELECT 1::int quantity
       FROM (SELECT max(dc.quantity) required_quantity FROM deck_cards dc WHERE dc.deck_id=$1 AND dc.card_id=$2 AND dc.section IN ('commander','mainboard')) required
       WHERE required_quantity > coalesce((SELECT sum(ci.quantity) FROM collection_items ci WHERE ci.card_id=$2),0)
     ), added AS (
       INSERT INTO collection_items (card_id,quantity,location)
       SELECT $2,quantity,'Added from deck' FROM needed WHERE quantity>0
       ON CONFLICT (card_id,condition,location) DO UPDATE SET quantity=collection_items.quantity+EXCLUDED.quantity,updated_at=now()
       RETURNING quantity
     ) SELECT coalesce((SELECT quantity FROM added),0)::int added`,
    [parsed.deckId, parsed.cardId],
  );
  if (!result.rows[0] || result.rows[0].added === 0) return;
  revalidatePath(`/decks/${parsed.deckId}`);
  revalidatePath("/decks");
  revalidatePath("/library");
  revalidatePath("/");
}

export async function addCatalogCardToDeck(formData: FormData) {
  const parsed = z
    .object({
      deckId: z.string().uuid(),
      scryfallId: z.string().uuid(),
      section: z.enum(["mainboard", "maybeboard"]),
    })
    .parse({
      deckId: formData.get("deckId"),
      scryfallId: formData.get("scryfallId"),
      section: formData.get("section") ?? "mainboard",
    });
  const deck = (
    await query<{ id: string }>("SELECT id FROM decks WHERE id=$1", [
      parsed.deckId,
    ])
  ).rows[0];
  if (!deck) throw new Error("Deck not found.");
  const card = await findScryfallCard(parsed.scryfallId);
  const price = card.prices?.usd
    ? Math.round(Number(card.prices.usd) * 100)
    : null;
  const image =
    card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;
  const saved = await query<{ id: string }>(
    `INSERT INTO cards (external_id,name,set_code,set_name,collector_number,mana_cost,mana_value,type_line,oracle_text,colors,color_identity,rarity,image_url,commander_legal,price_usd_cents,price_checked_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now()) ON CONFLICT (external_id) DO UPDATE SET price_usd_cents=EXCLUDED.price_usd_cents,price_checked_at=now(),image_url=EXCLUDED.image_url,oracle_text=EXCLUDED.oracle_text,commander_legal=EXCLUDED.commander_legal,updated_at=now() RETURNING id`,
    [
      `scryfall:${card.id}`,
      card.name,
      card.set.toUpperCase(),
      card.set_name,
      card.collector_number ?? null,
      card.mana_cost ?? null,
      card.cmc ?? null,
      card.type_line ?? "",
      card.oracle_text ?? null,
      card.colors ?? [],
      card.color_identity,
      card.rarity ?? null,
      image,
      card.legalities?.commander === "legal",
      price,
    ],
  );
  await query(
    `INSERT INTO deck_cards (deck_id,card_id,quantity,section) VALUES ($1,$2,1,$3) ON CONFLICT (deck_id,card_id,section) DO UPDATE SET quantity=deck_cards.quantity+1,updated_at=now()`,
    [parsed.deckId, saved.rows[0].id, parsed.section],
  );
  revalidatePath(`/decks/${parsed.deckId}`);
  revalidatePath("/decks");
  revalidatePath("/");
  redirect(`/decks/${parsed.deckId}`);
}
