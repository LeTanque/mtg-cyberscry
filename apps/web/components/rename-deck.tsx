"use client";

import { useActionState, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { renameDeck, type RenameDeckState } from "@/app/actions";

const initialState: RenameDeckState = {};

export function RenameDeck({ deckId, currentName }: { deckId: string; currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(renameDeck, initialState);
  if (!editing) return <button className="rename-deck-trigger" type="button" onClick={() => setEditing(true)}><Pencil size={13}/>Rename</button>;
  return <form action={formAction} className="rename-deck-form">
    <input type="hidden" name="deckId" value={deckId}/>
    <input name="name" defaultValue={currentName} required minLength={2} maxLength={100} autoFocus aria-label="New deck name"/>
    <button type="submit" disabled={pending} aria-label="Save deck name"><Check size={15}/></button>
    <button type="button" onClick={() => setEditing(false)} aria-label="Cancel rename"><X size={15}/></button>
    {state.error && <span aria-live="polite">{state.error}</span>}
  </form>;
}
