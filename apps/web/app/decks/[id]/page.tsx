import { notFound } from "next/navigation";
import { query, type LibraryCard } from "@cyberscry/database";
import {
  addCardToDeck,
  markDeckCardOwned,
  removeCardFromDeck,
} from "@/app/actions";
import { money } from "@/lib/format";
import {
  Check,
  CircleDollarSign,
  PackageX,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { DeleteDeckButton } from "@/components/delete-deck-button";
import { RenameDeck } from "@/components/rename-deck";
import { EditDeckDescription } from "@/components/edit-deck-description";
import { UpdateDeckWithAgent } from "@/components/update-deck-with-agent";
import { DeckCardQuantity } from "@/components/deck-card-quantity";
import { DeckViewToggle } from "@/components/deck-view-toggle";
import { CardArt } from "@/components/card-art";
import { enrichCard } from "@/lib/mtg";
import { HoverCardPreview } from "@/components/hover-card-preview";
import { ManaCost } from "@/components/mana-cost";
import { DeckCardSearch } from "@/components/deck-card-search";
import { DeckLegalitySummary } from "@/components/deck-legality-summary";
import { validateCommanderDeck } from "@/lib/deck-legality";
import { deckCardQuantityLimit } from "@/lib/deck-quantity";
import { TcgplayerKickbackNotice } from "@/components/tcgplayer-kickback-notice";

export const dynamic = "force-dynamic";

type Deck = {
  id: string;
  name: string;
  format: string;
  description: string | null;
  target_budget_cents: number | null;
};
type DeckCard = {
  card_id: string;
  name: string;
  set_code: string;
  mana_cost: string | null;
  mana_value: number | null;
  type_line: string;
  oracle_text: string | null;
  color_identity: string[];
  commander_legal: boolean;
  image_url: string | null;
  quantity: number;
  section: string;
  price_usd_cents: number | null;
  owned: number;
  missing: number;
};

export default async function DeckPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string; type?: string; card?: string }>;
}) {
  const { id } = await params;
  const requestedParams = await searchParams;
  const requestedSort = requestedParams.sort;
  const sort: "owned" | "unowned" | "name" | "cmc" =
    requestedSort === "unowned" ||
    requestedSort === "name" ||
    requestedSort === "cmc"
      ? requestedSort
      : "owned";
  const allowedFilters = [
    "creatures",
    "instants",
    "sorceries",
    "enchantments",
    "artifacts",
    "planeswalkers",
    "lands",
  ] as const;
  type CardFilter = "all" | (typeof allowedFilters)[number];
  const filter: CardFilter = allowedFilters.includes(
    requestedParams.type as (typeof allowedFilters)[number],
  )
    ? (requestedParams.type as CardFilter)
    : "all";
  const cardQuery = requestedParams.card?.trim().slice(0, 120) ?? "";
  const deck = (await query<Deck>("SELECT * FROM decks WHERE id=$1", [id]))
    .rows[0];
  if (!deck) notFound();
  const deckDescription = deck.description
    ?.replace(/\s*Add OPENAI_API_KEY to enable assistant-built lists\.?$/, "")
    .trim() || null;
  const cards = (
    await query<DeckCard>(
      `SELECT c.id card_id,c.name,c.set_code,c.mana_cost,c.mana_value,c.type_line,c.oracle_text,c.color_identity,c.commander_legal,c.image_url,dc.quantity,dc.section,c.price_usd_cents,CASE WHEN c.type_line LIKE '%Basic%' AND c.type_line LIKE '%Land%' THEN dc.quantity ELSE least(dc.quantity,coalesce(o.qty,0)) END::int owned,CASE WHEN c.type_line LIKE '%Basic%' AND c.type_line LIKE '%Land%' THEN 0 ELSE greatest(dc.quantity-coalesce(o.qty,0),0) END::int missing FROM deck_cards dc JOIN cards c ON c.id=dc.card_id LEFT JOIN (SELECT card_id,sum(quantity) qty FROM collection_items GROUP BY card_id) o ON o.card_id=c.id WHERE dc.deck_id=$1 ORDER BY CASE dc.section WHEN 'commander' THEN 0 WHEN 'mainboard' THEN 1 ELSE 2 END,c.type_line,c.name`,
      [id],
    )
  ).rows;
  const library = (
    await query<LibraryCard>(
      `SELECT c.*,ci.quantity,ci.foil_quantity,ci.condition,ci.location FROM collection_items ci JOIN cards c ON c.id=ci.card_id WHERE ci.quantity>0 ORDER BY c.name`,
    )
  ).rows;
  const count = cards.reduce((s, c) => s + c.quantity, 0);
  const missing = cards.reduce((s, c) => s + c.missing, 0);
  const cost = cards.reduce(
    (s, c) => s + c.missing * (c.price_usd_cents ?? 0),
    0,
  );
  const storedCommander = cards.find((card) => card.section === "commander");
  const commanderLookup =
    storedCommander &&
    (!storedCommander.image_url || storedCommander.color_identity.length === 0)
      ? await enrichCard(storedCommander.name)
      : null;
  const commanderImage =
    storedCommander?.image_url ??
    commanderLookup?.image_uris?.normal ??
    commanderLookup?.card_faces?.[0]?.image_uris?.normal ??
    null;
  if (storedCommander && commanderLookup) {
    await query(
      `UPDATE cards SET image_url=coalesce(nullif(image_url,''),$1),mana_cost=coalesce($2,mana_cost),mana_value=coalesce($3,mana_value),type_line=coalesce($4,type_line),oracle_text=coalesce($5,oracle_text),colors=$6,color_identity=$7,commander_legal=$8,updated_at=now() WHERE id=$9`,
      [
        commanderImage,
        commanderLookup.mana_cost ?? null,
        commanderLookup.cmc ?? null,
        commanderLookup.type_line ?? null,
        commanderLookup.oracle_text ?? null,
        commanderLookup.colors ?? [],
        commanderLookup.color_identity,
        commanderLookup.legalities?.commander === "legal",
        storedCommander.card_id,
      ],
    );
  }
  const resolvedCommander = storedCommander
    ? {
        ...storedCommander,
        image_url: commanderImage,
        mana_cost: commanderLookup?.mana_cost ?? storedCommander.mana_cost,
        mana_value: commanderLookup?.cmc ?? storedCommander.mana_value,
        type_line: commanderLookup?.type_line ?? storedCommander.type_line,
        oracle_text: commanderLookup?.oracle_text ?? storedCommander.oracle_text,
        color_identity:
          commanderLookup?.color_identity ?? storedCommander.color_identity,
        commander_legal: commanderLookup
          ? commanderLookup.legalities?.commander === "legal"
          : storedCommander.commander_legal,
      }
    : null;
  const displayCards =
    resolvedCommander
      ? cards.map((card) =>
          card.card_id === resolvedCommander.card_id
            ? resolvedCommander
            : card,
        )
      : cards;
  const sortedCards = displayCards.toSorted((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name);
    if (sort === "cmc")
      return (
        (left.mana_value ?? Number.MAX_SAFE_INTEGER) -
          (right.mana_value ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name)
      );
    if (sort === "unowned")
      return (
        Number(right.missing > 0) - Number(left.missing > 0) ||
        left.name.localeCompare(right.name)
      );
    return (
      Number(left.missing > 0) - Number(right.missing > 0) ||
      left.name.localeCompare(right.name)
    );
  });
  const filteredCards = cardQuery
    ? sortedCards.filter((card) =>
        card.name.toLowerCase().includes(cardQuery.toLowerCase()),
      )
    : sortedCards;
  const noMatchingCards = filteredCards.length === 0;
  const groups = Object.groupBy(filteredCards, (card) => card.section);
  const commander = displayCards.find((card) => card.section === "commander");
  const legality =
    deck.format === "commander"
      ? validateCommanderDeck(displayCards)
      : { valid: true, issues: [] };
  return (
    <div className="shell page">
      <section className="deck-hero">
        <div className="deck-hero-copy">
          {commander && (
            <div className="commander-hero-art">
              <CardArt src={commanderImage} name={commander.name} />
              <span>Commander</span>
              {!legality.valid && (
                <i
                  className="deck-warning-badge"
                  title="This deck has Commander format problems"
                >
                  <TriangleAlert />
                </i>
              )}
            </div>
          )}
          <div>
            <span className="format">{deck.format}</span>
            <div className="deck-title-row">
              <h1>{deck.name}</h1>
              <RenameDeck deckId={deck.id} currentName={deck.name} />
            </div>
            {commander && (
              <strong className="commander-name">{commander.name}</strong>
            )}
            <EditDeckDescription deckId={deck.id} currentDescription={deckDescription} />
            <UpdateDeckWithAgent deckId={deck.id} deckName={deck.name} />
            <DeleteDeckButton deckId={deck.id} deckName={deck.name} />
          </div>
        </div>
        <div className="deck-kpis">
          <div>
            <strong>{count}</strong>
            <span>cards</span>
          </div>
          <div>
            <strong>{missing}</strong>
            <span>missing</span>
          </div>
          <div>
            <strong>{money(cost)}</strong>
            <span>to buy</span>
          </div>
        </div>
      </section>
      <div className="builder-layout">
        <section>
          <div className="section-head">
            <div>
              <span className="kicker">Deck list</span>
              <h2>Main construction</h2>
            </div>
          </div>
          <DeckViewToggle
            sort={sort}
            filter={filter}
            cardQuery={cardQuery}
            cardOptions={[...new Set(cards.map((card) => card.name))].sort(
              (a, b) => a.localeCompare(b),
            )}
            listView={noMatchingCards ? <EmptyDeckResults query={cardQuery} /> : <DeckList groups={groups} deckId={id} filter={filter} format={deck.format} />}
            cardView={
              noMatchingCards ? <EmptyDeckResults query={cardQuery} /> : <DeckGallery groups={groups} deckId={id} filter={filter} format={deck.format} />
            }
          />
        </section>
        <aside>
          <div className="catalog-panel sticky">
            <span className="kicker">Your cards</span>
            <h2>Add from library</h2>
            <DeckCardSearch deckId={id} />
            <p>Owned printings</p>
            <div className="library-picker">
              {library.map((card) => (
                <form
                  action={addCardToDeck}
                  className="picker-row"
                  key={card.id}
                >
                  <input type="hidden" name="deckId" value={id} />
                  <input type="hidden" name="cardId" value={card.id} />
                  <div>
                    <strong>{card.name}</strong>
                    <small>
                      {card.quantity} owned · {card.set_code}
                    </small>
                  </div>
                  <select
                    aria-label="Deck section"
                    name="section"
                    defaultValue="mainboard"
                  >
                    <option value="mainboard">Main</option>
                    {deck.format === "commander" && (
                      <option value="commander">Commander</option>
                    )}
                    <option value="maybeboard">Maybe</option>
                  </select>
                  <button>+</button>
                </form>
              ))}
            </div>
          </div>
          <DeckLegalitySummary status={legality} format={deck.format} />
        </aside>
      </div>
      <section className="purchase-summary">
        <CircleDollarSign />
        <div>
          <span className="kicker">Purchase plan</span>
          <h2>
            {missing ? `${missing} cards remain` : "This deck is covered"}
          </h2>
          <p>
            {missing
              ? `Current estimated checkout: ${money(cost)}. Prices use the latest stored market snapshot.`
              : "Every listed card is available in your collection."}
          </p>
          {missing > 0 && <TcgplayerKickbackNotice />}
        </div>
      </section>
    </div>
  );
}

function EmptyDeckResults({ query }: { query: string }) {
  return (
    <div className="empty deck-search-empty">
      <h3>{query ? "No cards found" : "This deck is empty"}</h3>
      <p>{query ? `No cards in this deck match “${query}”. Clear the search to see the full deck.` : "Add cards from your library or use the card search to start building it."}</p>
    </div>
  );
}

const mainboardCategories = [
  ["Creatures", (card: DeckCard) => cardCategory(card) === "Creatures"],
  ["Instants", (card: DeckCard) => cardCategory(card) === "Instants"],
  ["Sorceries", (card: DeckCard) => cardCategory(card) === "Sorceries"],
  ["Enchantments", (card: DeckCard) => cardCategory(card) === "Enchantments"],
  ["Artifacts", (card: DeckCard) => cardCategory(card) === "Artifacts"],
  ["Planeswalkers", (card: DeckCard) => cardCategory(card) === "Planeswalkers"],
  ["Other", (card: DeckCard) => cardCategory(card) === "Other"],
  ["Lands", (card: DeckCard) => cardCategory(card) === "Lands"],
] as const;

function cardCategory(card: DeckCard) {
  if (card.type_line.includes("Creature")) return "Creatures";
  if (card.type_line.includes("Instant")) return "Instants";
  if (card.type_line.includes("Sorcery")) return "Sorceries";
  if (card.type_line.includes("Enchantment")) return "Enchantments";
  if (card.type_line.includes("Land")) return "Lands";
  if (card.type_line.includes("Planeswalker")) return "Planeswalkers";
  if (card.type_line.includes("Artifact")) return "Artifacts";
  return "Other";
}

function DeckList({
  groups,
  deckId,
  filter,
  format,
}: {
  groups: Partial<Record<string, DeckCard[]>>;
  deckId: string;
  filter: string;
  format: string;
}) {
  const mainboard = groups.mainboard ?? [];
  const visibleCategories =
    filter === "all"
      ? mainboardCategories
      : mainboardCategories.filter(([title]) => title.toLowerCase() === filter);
  return (
    <>
      {filter === "all" && (
        <ListSection
          title="Commander"
          cards={groups.commander ?? []}
          deckId={deckId}
          format={format}
        />
      )}
      {visibleCategories.map(([title, matches]) =>
        title === "Lands" ? (
            <LandListSections
            key={title}
            cards={mainboard.filter(matches)}
            deckId={deckId}
            format={format}
          />
        ) : (
          <ListSection
            key={title}
            title={title}
            cards={mainboard.filter(matches)}
            deckId={deckId}
            format={format}
          />
        ),
      )}
      {filter === "all" && (
        <ListSection
          title="Maybeboard"
          cards={groups.maybeboard ?? []}
          deckId={deckId}
          format={format}
        />
      )}
    </>
  );
}

function LandListSections({
  cards,
  deckId,
  format,
}: {
  cards: DeckCard[];
  deckId: string;
  format: string;
}) {
  if (!cards.length) return null;
  return (
    <div className="land-type-group">
      <h3 className="land-type-heading">
        Lands<span>{cards.reduce((sum, card) => sum + card.quantity, 0)}</span>
      </h3>
      <ListSection
        title="Basic lands"
        cards={cards.filter(isBasicLand)}
        deckId={deckId}
        format={format}
      />
      <ListSection
        title="Other lands"
        cards={cards.filter((card) => !isBasicLand(card))}
        deckId={deckId}
        format={format}
      />
    </div>
  );
}

function ListSection({
  title,
  cards,
  deckId,
  format,
}: {
  title: string;
  cards: DeckCard[];
  deckId: string;
  format: string;
}) {
  if (!cards.length) return null;
  return (
    <div className="deck-section">
      <h3>
        {title}
        <span>{cards.reduce((sum, card) => sum + card.quantity, 0)}</span>
      </h3>
      {cards.map((card) => (
        <div
          className="deck-card-line"
          key={`${card.card_id}-${card.section}`}
        >
          <div>
            <HoverCardPreview src={card.image_url} name={card.name}>
              <strong>{card.name}</strong>
            </HoverCardPreview>
            <small>
              <ManaCost cost={card.mana_cost} />{" "}
              <span aria-hidden="true">·</span> {card.type_line}
            </small>
          </div>
          <div className="deck-card-controls">
            <Ownership card={card} deckId={deckId} />
            <DeckCardQuantity
              deckId={deckId}
              cardId={card.card_id}
              section={card.section}
              cardName={card.name}
              quantity={card.quantity}
              maxQuantity={deckCardQuantityLimit({ format, section: card.section, typeLine: card.type_line, oracleText: card.oracle_text })}
            />
          </div>
          <strong>
            {card.missing
              ? money(card.missing * (card.price_usd_cents ?? 0))
              : "—"}
          </strong>
          <form action={removeCardFromDeck}>
            <input type="hidden" name="deckId" value={deckId} />
            <input type="hidden" name="cardId" value={card.card_id} />
            <input type="hidden" name="section" value={card.section} />
            <button className="icon-button" aria-label={`Remove ${card.name}`}>
              <Trash2 />
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}

function DeckGallery({
  groups,
  deckId,
  filter,
  format,
}: {
  groups: Partial<Record<string, DeckCard[]>>;
  deckId: string;
  filter: string;
  format: string;
}) {
  const mainboard = groups.mainboard ?? [];
  const visibleCategories =
    filter === "all"
      ? mainboardCategories
      : mainboardCategories.filter(([title]) => title.toLowerCase() === filter);
  return (
    <>
      {filter === "all" && (
        <GallerySection
          title="Commander"
          cards={groups.commander ?? []}
          deckId={deckId}
          format={format}
        />
      )}
      {visibleCategories.map(([title, matches]) =>
        title === "Lands" ? (
          <LandGallerySections
            key={title}
            cards={mainboard.filter(matches)}
            deckId={deckId}
            format={format}
          />
        ) : (
          <GallerySection
            key={title}
            title={title}
            cards={mainboard.filter(matches)}
            deckId={deckId}
            format={format}
          />
        ),
      )}
      {filter === "all" && (
        <GallerySection
          title="Maybeboard"
          cards={groups.maybeboard ?? []}
          deckId={deckId}
          format={format}
        />
      )}
    </>
  );
}

function LandGallerySections({
  cards,
  deckId,
  format,
}: {
  cards: DeckCard[];
  deckId: string;
  format: string;
}) {
  if (!cards.length) return null;
  return (
    <div className="land-type-group">
      <h3 className="land-type-heading">
        Lands<span>{cards.reduce((sum, card) => sum + card.quantity, 0)}</span>
      </h3>
      <GallerySection
        title="Basic lands"
        cards={cards.filter(isBasicLand)}
        deckId={deckId}
        format={format}
      />
      <GallerySection
        title="Other lands"
        cards={cards.filter((card) => !isBasicLand(card))}
        deckId={deckId}
        format={format}
      />
    </div>
  );
}

function isBasicLand(card: DeckCard) {
  return card.type_line.includes("Land") && /\bBasic\b/.test(card.type_line);
}

function GallerySection({
  title,
  cards,
  deckId,
  format,
}: {
  title: string;
  cards: DeckCard[];
  deckId: string;
  format: string;
}) {
  if (!cards.length) return null;
  return (
    <div className="deck-gallery-section">
      <h3>
        {title}
        <span>{cards.reduce((sum, card) => sum + card.quantity, 0)}</span>
      </h3>
      <div className="deck-card-grid">
        {cards.map((card) => (
          <article
            className="deck-preview-card"
            key={`${card.card_id}-${card.section}`}
          >
            <div className="preview-art">
              <CardArt src={card.image_url} name={card.name} />
              <span className="preview-quantity">{card.quantity}×</span>
            </div>
            <div className="preview-info">
              <strong>{card.name}</strong>
              <small>
                {card.set_code} <span aria-hidden="true">·</span>{" "}
                <ManaCost cost={card.mana_cost} />
              </small>
              <DeckCardQuantity
                deckId={deckId}
                cardId={card.card_id}
                section={card.section}
                cardName={card.name}
                quantity={card.quantity}
                maxQuantity={deckCardQuantityLimit({ format, section: card.section, typeLine: card.type_line, oracleText: card.oracle_text })}
                compact
              />
              <Ownership card={card} deckId={deckId} />
              {card.missing > 0 && (
                <em>
                  {money(card.missing * (card.price_usd_cents ?? 0))} to buy
                </em>
              )}
              <form action={removeCardFromDeck} className="gallery-remove-form">
                <input type="hidden" name="deckId" value={deckId} />
                <input type="hidden" name="cardId" value={card.card_id} />
                <input type="hidden" name="section" value={card.section} />
                <button type="submit" aria-label={`Remove ${card.name} from deck`}>
                  <Trash2 /> Remove
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Ownership({ card, deckId }: { card: DeckCard; deckId: string }) {
  return (
    <div className="ownership-cell">
      <span className={card.missing ? "ownership missing" : "ownership owned"}>
        {card.missing ? (
          <>
            <PackageX /> {card.missing} needed
          </>
        ) : (
          <>
            <Check /> owned
          </>
        )}
      </span>
      {card.missing > 0 && card.section !== "maybeboard" && (
        <form action={markDeckCardOwned}>
          <input type="hidden" name="deckId" value={deckId} />
          <input type="hidden" name="cardId" value={card.card_id} />
          <button className="mark-owned-button">Mark collected</button>
        </form>
      )}
    </div>
  );
}
