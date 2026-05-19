"use client";
import { useEffect, useState } from "react";

interface Props {
  focalPath: string;
  focalTitle: string;
  onClose: () => void;
}

interface PublishResponse {
  ok: boolean;
  publication_id?: string;
  url?: string;
  included_count?: number;
  error?: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * Lean publish modal for SPRINT-017 phase 1. No tree picker for tonight —
 * the two toggles (descendants / direct associates) plus an optional slug
 * input is enough to publish the GBI subtree. Full custom-picker UI is a
 * follow-up.
 */
export function PublishModal({ focalPath, focalTitle, onClose }: Props) {
  const [slug, setSlug] = useState(slugify(focalTitle));
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [includeAssociates, setIncludeAssociates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResponse | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (busy || !slug) return;
    setBusy(true);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          root_doc_path: focalPath,
          include_descendants: includeDescendants,
          include_direct_associates: includeAssociates,
        }),
      });
      const data = (await res.json()) as PublishResponse;
      setResult(data);
    } catch {
      setResult({ ok: false, error: "network" });
    } finally {
      setBusy(false);
    }
  };

  const fullUrl =
    result?.url && typeof window !== "undefined"
      ? `${window.location.origin}${result.url}`
      : null;

  return (
    <div className="publish-modal-backdrop" onClick={onClose}>
      <div className="publish-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Publish to a public link</h2>
        <p>
          Creates a read-only URL anyone can visit. Currently publishing the subtree rooted at{" "}
          <strong>{focalTitle}</strong>.
        </p>

        <label>
          <span>URL slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="e.g. zhenming-gbi-notes"
            disabled={busy || !!result?.ok}
          />
        </label>

        <div className="publish-modal-toggles">
          <label>
            <input
              type="checkbox"
              checked={includeDescendants}
              onChange={(e) => setIncludeDescendants(e.target.checked)}
              disabled={busy || !!result?.ok}
            />
            <span>Include all descendants (children, grandchildren, &hellip;)</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={includeAssociates}
              onChange={(e) => setIncludeAssociates(e.target.checked)}
              disabled={busy || !!result?.ok}
            />
            <span>Include direct associates (one hop only)</span>
          </label>
        </div>

        {result?.ok && fullUrl && (
          <div className="publish-modal-result">
            <div>
              Published with {result.included_count} doc{result.included_count === 1 ? "" : "s"}.
            </div>
            <div>
              <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                {fullUrl}
              </a>
            </div>
            <button
              type="button"
              style={{ marginTop: 6, fontSize: 12 }}
              onClick={() => navigator.clipboard.writeText(fullUrl)}
            >
              Copy URL
            </button>
          </div>
        )}

        {result && !result.ok && (
          <div className="publish-modal-result" style={{ color: "#c43" }}>
            Error: {result.error ?? "unknown"}
          </div>
        )}

        <div className="publish-modal-actions">
          <button type="button" onClick={onClose}>
            {result?.ok ? "Done" : "Cancel"}
          </button>
          {!result?.ok && (
            <button
              type="button"
              className="primary"
              onClick={submit}
              disabled={busy || !slug}
            >
              {busy ? "Publishing…" : "Publish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
