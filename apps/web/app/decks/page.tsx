import Link from "next/link";
import { query } from "@cyberscry/database";
import { ArrowUpRight, Layers3, TriangleAlert } from "lucide-react";
import { money } from "@/lib/format";
import { CreateDeckForm } from "@/components/create-deck-form";
import { validateCommanderDeck, type LegalityCard } from "@/lib/deck-legality";
import { CardArt } from "@/components/card-art";
import { enrichCard } from "@/lib/mtg";

export const dynamic = "force-dynamic";

export default async function DecksPage() {
  const decks = (
    await query<{
      id: string;
      name: string;
      format: string;
      description: string | null;
      cards: number;
      owned: number;
      missing_cost: number;
      preview_image: string | null;
      preview_card_name: string | null;
    }>(`SELECT d.id,d.name,d.format,d.description,coalesce(sum(dc.quantity),0)::int cards,coalesce(sum(least(dc.quantity,coalesce(o.qty,0))),0)::int owned,coalesce(sum(greatest(dc.quantity-coalesce(o.qty,0),0)*coalesce(c.price_usd_cents,0)),0)::int missing_cost,
    coalesce(cmd.image_url,(SELECT c2.image_url FROM deck_cards dc2 JOIN cards c2 ON c2.id=dc2.card_id WHERE dc2.deck_id=d.id AND c2.image_url IS NOT NULL ORDER BY CASE dc2.section WHEN 'commander' THEN 0 ELSE 1 END,c2.name LIMIT 1),(SELECT c3.image_url FROM collection_items ci3 JOIN cards c3 ON c3.id=ci3.card_id WHERE ci3.quantity>0 AND c3.image_url IS NOT NULL ORDER BY c3.name LIMIT 1)) preview_image,
    coalesce(cmd.name,(SELECT c2.name FROM deck_cards dc2 JOIN cards c2 ON c2.id=dc2.card_id WHERE dc2.deck_id=d.id ORDER BY CASE dc2.section WHEN 'commander' THEN 0 ELSE 1 END,c2.name LIMIT 1),(SELECT c3.name FROM collection_items ci3 JOIN cards c3 ON c3.id=ci3.card_id WHERE ci3.quantity>0 ORDER BY c3.name LIMIT 1)) preview_card_name
    FROM decks d LEFT JOIN deck_cards dc ON dc.deck_id=d.id LEFT JOIN cards c ON c.id=dc.card_id LEFT JOIN cards cmd ON cmd.id=d.commander_card_id LEFT JOIN (SELECT card_id,sum(quantity) qty FROM collection_items GROUP BY card_id) o ON o.card_id=dc.card_id GROUP BY d.id,cmd.image_url,cmd.name ORDER BY d.updated_at DESC`)
  ).rows;
  const decksWithArt = await Promise.all(
    decks.map(async (deck) => {
      if (deck.preview_image || !deck.preview_card_name) return deck;
      const card = await enrichCard(deck.preview_card_name);
      return {
        ...deck,
        preview_image:
          card?.image_uris?.normal ??
          card?.card_faces?.[0]?.image_uris?.normal ??
          null,
      };
    }),
  );
  const legalityCards = (
    await query<LegalityCard & { deck_id: string }>(
      `SELECT dc.deck_id,c.name,dc.section,dc.quantity,c.type_line,c.oracle_text,c.color_identity,c.commander_legal FROM deck_cards dc JOIN cards c ON c.id=dc.card_id`,
    )
  ).rows;
  const statusByDeck = new Map(
    decks.map((deck) => [
      deck.id,
      deck.format === "commander"
        ? validateCommanderDeck(
            legalityCards.filter((card) => card.deck_id === deck.id),
          )
        : { valid: true, issues: [] },
    ]),
  );
  return (
    <div className="shell page">
      <section className="page-title">
        <div>
          <h1>Decks</h1>
          <p>Turn your collection into complete, costed deck lists.</p>
        </div>
      </section>
      <div className="split-layout">
        <section>
          <div className="deck-list">
            {decksWithArt.map((deck) => {
              const status = statusByDeck.get(deck.id);
              return (
                <Link
                  className="deck-row"
                  href={`/decks/${deck.id}`}
                  key={deck.id}
                >
                  <span className="deck-list-art">
                    <CardArt
                      src={deck.preview_image}
                      name={deck.preview_card_name ?? deck.name}
                    />
                    {status && !status.valid && (
                      <i title={status.issues[0]}>
                        <TriangleAlert />
                      </i>
                    )}
                  </span>
                  <div>
                    <span className="format">{deck.format}</span>
                    <h3>{deck.name}</h3>
                    <p>
                      {deck.cards} cards · {deck.owned} covered by collection
                    </p>
                    {deck.preview_card_name && (
                      <small>Artwork: {deck.preview_card_name}</small>
                    )}
                  </div>
                  <div className="deck-cost">
                    <small>To complete</small>
                    <strong>{money(deck.missing_cost)}</strong>
                  </div>
                  <ArrowUpRight />
                </Link>
              );
            })}
          </div>
          {!decks.length && (
            <div className="empty">
              <Layers3 />
              <h3>No decks yet</h3>
              <p>Use the form to start your first build.</p>
            </div>
          )}
        </section>
        <aside className="catalog-panel">
          <span className="kicker">New build</span>
          <h2>Create a deck</h2>
          <CreateDeckForm />
        </aside>
      </div>
    </div>
  );
}
