import type { ScryfallCard } from "@/lib/mtg";

type AssistantPlan = { summary:string; cardNames:string[] };

export async function askDeckAssistant(input:{commander:ScryfallCard;candidates:ScryfallCard[];ownedNames:Set<string>;budgetCents:number|null;goals:string|null}):Promise<AssistantPlan|null>{
  const apiKey=process.env.OPENAI_API_KEY?.trim();
  if(!apiKey)return null;
  const candidates=input.candidates.map(card=>({name:card.name,manaValue:card.cmc??0,type:card.type_line??"",text:(card.oracle_text??"").slice(0,360),priceUsd:card.prices?.usd??null,owned:input.ownedNames.has(card.name.toLowerCase())}));
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
    signal:AbortSignal.timeout(90_000),
    body:JSON.stringify({
      model:process.env.OPENAI_MODEL?.trim()||"gpt-5.4",
      store:false,
      instructions:"You are an expert Magic: The Gathering Commander deck builder. Select a cohesive, playable 63-card nonland package from only the supplied candidates. Balance ramp, card advantage, interaction, protection, synergy, and win conditions. Prefer owned cards when quality is comparable. Respect the budget when one is provided. Never invent card names and never select the commander.",
      input:JSON.stringify({commander:{name:input.commander.name,manaCost:input.commander.mana_cost,type:input.commander.type_line,oracleText:input.commander.oracle_text,colorIdentity:input.commander.color_identity},deckGoals:input.goals||"Build a focused, broadly playable deck with a coherent plan.",targetBudgetUsd:input.budgetCents==null?null:input.budgetCents/100,candidates}),
      max_output_tokens:5000,
      text:{format:{type:"json_schema",name:"commander_deck_plan",strict:true,schema:{type:"object",properties:{summary:{type:"string"},cardNames:{type:"array",items:{type:"string"},minItems:63,maxItems:63}},required:["summary","cardNames"],additionalProperties:false}}},
    }),
  });
  if(!response.ok)throw new Error(`Deck assistant request failed (${response.status}).`);
  const result=await response.json() as {output?:Array<{content?:Array<{type?:string;text?:string}>}>};
  const outputText=result.output?.flatMap(item=>item.content??[]).find(content=>content.type==="output_text")?.text;
  if(!outputText)throw new Error("Deck assistant returned no usable plan.");
  return JSON.parse(outputText) as AssistantPlan;
}
