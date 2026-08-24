import Link from "next/link";
import Image from "next/image";
import { query } from "@cyberscry/database";
import {
  ArrowUpRight,
  CircleDollarSign,
  LibraryBig,
  Layers3,
  PackageCheck,
  Sparkles,
} from "lucide-react";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

type Stats = {
  unique_cards: number;
  total_cards: number;
  collection_value: number;
  deck_count: number;
  missing_cost: number;
};

export default async function Dashboard() {
  const stats = (
    await query<Stats>(`SELECT
    (SELECT count(*)::int FROM collection_items WHERE quantity>0) unique_cards,
    (SELECT coalesce(sum(quantity),0)::int FROM collection_items) total_cards,
    (SELECT coalesce(sum(ci.quantity*c.price_usd_cents),0)::int FROM collection_items ci JOIN cards c ON c.id=ci.card_id) collection_value,
    (SELECT count(*)::int FROM decks) deck_count,
    (SELECT coalesce(sum(greatest(dc.quantity-coalesce(owned.qty,0),0)*coalesce(c.price_usd_cents,0)),0)::int FROM deck_cards dc JOIN cards c ON c.id=dc.card_id LEFT JOIN (SELECT card_id,sum(quantity) qty FROM collection_items GROUP BY card_id) owned ON owned.card_id=dc.card_id) missing_cost`)
  ).rows[0];
  const decks = (
    await query<{
      id: string;
      name: string;
      format: string;
      cards: number;
      missing: number;
      missing_cost: number;
      preview_image: string | null;
    }>(`SELECT d.id,d.name,d.format,coalesce(sum(dc.quantity),0)::int cards,
    coalesce(sum(greatest(dc.quantity-coalesce(o.qty,0),0)),0)::int missing,
    coalesce(sum(greatest(dc.quantity-coalesce(o.qty,0),0)*coalesce(c.price_usd_cents,0)),0)::int missing_cost,
    coalesce(nullif(cmd.image_url,''),(SELECT c2.image_url FROM deck_cards dc2 JOIN cards c2 ON c2.id=dc2.card_id WHERE dc2.deck_id=d.id AND c2.image_url IS NOT NULL AND c2.image_url<>'' ORDER BY CASE dc2.section WHEN 'commander' THEN 0 ELSE 1 END,c2.name LIMIT 1)) preview_image
    FROM decks d LEFT JOIN deck_cards dc ON dc.deck_id=d.id LEFT JOIN cards c ON c.id=dc.card_id LEFT JOIN cards cmd ON cmd.id=d.commander_card_id LEFT JOIN (SELECT card_id,sum(quantity) qty FROM collection_items GROUP BY card_id) o ON o.card_id=dc.card_id GROUP BY d.id,cmd.image_url ORDER BY d.updated_at DESC LIMIT 4`)
  ).rows;
  return (
    <div className="shell">
      <section className="stat-grid">
        <article>
          <LibraryBig />
          <span>Collection</span>
          <strong>{stats.total_cards}</strong>
          <small>{stats.unique_cards} unique printings</small>
        </article>
        <article>
          <CircleDollarSign />
          <span>Estimated value</span>
          <strong>{money(stats.collection_value)}</strong>
          <small>Latest market snapshots</small>
        </article>
        <article>
          <Layers3 />
          <span>Active decks</span>
          <strong>{stats.deck_count}</strong>
          <small>Across all formats</small>
        </article>
        <article>
          <PackageCheck />
          <span>Shopping gap</span>
          <strong>{money(stats.missing_cost)}</strong>
          <small>Cards missing from decks</small>
        </article>
      </section>
      <section className="section-head">
        <div>
          <span className="kicker">Workbench</span>
          <h2>Recent decks</h2>
        </div>
        <Link href="/decks">
          View all <ArrowUpRight size={15} />
        </Link>
      </section>
      <div className="deck-grid">
        {decks.length ? (
          decks.map((deck) => (
            <Link
              className="deck-tile"
              href={`/decks/${deck.id}`}
              key={deck.id}
            >
              {deck.preview_image && (
                <div className="deck-tile-art" aria-hidden="true">
                  <Image
                    src={deck.preview_image}
                    alt=""
                    fill
                    sizes="(max-width: 900px) 100vw, 33vw"
                    unoptimized
                  />
                </div>
              )}
              <div className="deck-tile-content">
                <span className="format">{deck.format}</span>
                <h3>{deck.name}</h3>
                <div className="deck-meta">
                  <span>{deck.cards} cards</span>
                  <span>{deck.missing} missing</span>
                  <strong>{money(deck.missing_cost)}</strong>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="empty">
            <Sparkles />
            <h3>Your next deck starts here</h3>
            <p>
              Create a deck, add cards from your library, and Cyberscry will
              calculate the rest.
            </p>
            <Link className="button primary" href="/decks">
              Create a deck
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
