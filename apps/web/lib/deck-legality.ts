export type LegalityCard = {
  name:string;
  section:string;
  quantity:number;
  type_line:string;
  oracle_text:string|null;
  color_identity:string[];
  commander_legal:boolean;
};

export type DeckLegality = { valid:boolean; issues:string[] };

export function validateCommanderDeck(cards: LegalityCard[]): DeckLegality {
  const active = cards.filter(card => card.section === "commander" || card.section === "mainboard");
  const commanders = active.filter(card => card.section === "commander");
  const issues:string[] = [];
  const cardCount = active.reduce((sum,card)=>sum+card.quantity,0);
  if (cardCount !== 100) issues.push(`Commander decks need exactly 100 cards; this deck has ${cardCount}.`);
  if (commanders.length !== 1 || commanders.reduce((sum,card)=>sum+card.quantity,0) !== 1) issues.push("Choose exactly one commander for the command zone.");
  const commander = commanders[0];
  if (commander) {
    const canLead = commander.type_line.includes("Legendary Creature") || commander.oracle_text?.toLowerCase().includes("can be your commander");
    if (!canLead) issues.push(`${commander.name} is not eligible to be a commander.`);
    if (!commander.commander_legal) issues.push(`${commander.name} is not Commander-legal.`);
    const identity = new Set(commander.color_identity);
    const offColor = active.filter(card => card.color_identity.some(color=>!identity.has(color)));
    if (offColor.length) issues.push(`Outside the commander's color identity: ${offColor.slice(0,4).map(card=>card.name).join(", ")}${offColor.length>4?` and ${offColor.length-4} more`:""}.`);
  }
  const illegal = active.filter(card=>!card.commander_legal && card !== commander);
  if (illegal.length) issues.push(`Not Commander-legal: ${illegal.slice(0,4).map(card=>card.name).join(", ")}${illegal.length>4?` and ${illegal.length-4} more`:""}.`);
  const counts = new Map<string,{quantity:number;basic:boolean}>();
  for (const card of active) {
    const key=card.name.toLowerCase();
    const current=counts.get(key)??{quantity:0,basic:/\bBasic\b/.test(card.type_line)&&card.type_line.includes("Land")};
    current.quantity+=card.quantity; counts.set(key,current);
  }
  const duplicates=[...counts.entries()].filter(([,value])=>!value.basic&&value.quantity>1).map(([name])=>active.find(card=>card.name.toLowerCase()===name)?.name??name);
  if (duplicates.length) issues.push(`Singleton rule violations: ${duplicates.slice(0,4).join(", ")}${duplicates.length>4?` and ${duplicates.length-4} more`:""}.`);
  return { valid:issues.length===0, issues };
}
