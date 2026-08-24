"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type OwnedOption={name:string;setCode:string};

export function CollectionFilterSearch({initialQuery,options}:{initialQuery:string;options:OwnedOption[]}) {
  const router=useRouter(); const [value,setValue]=useState(initialQuery); const [open,setOpen]=useState(false); const [active,setActive]=useState(-1);
  const matches=useMemo(()=>{const query=value.trim().toLowerCase();if(!query)return[];return options.filter(option=>option.name.toLowerCase().includes(query)).slice(0,8);},[options,value]);
  function apply(name=value){const query=name.trim();router.push(query?`/library?q=${encodeURIComponent(query)}`:"/library");setOpen(false);}
  return <div className="collection-filter-autocomplete"><form className="searchbar" onSubmit={event=>{event.preventDefault();apply();}} role="search"><Search size={18}/><input value={value} onChange={event=>{setValue(event.target.value);setOpen(true);setActive(-1);}} onFocus={()=>value.trim()&&setOpen(true)} onBlur={()=>window.setTimeout(()=>setOpen(false),120)} onKeyDown={event=>{if(!open||!matches.length)return;if(event.key==="ArrowDown"){event.preventDefault();setActive(index=>Math.min(index+1,matches.length-1));}if(event.key==="ArrowUp"){event.preventDefault();setActive(index=>Math.max(index-1,0));}if(event.key==="Enter"&&active>=0){event.preventDefault();apply(matches[active].name);}if(event.key==="Escape")setOpen(false);}} placeholder="Filter your collection…" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open&&matches.length>0} aria-controls="collection-filter-options"/><button>Search</button></form>{open&&matches.length>0&&<div className="collection-filter-options" id="collection-filter-options" role="listbox">{matches.map((option,index)=><button type="button" role="option" aria-selected={active===index} className={active===index?"active":""} key={`${option.name}-${option.setCode}`} onMouseDown={event=>event.preventDefault()} onClick={()=>apply(option.name)}><strong>{option.name}</strong><small>{option.setCode}</small></button>)}</div>}</div>;
}
