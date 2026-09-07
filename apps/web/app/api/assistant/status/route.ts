import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function unavailableReason(responseStatus: number) {
  if (responseStatus === 401) return "invalid_key";
  if (responseStatus === 403) return "access_denied";
  if (responseStatus === 404) return "model_unavailable";
  if (responseStatus === 429) return "rate_limited";
  return "request_failed";
}

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.4";
  if (!apiKey) return NextResponse.json({ available: false, model, reason: "missing_key" });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: "Reply with OK.", max_output_tokens: 16, store: false }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    return NextResponse.json({ available: response.ok, model, reason: response.ok ? "ready" : unavailableReason(response.status) });
  } catch {
    return NextResponse.json({ available: false, model, reason: "network_error" });
  }
}
