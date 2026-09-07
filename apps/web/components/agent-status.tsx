"use client";

import { useEffect, useState } from "react";

type AgentState = "checking" | "available" | "unavailable";
type AgentStatusResult = { available?: boolean; reason?: string };

const statusCopy: Record<AgentState, string> = {
  checking: "Checking agent",
  available: "Agent ready",
  unavailable: "Agent unavailable",
};
const reasonCopy: Record<string, string> = {
  missing_key: "OPENAI_API_KEY is not configured",
  invalid_key: "The OpenAI API key was rejected",
  access_denied: "The configured model is not accessible",
  model_unavailable: "The configured model is unavailable",
  rate_limited: "OpenAI is rate limiting requests or the account has no available quota",
  network_error: "OpenAI could not be reached",
  request_failed: "The agent request failed",
};

export function AgentStatus() {
  const [status, setStatus] = useState<AgentState>("checking");
  const [detail, setDetail] = useState(statusCopy.checking);

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/assistant/status", { cache: "no-store" });
        const result = await response.json() as AgentStatusResult;
        if (active) {
          setStatus(result.available ? "available" : "unavailable");
          setDetail(result.available ? statusCopy.available : reasonCopy[result.reason ?? ""] ?? statusCopy.unavailable);
        }
      } catch {
        if (active) {
          setStatus("unavailable");
          setDetail(reasonCopy.network_error);
        }
      }
    };
    checkStatus();
    const interval = window.setInterval(checkStatus, 300_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return <span className={`agent-status ${status}`} title={detail} aria-label={detail}><i aria-hidden="true" />{statusCopy[status]}</span>;
}
