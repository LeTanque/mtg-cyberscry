import { NextResponse } from "next/server";
import { searchScryfall } from "@/lib/mtg";

export async function GET(request:Request) {
  const query=new URL(request.url).searchParams.get("q")?.trim();
  if(!query||query.length<2)return NextResponse.json({cards:[]});
  try {
    const safe=query.replace(/["\\]/g," ").slice(0,80);
    const cards=await searchScryfall(`name:"${safe}"`,12);
    return NextResponse.json({cards:cards.map(card=>({id:card.id,name:card.name,typeLine:card.type_line??"",manaCost:card.mana_cost??"",set:card.set.toUpperCase(),imageUrl:card.image_uris?.normal??card.card_faces?.[0]?.image_uris?.normal??null,commanderLegal:card.legalities?.commander==="legal",priceUsd:card.prices?.usd??null}))});
  } catch { return NextResponse.json({error:"Card search is temporarily unavailable."},{status:503}); }
}
