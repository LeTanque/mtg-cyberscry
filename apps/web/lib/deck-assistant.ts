import type { ScryfallCard } from "@/lib/mtg";

export type AssistantPlan = { summary:string; cardNames:string[] };

export async function askDeckAssistant(input:{format:string;commander?:ScryfallCard;candidates:ScryfallCard[];ownedNames:Set<string>;budgetCents:number|null;theme:string|null;colors:string[];targetNonlandCount:number}):Promise<AssistantPlan|null>{
  const apiKey=process.env.OPENAI_API_KEY?.trim();
  if(!apiKey)return null;
  const candidates=input.candidates.map(card=>({name:card.name,manaValue:card.cmc??0,type:card.type_line??"",text:(card.oracle_text??"").slice(0,360),priceUsd:card.prices?.usd??null,owned:input.ownedNames.has(card.name.toLowerCase())}));
  const formatInstructions=input.format === "commander"
    ? "Build a Commander deck with exactly the requested number of unique nonland cards. The commander is already selected and must not be included in the card list."
    : `Build a legal ${input.format} constructed deck package with exactly the requested number of nonland card slots. You may repeat nonbasic cards up to four copies when appropriate; do not force singleton construction. Use only cards legal in that format; the application will add legal basic lands and enforce the final count.`;
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
    signal:AbortSignal.timeout(90_000),
    body:JSON.stringify({
      model:process.env.OPENAI_MODEL?.trim()||"gpt-5.4",
      store:false,
      instructions:`You are an expert Magic: The Gathering deck builder. ${formatInstructions} Select a cohesive, playable package from only the supplied candidates. Balance threats, interaction, card advantage, mana support, and synergy. Prefer owned cards when quality is comparable. Respect the budget when one is provided. Never invent card names, never select a land, and never select the commander.`,
      input:JSON.stringify({format:input.format,commander:input.commander?{name:input.commander.name,manaCost:input.commander.mana_cost,type:input.commander.type_line,oracleText:input.commander.oracle_text,colorIdentity:input.commander.color_identity}:null,deckTheme:input.theme??"",preferredColors:input.colors,targetBudgetUsd:input.budgetCents==null?null:input.budgetCents/100,targetNonlandCount:input.targetNonlandCount,candidates}),
      max_output_tokens:5000,
      text:{format:{type:"json_schema",name:"deck_build_plan",strict:true,schema:{type:"object",properties:{summary:{type:"string"},cardNames:{type:"array",items:{type:"string"},minItems:input.targetNonlandCount,maxItems:input.targetNonlandCount}},required:["summary","cardNames"],additionalProperties:false}}},
    }),
  });
  if(!response.ok)throw new Error(`Deck assistant request failed (${response.status}).`);
  const result=await response.json() as {output?:Array<{content?:Array<{type?:string;text?:string}>}>};
  const outputText=result.output?.flatMap(item=>item.content??[]).find(content=>content.type==="output_text")?.text;
  if(!outputText)throw new Error("Deck assistant returned no usable plan.");
  return JSON.parse(outputText) as AssistantPlan;
}
