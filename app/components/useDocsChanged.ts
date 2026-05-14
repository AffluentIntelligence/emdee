"use client";
import { useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 3000;

/**
 * Fires `onChanged` whenever the vault namespace changes. In local dev the
 * `/api/changes` SSE delivers fs-watch events instantly. In cloud (where
 * MCP writes go through Supabase from outside the browser) we also poll
 * `/api/changes-version` so external writes — Claude.ai editing your docs
 * via MCP, another tab pushing — show up within a few seconds.
 */
export function useDocsChanged(namespace: string, onChanged: () => void) {
  const ref = useRef(onChanged);
  ref.current = onChanged;

  useEffect(() => {
    const es = new EventSource("/api/changes");
    es.onmessage = () => ref.current();

    let lastVersion: string | null = null;
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/changes-version?ns=${encodeURIComponent(namespace)}`, { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version: string | null };
        if (cancelled) return;
        if (lastVersion !== null && version !== lastVersion) ref.current();
        lastVersion = version;
      } catch {
        // network blip — try again next tick
      } finally {
        if (!cancelled && document.visibilityState === "visible") {
          timer = window.setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    // Kick off polling immediately on mount; pause when tab is hidden so we
    // don't burn requests/network in background tabs.
    const start = () => {
      if (timer != null) return;
      poll();
    };
    const stop = () => {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      cancelled = true;
      es.close();
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [namespace]);
}
