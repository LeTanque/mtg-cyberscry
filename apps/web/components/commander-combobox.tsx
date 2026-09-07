"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { ManaCost } from "@/components/mana-cost";
import { InputClearButton } from "@/components/input-clear-button";

export type Commander = {
  id: string;
  name: string;
  manaCost: string;
  typeLine: string;
  colorIdentity: string[];
};

export function CommanderCombobox({ onSelectionChange }: { onSelectionChange?:(selected:Commander|null)=>void }) {
  const [value, setValue] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [results, setResults] = useState<Commander[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const requestId = useRef(0);

  useEffect(() => {
    const search = value.trim();
    if (search.length < 2) return;
    const currentRequest = ++requestId.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/cards/commanders?q=${encodeURIComponent(search)}`, { signal: controller.signal });
        const data = await response.json();
        if (currentRequest === requestId.current) {
          setResults(data.commanders ?? []);
          setOpen(true);
          setActive(-1);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [value]);

  function choose(commander: Commander) {
    setValue(commander.name);
    setSelectedId(commander.id);
    onSelectionChange?.(commander);
    setOpen(false);
    setActive(-1);
  }

  function clear() {
    setValue("");
    setSelectedId("");
    setResults([]);
    setOpen(false);
    setLoading(false);
    setActive(-1);
    onSelectionChange?.(null);
  }

  return <div className="commander-combobox"><input type="hidden" name="commanderId" value={selectedId}/>
    <div className="commander-input"><Search size={15}/><input
      name="commanderName"
      value={value}
      className={value ? "has-clear" : undefined}
      onChange={event => {
        const nextValue = event.target.value;
        setValue(nextValue);
        setSelectedId("");
        onSelectionChange?.(null);
        if (nextValue.trim().length < 2) { setResults([]); setOpen(false); setLoading(false); }
      }}
      onFocus={() => results.length && setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onKeyDown={event => {
        if (!open || !results.length) return;
        if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(index + 1, results.length - 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
        if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(results[active]); }
        if (event.key === "Escape") setOpen(false);
      }}
      required
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls="commander-options"
      aria-activedescendant={active >= 0 ? `commander-option-${active}` : undefined}
      placeholder="Start typing a commander…"
      autoComplete="off"
    />{value && <InputClearButton label="Clear commander" onClear={clear}/>} {loading && <LoaderCircle className={`combobox-loader${value ? " has-clear" : ""}`} size={15}/>}</div>
    {open && <div className="commander-options" id="commander-options" role="listbox">
      {results.length ? results.map((commander, index) => <button
        type="button"
        id={`commander-option-${index}`}
        role="option"
        aria-selected={active === index}
        className={active === index ? "active" : ""}
        key={commander.id}
        onMouseDown={event => event.preventDefault()}
        onClick={() => choose(commander)}
      ><span><strong>{commander.name}</strong><small>{commander.typeLine}</small></span><ManaCost cost={commander.manaCost}/></button>) : !loading && <p>No valid commanders found.</p>}
    </div>}
  </div>;
}
