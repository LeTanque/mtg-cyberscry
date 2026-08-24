import Link from "next/link";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";
import { CardArt } from "@/components/card-art";
import { CommanderCatalogControls } from "@/components/commander-catalog-controls";
import { ManaCost } from "@/components/mana-cost";
import { getScryfallCreatureTypes, searchScryfallPage, type ScryfallCard } from "@/lib/mtg";
import { commanderColorIdentities } from "@/lib/color-identities";
import { addScryfallCardToLibrary } from "@/app/actions";
import { query as databaseQuery } from "@cyberscry/database";

export const dynamic="force-dynamic";

export default async function CommandersPage({searchParams}:{searchParams:Promise<{q?:string;sort?:string;view?:string;page?:string;color?:string;creature?:string}>}) {
  const params=await searchParams;
  const query=params.q?.trim().slice(0,80)??"";
  const sort=params.sort==="color"?"color":"name";
  const view=params.view==="list"?"list":"images";
  const color=commanderColorIdentities.filter(identity=>identity!=="C").includes(params.color??"")?params.color??"":"";
  let creatureTypes:string[]=[];
  try { creatureTypes=await getScryfallCreatureTypes(); } catch {}
  const creature=creatureTypes.includes(params.creature??"")?params.creature??"":"";
  const page=Math.max(1,Math.min(100,Number.parseInt(params.page??"1",10)||1));
  const safeName=query.replace(/["\\]/g," ");
  const scryfallQuery=`f:commander is:commander${safeName?` name:"${safeName}"`:""}${color?` id=${color.toLowerCase()}`:""}${creature?` t:"${creature}"`:""}`;
  let result:{data:ScryfallCard[];has_more:boolean;total_cards:number};
  try { result=await searchScryfallPage(scryfallQuery,sort,page); }
  catch { result={data:[],has_more:false,total_cards:0}; }
  const ownedRows=(await databaseQuery<{name_key:string;owned:number}>(`SELECT lower(c.name) name_key,sum(ci.quantity+ci.foil_quantity)::int owned FROM collection_items ci JOIN cards c ON c.id=ci.card_id GROUP BY lower(c.name)`)).rows;
  const ownedByName=new Map(ownedRows.map(row=>[row.name_key,row.owned]));
  const pageHref=(next:number)=>{const nextParams=new URLSearchParams();if(query)nextParams.set("q",query);if(sort==="color")nextParams.set("sort","color");if(view==="list")nextParams.set("view","list");if(color)nextParams.set("color",color);if(creature)nextParams.set("creature",creature);if(next>1)nextParams.set("page",String(next));return `/commanders${nextParams.size?`?${nextParams}`:""}`;};
  return <div className="shell page commanders-page">
    <section className="page-title"><span className="kicker"><Crown size={14}/>Commander catalog</span><h1>Commanders</h1><p>Browse every Commander-legal leader, explore their color identities, and find the card you want to build around.</p></section>
    <CommanderCatalogControls query={query} sort={sort} view={view} color={color} creature={creature} creatureTypes={creatureTypes}/>
    <div className="commander-results-meta"><span>{result.total_cards.toLocaleString()} legal commanders{query?` matching “${query}”`:""}</span><span>Page {page}</span></div>
    {!result.data.length?<div className="empty"><Crown/><h3>No commanders found</h3><p>{query?"Try a broader card name.":"The Commander catalog is temporarily unavailable."}</p></div>:view==="images"?<div className="commander-catalog-grid">{result.data.map(card=><CommanderImageCard card={card} owned={ownedByName.get(card.name.toLowerCase())??0} key={card.id}/>)}</div>:<div className="commander-catalog-list">{result.data.map(card=><CommanderListCard card={card} owned={ownedByName.get(card.name.toLowerCase())??0} key={card.id}/>)}</div>}
    {(page>1||result.has_more)&&<nav className="commander-pagination" aria-label="Commander catalog pages">{page>1?<Link className="button" href={pageHref(page-1)}><ChevronLeft size={15}/>Previous</Link>:<span/>}<span>Page {page}</span>{result.has_more?<Link className="button" href={pageHref(page+1)}>Next<ChevronRight size={15}/></Link>:<span/>}</nav>}
  </div>;
}

function image(card:ScryfallCard){return card.image_uris?.normal??card.card_faces?.[0]?.image_uris?.normal??null;}
function identity(card:ScryfallCard){return card.color_identity.length?card.color_identity.map(color=>`{${color}}`).join(""):"{C}";}
function AddCommanderToCollection({card}:{card:ScryfallCard}){return <form action={addScryfallCardToLibrary} className="add-commander-form"><input type="hidden" name="scryfallId" value={card.id}/><button type="submit">Add to collection</button></form>;}
function OwnedCommanderCount({owned}:{owned:number}){return <span className={owned>0?"commander-owned-count owned":"commander-owned-count"}>{owned>0?`${owned} owned`:"Not owned"}</span>;}
function CommanderImageCard({card,owned}:{card:ScryfallCard;owned:number}){return <article className="commander-catalog-card"><div className="commander-catalog-art"><CardArt src={image(card)} name={card.name}/><OwnedCommanderCount owned={owned}/></div><div><strong>{card.name}</strong><small><ManaCost cost={card.mana_cost}/></small><span><ManaCost cost={identity(card)}/></span><p>{card.type_line}</p><AddCommanderToCollection card={card}/></div></article>;}
function CommanderListCard({card,owned}:{card:ScryfallCard;owned:number}){return <article className="commander-catalog-row"><strong>{card.name}</strong><span><ManaCost cost={card.mana_cost}/></span><span className="commander-identity"><ManaCost cost={identity(card)}/></span><small>{card.type_line}</small><OwnedCommanderCount owned={owned}/><AddCommanderToCollection card={card}/></article>;}
