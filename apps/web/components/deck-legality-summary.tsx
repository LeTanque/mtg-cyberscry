import { CheckCircle2, TriangleAlert } from "lucide-react";
import type { DeckLegality } from "@/lib/deck-legality";

export function DeckLegalitySummary({status}:{status:DeckLegality}) {
  if(status.valid)return <div className="legality-summary valid"><CheckCircle2/><div><strong>This deck is good to go</strong><p>No Commander format problems found.</p></div></div>;
  return <div className="legality-summary warning"><TriangleAlert/><div><strong>{status.issues.length} deck {status.issues.length===1?"problem":"problems"}</strong><ul>{status.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></div></div>;
}
