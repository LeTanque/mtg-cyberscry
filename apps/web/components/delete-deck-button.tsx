"use client";

import { Trash2 } from "lucide-react";
import { deleteDeck } from "@/app/actions";

export function DeleteDeckButton({ deckId, deckName }: { deckId: string; deckName: string }) {
  return <form action={deleteDeck} onSubmit={event => {
    if (!window.confirm(`Delete “${deckName}”? The deck list will be permanently removed, but your card library will not change.`)) event.preventDefault();
  }}>
    <input type="hidden" name="deckId" value={deckId}/>
    <button className="delete-deck-button" type="submit"><Trash2 size={15}/>Delete deck</button>
  </form>;
}
