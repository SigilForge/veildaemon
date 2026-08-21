"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const RELAY_ORIGIN = "https://relay.veildaemon.app";

type Props = {
  allowed: boolean;
};

export function RelayAccessClient({ allowed }: Props) {
  const [detail, setDetail] = useState(allowed ? "Handing the VeilLink session to RelayDaemon…" : "This VeilLink account is not authorized for RelayDaemon.");

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.access_token) {
        window.location.replace("/login?next=/relay-access");
        return;
      }
      const params = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token || "",
        expires_in: String(session.expires_in || 3600),
        token_type: "bearer",
        type: "relay",
      });
      if (cancelled) return;
      window.location.replace(`${RELAY_ORIGIN}/#${params.toString()}`);
    })().catch(() => {
      if (!cancelled) setDetail("Could not continue to RelayDaemon. Sign in again.");
    });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  return (
    <main className="page">
      <p className="eyebrow">RelayDaemon</p>
      <h1 className="page-title">Operator access</h1>
      <p className="lede">{detail}</p>
    </main>
  );
}
