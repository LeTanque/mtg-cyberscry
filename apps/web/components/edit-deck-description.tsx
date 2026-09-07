"use client";

import { useActionState, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { updateDeckDescription, type UpdateDeckDescriptionState } from "@/app/actions";

const initialState: UpdateDeckDescriptionState = {};
const fallbackDescription = "Build from your collection, then cost the cards still missing.";

export function EditDeckDescription({ deckId, currentDescription }: { deckId: string; currentDescription: string | null }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateDeckDescription, initialState);
  if (!editing) return <div className="deck-description"><p>{currentDescription || fallbackDescription}</p><button className="edit-description-trigger" type="button" onClick={() => setEditing(true)}><Pencil size={12} />Edit description</button></div>;
  return <form action={formAction} className="edit-description-form">
    <input type="hidden" name="deckId" value={deckId} />
    <textarea name="description" defaultValue={currentDescription ?? ""} maxLength={800} autoFocus aria-label="Deck description" />
    <div><button type="submit" disabled={pending} aria-label="Save deck description"><Check size={15} /></button><button type="button" onClick={() => setEditing(false)} aria-label="Cancel description edit"><X size={15} /></button></div>
    {state.error && <span aria-live="polite">{state.error}</span>}
  </form>;
}
