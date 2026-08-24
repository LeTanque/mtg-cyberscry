import { NextResponse } from "next/server";
import { searchScryfall } from "@/lib/mtg";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) return NextResponse.json({ commanders: [] });
  try {
    const safeQuery = query.replace(/["\\]/g, " ").slice(0, 80);
    const cards = await searchScryfall(`f:commander is:commander name:"${safeQuery}"`, 10);
    return NextResponse.json({
      commanders: cards.map(card => ({
        id: card.id,
        name: card.name,
        manaCost: card.mana_cost ?? "",
        typeLine: card.type_line ?? "",
        colorIdentity: card.color_identity,
        imageUrl: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Commander search is temporarily unavailable." }, { status: 503 });
  }
}
