"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Plus, Search } from "lucide-react";
import { addCatalogCardToDeck } from "@/app/actions";
import { ManaCost } from "@/components/mana-cost";
import { HoverCardPreview } from "@/components/hover-card-preview";
import { InputClearButton } from "@/components/input-clear-button";

type Result={id:string;name:string;typeLine:string;manaCost:string;set:string;imageUrl:string|null;commanderLegal:boolean;priceUsd:string|null};

export function DeckCardSearch({deckId}:{deckId:string}) {
  const [query,setQuery]=useState(""); const [results,setResults]=useState<Result[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{
    const value=query.trim(); if(value.length<2)return;
    const controller=new AbortController(); const timeout=window.setTimeout(async()=>{setLoading(true);setError("");try{const response=await fetch(`/api/cards/universe?q=${encodeURIComponent(value)}`,{signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error);setResults(data.cards??[]);}catch(reason){if(!(reason instanceof DOMException&&reason.name==="AbortError"))setError(reason instanceof Error?reason.message:"Search failed.");}finally{setLoading(false);}},250);
    return()=>{window.clearTimeout(timeout);controller.abort();};
  },[query]);
  return <div className="deck-universe-search"><label htmlFor="deck-card-search">Search all Magic cards</label><div className="deck-search-input"><Search size={15}/><input id="deck-card-search" value={query} onChange={event=>{setQuery(event.target.value);if(event.target.value.trim().length<2)setResults([]);}} placeholder="Add any card…" autoComplete="off"/>{query&&<InputClearButton label="Clear card search" onClear={()=>{setQuery("");setResults([]);setError("");}}/>}{loading&&<LoaderCircle className={`combobox-loader${query?" has-clear":""}`} size={15}/>}</div>{error&&<p className="form-error">{error}</p>}{results.length>0&&<div className="deck-search-results">{results.map(card=><form action={addCatalogCardToDeck} key={card.id}><input type="hidden" name="deckId" value={deckId}/><input type="hidden" name="scryfallId" value={card.id}/><input type="hidden" name="section" value="mainboard"/><div><HoverCardPreview src={card.imageUrl} name={card.name}><span className="deck-search-result-copy"><strong>{card.name}</strong><small><ManaCost cost={card.manaCost}/> {card.typeLine}</small><span>{card.set}{card.priceUsd?` · $${card.priceUsd}`:""}{!card.commanderLegal?" · Not Commander-legal":""}</span></span></HoverCardPreview></div><button aria-label={`Add ${card.name}`}><Plus size={14}/></button></form>)}</div>}</div>;
}
