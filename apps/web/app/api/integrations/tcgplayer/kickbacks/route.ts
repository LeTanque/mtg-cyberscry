import { NextResponse } from "next/server";
import { getTcgplayerKickbackStatus } from "@/lib/tcgplayer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getTcgplayerKickbackStatus());
  } catch {
    return NextResponse.json(
      { error: "TCGplayer kickback data is temporarily unavailable." },
      { status: 503 },
    );
  }
}
