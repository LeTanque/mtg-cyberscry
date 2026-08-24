"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Plus, Search } from "lucide-react";
import { addCardToLibrary } from "@/app/actions";
import { ManaCost } from "@/components/mana-cost";

type Printing={id:string;name:string;set:string;setName:string;manaCost?:string;type?:string};

export function LibraryPrintingSearch() {
  const [query,setQuery]=useState(""); const [results,setResults]=useState<Printing[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{
    const value=query.trim(); if(value.length<2)return;
    const controller=new AbortController(); const timeout=window.setTimeout(async()=>{setLoading(true);setError("");try{const response=await fetch(`/api/cards/search?q=${encodeURIComponent(value)}`,{signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error??"Printing search failed.");setResults((data.cards??[]).slice(0,16));}catch(reason){if(!(reason instanceof DOMException&&reason.name==="AbortError")){setResults([]);setError(reason instanceof Error?reason.message:"Printing search failed.");}}finally{setLoading(false);}},250);
    return()=>{window.clearTimeout(timeout);controller.abort();};
  },[query]);
  return <div className="printing-autocomplete"><div className="searchbar compact" role="combobox" aria-expanded={results.length>0} aria-controls="printing-results"><Search size={17}/><input value={query} onChange={event=>{setQuery(event.target.value);if(event.target.value.trim().length<2){setResults([]);setError("");}}} placeholder="e.g. Lightning Bolt" autoComplete="off" aria-label="Find a card printing"/>{loading?<LoaderCircle className="combobox-loader" size={15}/>:null}</div>{error&&<p className="notice">{error}</p>}{results.length>0&&<div className="printing-results" id="printing-results">{results.map(card=><form action={addCardToLibrary} className="printing-result" key={card.id}><input type="hidden" name="externalId" value={card.id}/><div><strong>{card.name}</strong><small>{card.setName} · {card.set}</small><span><ManaCost cost={card.manaCost}/> {card.type}</span></div><label>Qty<input aria-label={`Quantity of ${card.name}`} name="quantity" type="number" min="1" defaultValue="1"/></label><button aria-label={`Add ${card.name}`}><Plus size={14}/></button></form>)}</div>}</div>;
}
