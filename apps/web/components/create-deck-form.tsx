"use client";

import { useActionState, useState } from "react";
import { Check, Palette, Plus, Sparkles, X } from "lucide-react";
import { createDeck, type CreateDeckState } from "@/app/actions";
import { CommanderCombobox, type Commander } from "@/components/commander-combobox";
import { ManaCost } from "@/components/mana-cost";

const initialState: CreateDeckState = {};
const colorOptions = [
  ["W", "White"],
  ["U", "Blue"],
  ["B", "Black"],
  ["R", "Red"],
  ["G", "Green"],
] as const;
type ThemeSuggestion = {
  label: string;
  prompt: string;
  preferredColors?: readonly string[];
  minimumColors?: number;
};
const themeSuggestions: ThemeSuggestion[] = [
  { label: "Aggro", prompt: "Play an aggressive low-curve game and close quickly with efficient threats." },
  { label: "Midrange", prompt: "Build a flexible midrange deck with efficient threats, interaction, and steady value." },
  { label: "Control", prompt: "Play a patient control game with answers, card advantage, and a few strong finishers." },
  { label: "Combo", prompt: "Assemble a focused combo or synergy engine with protection and backup ways to win." },
  { label: "Tokens", prompt: "Create a wide board of creature tokens and turn them into a decisive attack." },
  { label: "+1/+1 Counters", prompt: "Build around +1/+1 counters, proliferate, and creatures that grow over time." },
  { label: "Artifacts", prompt: "Make artifacts the center of the deck with payoffs, recursion, and a strong artifact engine." },
  { label: "Spellslinger", prompt: "Cast lots of instants and sorceries while rewarding spell velocity and prowess.", preferredColors: ["U", "R"] },
  { label: "Reanimator", prompt: "Fill the graveyard and bring back powerful creatures or permanents for value.", preferredColors: ["B"] },
  { label: "Aristocrats", prompt: "Use sacrifice outlets, death triggers, and expendable creatures to drain opponents.", preferredColors: ["W", "B", "R"] },
  { label: "Landfall", prompt: "Play extra lands and turn landfall triggers into ramp, creatures, and incremental advantage.", preferredColors: ["G", "R"] },
  { label: "Voltron", prompt: "Suit up one primary threat with equipment or auras and win through combat damage.", minimumColors: 2 },
] as const;

export function CreateDeckForm() {
  const [format, setFormat] = useState("commander");
  const [deckName, setDeckName] = useState("");
  const [autoBuild, setAutoBuild] = useState(false);
  const [buildModalOpen, setBuildModalOpen] = useState(false);
  const [selectedCommander, setSelectedCommander] = useState<Commander | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [theme, setTheme] = useState("");
  const [state, formAction, pending] = useActionState(createDeck, initialState);
  const canSubmit = deckName.trim().length >= 2 && format.length > 0;
  const commanderRequired = format === "commander";

  function changeFormat(nextFormat: string) {
    setFormat(nextFormat);
    setAutoBuild(false);
    setBuildModalOpen(false);
    setSelectedCommander(null);
    setSelectedColors([]);
    setTheme("");
  }

  function toggleAutoBuild() {
    if (autoBuild) {
      setAutoBuild(false);
      setBuildModalOpen(false);
      return;
    }
    setAutoBuild(true);
  }

  function selectCommander(commander: Commander | null) {
    setSelectedCommander(commander);
    if (commander) {
      setSelectedColors(commander.colorIdentity.filter((color) => colorOptions.some(([value]) => value === color)));
    } else {
      setSelectedColors([]);
    }
  }

  function toggleColor(color: string) {
    setSelectedColors((current) => current.includes(color) ? current.filter((value) => value !== color) : [...current, color]);
  }

  function addThemeSuggestion(prompt: string) {
    setTheme((current) => current.trim() ? `${current.trim()} ${prompt}` : prompt);
  }

  const availableColors = commanderRequired
    ? selectedCommander?.colorIdentity ?? []
    : colorOptions.map(([color]) => color);
  const effectiveThemeColors = commanderRequired
    ? selectedCommander
      ? selectedColors.length > 0 ? selectedColors : selectedCommander.colorIdentity
      : []
    : selectedColors.length > 0 ? selectedColors : colorOptions.map(([color]) => color);
  const visibleThemeSuggestions = [...themeSuggestions]
    .filter((suggestion) => !(commanderRequired && !selectedCommander) || (!suggestion.preferredColors && !suggestion.minimumColors))
    .filter((suggestion) => !suggestion.minimumColors || effectiveThemeColors.length >= suggestion.minimumColors)
    .sort((left, right) => {
      const leftMatches = left.preferredColors?.some((color) => effectiveThemeColors.includes(color)) ?? false;
      const rightMatches = right.preferredColors?.some((color) => effectiveThemeColors.includes(color)) ?? false;
      return Number(rightMatches) - Number(leftMatches);
    });

  return <form action={formAction} className="stack-form">
    <label>Deck name<input name="name" value={deckName} onChange={event => setDeckName(event.target.value)} required minLength={2} placeholder="Midnight Wheels" /></label>
    <label>Format<select name="format" value={format} onChange={event => changeFormat(event.target.value)} required><option value="commander">Commander</option><option value="standard">Standard</option><option value="modern">Modern</option><option value="pauper">Pauper</option><option value="legacy">Legacy</option><option value="vintage">Vintage</option><option value="casual">Casual</option></select></label>
    <input type="hidden" name="autoBuild" value={autoBuild ? "true" : "false"} />
    <input type="hidden" name="colors" value={selectedColors.join(",")} />
    <button type="button" className={autoBuild ? "auto-build-toggle active" : "auto-build-toggle"} role="switch" aria-checked={autoBuild} onClick={toggleAutoBuild}>
      <span className="auto-build-toggle-icon"><Sparkles size={14} /></span>
      <span><strong>Auto Build</strong><small>{autoBuild ? "Agent-assisted build enabled" : "Start with an empty deck"}</small></span>
      <span className="toggle-track" aria-hidden="true"><i /></span>
    </button>
    <label>Target budget (USD)<input name="budget" type="number" min="0" step="1" placeholder="1000" /></label>
    {state.error && <p className="form-error" aria-live="polite">{state.error}</p>}
    {autoBuild ? <button type="button" className="button primary" disabled={pending || !canSubmit} onClick={() => setBuildModalOpen(true)}><Sparkles size={16} />Create deck</button> : <button type="submit" className="button primary" disabled={pending || !canSubmit}><Plus size={16} />{pending ? "Creating deck…" : "Create empty deck"}</button>}
    {autoBuild && buildModalOpen && <div className="auto-build-modal-backdrop" role="presentation">
      <div className="auto-build-modal" role="dialog" aria-modal="true" aria-labelledby="auto-build-title">
        <div className="auto-build-modal-head">
          <div><span className="kicker"><Sparkles size={13} /> Auto Build</span><h3 id="auto-build-title">Shape the build</h3></div>
          <button type="button" className="icon-button" aria-label="Cancel Auto Build" onClick={() => { setAutoBuild(false); setBuildModalOpen(false); }}><X size={16} /></button>
        </div>
        {commanderRequired && <div className="commander-prompt auto-build-commander"><span><Sparkles size={14} /> First decision</span><label>Commander name<CommanderCombobox onSelectionChange={selectCommander} /></label><p>Choose a Commander-legal leader before building.</p></div>}
        <div className="auto-build-section"><span className="auto-build-label"><Palette size={14} /> Color direction <small>{commanderRequired && !selectedCommander ? "Choose a commander first" : commanderRequired ? "Optional — leave blank for full identity" : "Optional — leave blank for any color"}</small></span><div className="auto-build-colors" role="group" aria-label="Preferred deck colors">{colorOptions.map(([color, label]) => { const allowed = availableColors.includes(color); const selected = selectedColors.includes(color); return <button type="button" key={color} className={selected ? "active" : ""} aria-label={allowed ? label : `${label} is outside the selected commander identity`} aria-pressed={selected} disabled={!allowed} title={allowed ? label : `${label} is outside the selected commander identity`} onClick={() => toggleColor(color)}><ManaCost cost={`{${color}}`} />{selected && <Check size={11} aria-hidden="true" />}</button>; })}</div></div>
        <div className="theme-suggestions"><span className="theme-suggestions-label">Common themes</span><div role="group" aria-label="Suggested deck themes">{visibleThemeSuggestions.map(({ label, prompt }) => <button type="button" key={label} title={prompt} aria-label={`Add ${label} theme`} onClick={() => addThemeSuggestion(prompt)}>{label}</button>)}</div></div>
        <label>Deck theme <textarea name="theme" value={theme} onChange={(event) => setTheme(event.target.value)} maxLength={800} placeholder="Artifacts, big swings, and a resilient midrange plan…" /><small>Describe the strategy, mood, power level, or cards you want the agent to prioritize. This can be blank.</small></label>
        <div className="auto-build-modal-foot"><button type="button" className="button" onClick={() => { setAutoBuild(false); setBuildModalOpen(false); }}>Cancel</button><button type="submit" className="button primary" disabled={pending || !canSubmit || (commanderRequired && !selectedCommander)}><Sparkles size={15} />{pending ? "Building legal deck…" : "Build Deck"}</button></div>
      </div>
    </div>}
  </form>;
}
