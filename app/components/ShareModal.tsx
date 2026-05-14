"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ShareRow {
  id: string;
  kind: "share";
  grantee_id: string;
  email: string | null;
  permission: "read" | "write";
  created_at: string;
}

interface InvitationRow {
  id: string;
  kind: "invitation";
  email: string;
  permission: "read" | "write";
  token: string;
  created_at: string;
}

type Recipient = ShareRow | InvitationRow;

interface Props {
  path: string;
  title: string;
  onClose: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ShareModal({ path, title, onClose }: Props) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [exactMatchEmail, setExactMatchEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lookupSeq = useRef(0);

  // Load current shares + history-based autocomplete pool once on open.
  useEffect(() => {
    (async () => {
      const [r1, r2] = await Promise.all([
        fetch(`/api/share?path=${encodeURIComponent(path)}`).then((r) => r.json()),
        fetch(`/api/share/suggestions`).then((r) => r.json()),
      ]);
      const shares: Recipient[] = (r1.shares ?? []).concat(r1.invitations ?? []);
      setRecipients(shares);
      setSuggestions(r2.emails ?? []);
    })().catch(() => {});
  }, [path]);

  // Lookup whether the typed string is a registered user (only when it
  // looks like a complete email). Debounced; each fire bumps a sequence
  // so stale responses can't overwrite a newer state.
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!EMAIL_RE.test(q)) {
      setExactMatchEmail(null);
      return;
    }
    const mySeq = ++lookupSeq.current;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/share/lookup?email=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (lookupSeq.current !== mySeq) return;
        setExactMatchEmail(data.user?.email ?? null);
      } catch {}
    }, 200);
    return () => window.clearTimeout(t);
  }, [query]);

  const trimmed = query.trim().toLowerCase();
  const alreadySharedEmails = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipients) if (r.email) set.add(r.email.toLowerCase());
    return set;
  }, [recipients]);

  // Per spec: autocomplete only surfaces previously-invited contacts whose
  // email starts with the typed prefix. If trimmed is empty, no list (we
  // only suggest while the user is actively typing).
  const visibleSuggestions = useMemo(() => {
    if (!trimmed) return [] as string[];
    return suggestions
      .filter((s) => s.startsWith(trimmed) && s !== trimmed && !alreadySharedEmails.has(s))
      .slice(0, 5);
  }, [trimmed, suggestions, alreadySharedEmails]);

  // Reset suggestion highlight whenever the visible list changes.
  useEffect(() => { setHighlightIdx(0); }, [visibleSuggestions.length, query]);

  const isCompleteEmail = EMAIL_RE.test(trimmed);
  const isRegisteredUser = isCompleteEmail && exactMatchEmail !== null;
  const isSelfOrDuplicate = alreadySharedEmails.has(trimmed);
  // Three submit modes: pick a suggestion (existing-user share), share with
  // an exact-match registered user, or invite a non-user. The "invite"
  // affordance only appears once the input is a well-formed email.
  const canSubmit = !busy && !isSelfOrDuplicate && (isRegisteredUser || (isCompleteEmail && !isRegisteredUser));

  const submitEmail = useCallback(async (emailArg?: string) => {
    const email = (emailArg ?? trimmed).toLowerCase();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path, email, permission }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "failed");
        return;
      }
      // Optimistic refresh — fetch the canonical list so the new row appears
      // with its server-assigned id/created_at.
      const r1 = await fetch(`/api/share?path=${encodeURIComponent(path)}`).then((r) => r.json());
      setRecipients((r1.shares ?? []).concat(r1.invitations ?? []));
      // Add to local suggestions pool so the next typing session can autocomplete it.
      setSuggestions((s) => Array.from(new Set([...s, email])).sort());
      setQuery("");
      setExactMatchEmail(null);
      inputRef.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [path, permission, trimmed]);

  const revoke = useCallback(async (r: Recipient) => {
    const kind = r.kind === "invitation" ? "invitation" : "share";
    const ok = await fetch(`/api/share/${r.id}?kind=${kind}`, { method: "DELETE" }).then((r) => r.ok).catch(() => false);
    if (ok) setRecipients((list) => list.filter((x) => x.id !== r.id));
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && visibleSuggestions.length > 0) {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, visibleSuggestions.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && visibleSuggestions.length > 0) {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (visibleSuggestions.length > 0 && highlightIdx >= 0) {
        submitEmail(visibleSuggestions[highlightIdx]);
      } else if (canSubmit) {
        submitEmail();
      }
    }
  }, [visibleSuggestions, highlightIdx, canSubmit, submitEmail]);

  // What the action button says in each of the three modes.
  const submitLabel = (() => {
    if (busy) return "Sharing…";
    if (!trimmed) return "Share";
    if (isRegisteredUser) return `Share with ${trimmed}`;
    if (isCompleteEmail) return `Invite ${trimmed}`;
    return "Share";
  })();

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal share-modal" role="dialog" aria-modal="true">
        <p className="modal-title">Share</p>
        <p className="modal-subtitle">
          Share <strong>{title}</strong> with others by email.
        </p>

        <div className="modal-field share-input-wrap">
          <label className="modal-label" htmlFor="share-email">Add people</label>
          <div className="share-input-row">
            <input
              id="share-email"
              ref={inputRef}
              className="modal-input"
              type="email"
              autoComplete="off"
              placeholder="name@example.com"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
            />
            <select
              className="share-permission"
              value={permission}
              onChange={(e) => setPermission(e.target.value as "read" | "write")}
              aria-label="Permission"
            >
              <option value="read">Read</option>
              <option value="write">Write</option>
            </select>
          </div>

          {visibleSuggestions.length > 0 && (
            <div className="share-suggestions" role="listbox">
              {visibleSuggestions.map((s, i) => (
                <div
                  key={s}
                  className="share-suggestion"
                  data-highlight={i === highlightIdx}
                  onMouseEnter={() => setHighlightIdx(i)}
                  onClick={() => submitEmail(s)}
                  role="option"
                  aria-selected={i === highlightIdx}
                >
                  <span className="share-suggestion-email">{s}</span>
                  <span className="share-suggestion-meta">previously shared</span>
                </div>
              ))}
            </div>
          )}

          {trimmed && visibleSuggestions.length === 0 && (
            <div className="share-hint">
              {isSelfOrDuplicate ? (
                <span className="share-hint-error">Already shared with {trimmed}</span>
              ) : isRegisteredUser ? (
                <span>↩ Press Enter to share with <strong>{trimmed}</strong> (registered user)</span>
              ) : isCompleteEmail ? (
                <span>↩ Press Enter to invite <strong>{trimmed}</strong></span>
              ) : (
                <span>Keep typing the full email — no match yet</span>
              )}
            </div>
          )}
        </div>

        {recipients.length > 0 && (
          <div className="share-list">
            <p className="share-list-title">People with access</p>
            {recipients.map((r) => (
              <div key={r.id} className="share-list-row">
                <div className="share-list-info">
                  <span className="share-list-email">{r.email ?? "(no email)"}</span>
                  <span className="share-list-meta">
                    {r.kind === "invitation" ? "pending invitation" : "active"}
                    {" · "}{r.permission}
                  </span>
                </div>
                <button
                  className="btn-ghost share-revoke"
                  onClick={() => revoke(r)}
                  type="button"
                  title="Revoke access"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="share-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose} type="button">Done</button>
          <button
            className="btn-primary"
            onClick={() => submitEmail()}
            disabled={!canSubmit}
            type="button"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
