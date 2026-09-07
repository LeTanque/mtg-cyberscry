import { query, type LibraryCard } from "@cyberscry/database";
import { CardArt } from "@/components/card-art";
import { SlidersHorizontal } from "lucide-react";
import { money } from "@/lib/format";
import { ManaCost } from "@/components/mana-cost";
import { LibraryPrintingSearch } from "@/components/library-printing-search";
import { CollectionFilterSearch } from "@/components/collection-filter-search";
import { SaveCollectionQuantity } from "@/components/save-collection-quantity";
import { HoverCardPreview } from "@/components/hover-card-preview";

export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const library = (await query<LibraryCard & { item_id:string; collection_value:number }>(`SELECT c.*,ci.id item_id,ci.quantity,ci.foil_quantity,ci.condition,ci.location,(ci.quantity*coalesce(c.price_usd_cents,0))::int collection_value FROM collection_items ci JOIN cards c ON c.id=ci.card_id WHERE ($1='' OR c.name ILIKE '%'||$1||'%') ORDER BY c.name,c.set_code`, [q])).rows;
  const ownedOptions=(await query<{name:string;set_code:string}>(`SELECT DISTINCT c.name,c.set_code FROM collection_items ci JOIN cards c ON c.id=ci.card_id WHERE ci.quantity>0 ORDER BY c.name,c.set_code`)).rows.map(card=>({name:card.name,setCode:card.set_code}));
  return <div className="shell page">
    <section className="page-title"><div><span className="kicker">Owned cards</span><h1>Card library</h1><p>{library.reduce((sum,c)=>sum+c.quantity,0)} cards shown across {library.length} printings.</p></div></section>
    <div className="split-layout"><section>
      <CollectionFilterSearch initialQuery={q} options={ownedOptions}/>
      <div className="toolbar"><span><SlidersHorizontal size={15}/> All owned cards</span><span>{money(library.reduce((sum,c)=>sum+c.collection_value,0))} shown value</span></div>
      <div className="collection-grid">{library.map(card => <article className="collection-card" key={card.item_id}><HoverCardPreview src={card.image_url} name={card.name}><CardArt src={card.image_url} name={card.name}/></HoverCardPreview><div className="collection-info"><span className="set">{card.set_code} · {card.condition.replace("_"," ")}</span><h3>{card.name}</h3><p><ManaCost cost={card.mana_cost}/> {card.type_line}</p><div className="card-bottom"><strong>{money(card.price_usd_cents)}</strong><SaveCollectionQuantity itemId={card.item_id} quantity={card.quantity}/></div></div></article>)}</div>
      {!library.length && <div className="empty"><LibraryIcon/><h3>No cards found</h3><p>Search the MTG catalog on the right to add your first printing.</p></div>}
    </section><aside className="catalog-panel"><span className="kicker">Scryfall catalog</span><h2>Find a printing</h2><p>Search current Scryfall printings, then add one to your collection.</p><LibraryPrintingSearch/></aside></div>
  </div>;
}

function LibraryIcon(){ return <span className="empty-icon">◇</span>; }
