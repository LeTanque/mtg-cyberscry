"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { updateDeckCardQuantity, type UpdateDeckCardQuantityState } from "@/app/actions";

const initialState: UpdateDeckCardQuantityState = {};

export function DeckCardQuantity({
  deckId,
  cardId,
  section,
  cardName,
  quantity,
  maxQuantity,
  compact = false,
}: {
  deckId: string;
  cardId: string;
  section: string;
  cardName: string;
  quantity: number;
  maxQuantity: number;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateDeckCardQuantity, initialState);
  const [dirty, setDirty] = useState(false);
  if (maxQuantity <= 1) return <span className="qty">{quantity}×</span>;
  return (
    <form action={formAction} className={`deck-quantity-form${compact ? " compact" : ""}`} onSubmit={() => setDirty(false)}>
      <input type="hidden" name="deckId" value={deckId} />
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="section" value={section} />
      <label>
        <span className="sr-only">Quantity of {cardName}</span>
        <input name="quantity" type="number" min="0" max={maxQuantity} defaultValue={quantity} disabled={pending} onChange={() => setDirty(true)} />
      </label>
      <button type="submit" disabled={pending || !dirty}>{pending ? "…" : state.saved && !dirty ? <><Check size={12} />Saved</> : "Save"}</button>
      {state.error && <span className="deck-quantity-error" aria-live="polite">{state.error}</span>}
    </form>
  );
}
