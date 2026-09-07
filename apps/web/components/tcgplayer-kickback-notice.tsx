"use client";

import { useEffect, useState } from "react";

type KickbackStatus = {
  active: boolean;
  percent: string | null;
  productTypes: string[] | null;
  productLines: string[] | null;
  stale: boolean;
};

export function TcgplayerKickbackNotice() {
  const [status, setStatus] = useState<KickbackStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/integrations/tcgplayer/kickbacks", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as KickbackStatus;
      })
      .then((result) => {
        if (mounted && result) setStatus(result);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const scope = [
    ...(status?.productLines ?? []).filter((line) => line === "Magic"),
    ...(status?.productTypes ?? []).filter((type) => type === "Singles"),
  ];

  return (
    <div className="tcgplayer-kickback-notice">
      <p>
        <strong>Affiliate link:</strong> Cyberscry may earn a commission if you
        purchase through TCGplayer links. Your price is unchanged.
      </p>
      {status?.active && (
        <p className="tcgplayer-kickback-active">
          TCGplayer is currently offering a {status.percent}% affiliate kickback
          {scope.length ? ` for ${scope.join(" · ")}` : ""}
          {status.stale ? " (last known status)" : ""}.
        </p>
      )}
    </div>
  );
}
