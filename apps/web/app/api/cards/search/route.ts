import { NextResponse } from "next/server";
import { searchScryfallPrintings } from "@/lib/mtg";

export async function GET(request:Request){
  const q=new URL(request.url).searchParams.get("q")?.trim();
  const requestedPage=Number(new URL(request.url).searchParams.get("page") ?? "1");
  const page=Number.isInteger(requestedPage)&&requestedPage>0&&requestedPage<=1000?requestedPage:1;
  if(!q||q.length<2)return NextResponse.json({cards:[]});
  try{const result=await searchScryfallPrintings(q,page);return NextResponse.json({cards:result.cards.map(card=>({id:card.id,name:card.name,set:card.set.toUpperCase(),setName:card.set_name,manaCost:card.mana_cost??"",type:card.type_line??"",imageUrl:card.image_uris?.normal??card.card_faces?.[0]?.image_uris?.normal??null})),hasMore:result.hasMore,page});}catch{return NextResponse.json({error:"Scryfall catalog unavailable"},{status:503});}
}
