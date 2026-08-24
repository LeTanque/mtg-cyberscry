"use client";

import { useActionState, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { createDeck, type CreateDeckState } from "@/app/actions";
import { CommanderCombobox } from "@/components/commander-combobox";

const initialState: CreateDeckState = {};

export function CreateDeckForm() {
  const [format, setFormat] = useState("commander");
  const [deckName, setDeckName] = useState("");
  const [commanderSelected, setCommanderSelected] = useState(false);
  const [state, formAction, pending] = useActionState(createDeck, initialState);
  const canSubmit = deckName.trim().length >= 2 && format.length > 0 && (format !== "commander" || commanderSelected);
  return <form action={formAction} className="stack-form">
    <label>Deck name<input name="name" value={deckName} onChange={event=>setDeckName(event.target.value)} required minLength={2} placeholder="Midnight Wheels"/></label>
    <label>Format<select name="format" value={format} onChange={event => {setFormat(event.target.value);setCommanderSelected(false);}} required><option value="commander">Commander</option><option value="standard">Standard</option><option value="modern">Modern</option><option value="pauper">Pauper</option><option value="casual">Casual</option></select></label>
    {format === "commander" && <div className="commander-prompt"><span><Sparkles size={14}/> First decision</span><label>Commander name<CommanderCombobox onSelectionChange={setCommanderSelected}/></label><p>Select a Commander-legal card from the suggestions to continue.</p></div>}
    {format === "commander"&&<label>Deck goals (optional)<textarea name="goals" maxLength={800} placeholder="Focused wheel strategy, medium power, avoid infinite combos, prioritize cards I own…"/><small>Give the deck-building assistant a preferred strategy, power level, or cards to avoid.</small></label>}
    <label>Target budget (USD)<input name="budget" type="number" min="0" step="1" placeholder="1000"/></label>
    {state.error && <p className="form-error" aria-live="polite">{state.error}</p>}
    <button className="button primary" disabled={pending||!canSubmit}><Plus size={16}/>{pending && format === "commander" ? "Scrying a deck…" : "Create deck"}</button>
  </form>;
}
