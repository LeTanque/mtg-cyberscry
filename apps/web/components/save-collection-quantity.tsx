"use client";

import { useActionState, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { updateCollectionQuantity, type UpdateCollectionQuantityState } from "@/app/actions";

const initialState: UpdateCollectionQuantityState = {};

export function SaveCollectionQuantity({ itemId, quantity }: { itemId: string; quantity: number }) {
  const [state, formAction, pending] = useActionState(updateCollectionQuantity, initialState);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state.saved) setDirty(false);
  }, [state]);
  return <form action={formAction} className="collection-quantity-form">
    <input type="hidden" name="itemId" value={itemId} />
    <label>Qty <input name="quantity" type="number" min="0" max="999" defaultValue={quantity} onChange={() => setDirty(true)} /></label>
    <button type="submit" disabled={pending}>{pending ? "Saving…" : state.saved && !dirty ? <><Check size={12} />Saved</> : "Save"}</button>
    {state.error && <span className="save-feedback error" aria-live="polite">{state.error}</span>}
  </form>;
}
