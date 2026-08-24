import { NextResponse } from "next/server";
import { searchScryfallPrintings } from "@/lib/mtg";

export async function GET(request:Request){
  const q=new URL(request.url).searchParams.get("q")?.trim();
  if(!q||q.length<2)return NextResponse.json({cards:[]});
  try{return NextResponse.json({cards:(await searchScryfallPrintings(q)).map(card=>({id:card.id,name:card.name,set:card.set.toUpperCase(),setName:card.set_name,manaCost:card.mana_cost??"",type:card.type_line??""}))});}catch{return NextResponse.json({error:"Scryfall catalog unavailable"},{status:503});}
}
