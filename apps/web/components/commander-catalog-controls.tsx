"use client";

import { Grid2X2, List, LoaderCircle, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ManaCost } from "@/components/mana-cost";

const colors = [
  ["W", "White"],
  ["U", "Blue"],
  ["B", "Black"],
  ["R", "Red"],
  ["G", "Green"],
] as const;

type Suggestion = { id: string; name: string; colorIdentity: string[] };

export function CommanderCatalogControls({ query, sort, view, color, creature, creatureTypes }: { query:string; sort:"name"|"color"; view:"images"|"list"; color:string; creature:string; creatureTypes:string[] }) {
  const [value,setValue]=useState(query);
  const [suggestions,setSuggestions]=useState<Suggestion[]>([]);
  const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState(false);
  const router=useRouter();
  const pathname=usePathname();
  const current=useSearchParams();

  useEffect(()=>{
    if(value.trim().length<2||value.trim()===query)return;
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setLoading(true);
      try {
        const response=await fetch(`/api/cards/commanders?q=${encodeURIComponent(value.trim())}`,{signal:controller.signal});
        const result=await response.json() as {commanders?:Suggestion[]};
        setSuggestions(result.commanders??[]);setOpen(true);
      } catch(error) { if((error as Error).name!=="AbortError")setSuggestions([]); }
      finally { if(!controller.signal.aborted)setLoading(false); }
    },220);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[value,query]);

  function navigate(changes:Record<string,string|null>){const params=new URLSearchParams(current.toString());for(const [key,next] of Object.entries(changes)){if(next)params.set(key,next);else params.delete(key);}params.delete("page");router.push(`${pathname}${params.size?`?${params}`:""}`);}
  function toggleColor(selected:string){const active=new Set(color);if(active.has(selected))active.delete(selected);else active.add(selected);const next=colors.map(([value])=>value).filter(value=>active.has(value)).join("");navigate({color:next||null});}
  function submit(){navigate({q:value.trim()||null});setOpen(false);}
  return <div className="commander-catalog-toolbar"><div className="commander-catalog-controls">
    <div className="commander-catalog-search">
      <form onSubmit={event=>{event.preventDefault();submit();}} role="search"><Search size={17}/><input value={value} onChange={event=>{setValue(event.target.value);setOpen(true);}} onFocus={()=>suggestions.length&&setOpen(true)} placeholder="Filter commanders by name…" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open&&value.trim().length>=2&&suggestions.length>0} aria-controls="catalog-commander-options"/>{loading?<LoaderCircle className="catalog-search-loader" size={15}/>:value?<button type="button" className="catalog-search-clear" aria-label="Clear commander filter" onClick={()=>{setValue("");setOpen(false);navigate({q:null});}}><X size={14}/></button>:null}<button type="submit">Search</button></form>
      {open&&value.trim().length>=2&&suggestions.length>0&&<div id="catalog-commander-options" className="catalog-commander-options" role="listbox">{suggestions.map(card=><button type="button" role="option" aria-selected={false} key={card.id} onMouseDown={event=>event.preventDefault()} onClick={()=>{setValue(card.name);navigate({q:card.name});setOpen(false);}}><strong>{card.name}</strong><span>{card.colorIdentity.length?card.colorIdentity.join(""):"Colorless"}</span></button>)}</div>}
    </div>
    <label>Sort by<select value={sort} onChange={event=>navigate({sort:event.target.value==="color"?"color":null})}><option value="name">Name</option><option value="color">Color combination</option></select></label>
    <div className="commander-view-toggle" role="group" aria-label="Commander view"><button type="button" className={view==="images"?"active":""} aria-pressed={view==="images"} onClick={()=>navigate({view:null})}><Grid2X2 size={14}/>Images</button><button type="button" className={view==="list"?"active":""} aria-pressed={view==="list"} onClick={()=>navigate({view:"list"})}><List size={14}/>List</button></div>
  </div><div className="commander-secondary-filters"><div className="commander-color-filter-row"><span>Colors</span><div className="commander-color-filters" role="group" aria-label="Filter commanders by color identity">{colors.map(([value,label])=><button type="button" className={color.includes(value)?"active":""} aria-pressed={color.includes(value)} aria-label={label} title={label} onClick={()=>toggleColor(value)} key={value}><ManaCost cost={`{${value}}`}/></button>)}</div><small>{color?"Showing the selected color identity":"No colors selected — showing all commanders"}</small></div><label className="commander-type-filter">Creature type<select value={creature} onChange={event=>navigate({creature:event.target.value||null})} aria-label="Filter commanders by creature type"><option value="">All creature types</option>{creatureTypes.map(type=><option value={type} key={type}>{type}</option>)}</select></label></div></div>;
}
