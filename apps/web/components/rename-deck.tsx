"use client";

import { useActionState, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { renameDeck, type RenameDeckState } from "@/app/actions";
import { InputClearButton } from "@/components/input-clear-button";

const initialState: RenameDeckState = {};

export function RenameDeck({ deckId, currentName }: { deckId: string; currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [state, formAction, pending] = useActionState(renameDeck, initialState);
  if (!editing) return <button className="rename-deck-trigger" type="button" onClick={() => setEditing(true)}><Pencil size={13}/>Rename</button>;
  return <form action={formAction} className="rename-deck-form">
    <input type="hidden" name="deckId" value={deckId}/>
    <input name="name" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={100} autoFocus aria-label="New deck name"/>
    {name && <InputClearButton label="Clear deck name" onClear={() => setName("")} />}
    <button type="submit" disabled={pending} aria-label="Save deck name"><Check size={15}/></button>
    <button type="button" onClick={() => { setName(currentName); setEditing(false); }} aria-label="Cancel rename"><X size={15}/></button>
    {state.error && <span aria-live="polite">{state.error}</span>}
  </form>;
}
