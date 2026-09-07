"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { updateDeckWithAgent, type UpdateDeckWithAgentState } from "@/app/actions";
import { InputClearButton } from "@/components/input-clear-button";

const initialState: UpdateDeckWithAgentState = {};

export function UpdateDeckWithAgent({ deckId, deckName }: { deckId: string; deckName: string }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [state, formAction, pending] = useActionState(updateDeckWithAgent, initialState);
  const router = useRouter();

  useEffect(() => {
    if (!pending && state.summary) router.refresh();
  }, [pending, router, state.summary]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, pending]);

  return (
    <>
      <button className="update-agent-trigger" type="button" onClick={() => setOpen(true)}>
        <Sparkles size={13} /> Intelligent Update
      </button>
      {open && (
        <div className="update-agent-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
          <section className="update-agent-modal" role="dialog" aria-modal="true" aria-labelledby="update-agent-title">
            <header className="update-agent-head">
              <div>
                <span className="kicker"><Bot size={13} /> Deck assistant</span>
                <h2 id="update-agent-title">Update {deckName}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setOpen(false)} disabled={pending} aria-label="Close agent update dialog"><X /></button>
            </header>
            <div className="agent-conversation" aria-live="polite">
              <div className="agent-message agent-message-assistant">Tell me what you want to change. I’ll keep the updated list legal for this deck’s format.</div>
              {state.prompt && <div className="agent-message agent-message-user">{state.prompt}</div>}
              {pending && <div className="agent-message agent-message-assistant agent-message-pending">Updating the deck…</div>}
              {!pending && state.summary && <div className="agent-message agent-message-assistant">{state.summary}<small>{state.usedFallback ? "Agent unavailable; applied a legal catalog fallback. " : ""}Updated {state.cardCount} cards and rebuilt the legal mana base.</small></div>}
              {!pending && state.error && <div className="agent-message agent-message-error">{state.error}</div>}
            </div>
            <form action={formAction} className="update-agent-form">
              <input type="hidden" name="deckId" value={deckId} />
              <label htmlFor="agent-update-prompt">What should change?</label>
              <div className="update-agent-input">
                <span className="clearable-field"><textarea id="agent-update-prompt" name="prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={800} placeholder="Add more removal, make it faster, shift toward tokens…" required disabled={pending} />{prompt && <InputClearButton label="Clear update request" onClear={() => setPrompt("")} />}</span>
                <button type="submit" disabled={pending} aria-label="Send update request"><Send size={15} /></button>
              </div>
              {state.error && <span className="update-agent-error" aria-live="polite">Try another request or check agent availability.</span>}
            </form>
          </section>
        </div>
      )}
    </>
  );
}
