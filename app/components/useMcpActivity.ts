"use client";
import { useEffect, useRef } from "react";

export type ActionKind =
  | "read"
  | "write"
  | "delete"
  | "rename"
  | "search"
  | "lint"
  | "other";

export interface McpActivityEvent {
  id: string;
  tool_name: string;
  doc_path: string | null;
  action_kind: ActionKind;
  clerk_id: string;
  created_at: string;
}

/**
 * Subscribe to MCP tool-call events for a namespace. Mirrors the SSE
 * half of useDocsChanged — the server route /api/mcp-activity polls
 * the mcp_activity table (service role) and forwards rows as SSE.
 *
 * The hook is a no-op for the "public" namespace (no per-vault auth).
 * EventSource auto-reconnects when the server-side 50s stream cap
 * expires, so events keep flowing without extra plumbing.
 */
export function useMcpActivity(
  namespace: string,
  onEvent: (e: McpActivityEvent) => void,
): void {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!namespace || namespace === "public") return;
    // SPRINT-037: only hold the SSE connection open while the tab is
    // visible. The server-side poll loop runs every POLL_INTERVAL_MS as
    // long as the stream is connected; closing the EventSource when the
    // tab goes hidden stops that polling. Reopens on visibility-restore.
    let es: EventSource | null = null;
    const open = () => {
      if (es) return;
      es = new EventSource(`/api/mcp-activity?ns=${encodeURIComponent(namespace)}`);
      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as McpActivityEvent;
          onEventRef.current(parsed);
        } catch {
          // Malformed payload — drop it. Pulse fidelity isn't worth a throw.
        }
      };
    };
    const close = () => {
      if (es) {
        es.close();
        es = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") open();
      else close();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "visible") open();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      close();
    };
  }, [namespace]);
}
