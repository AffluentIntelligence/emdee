"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphView } from "./GraphView";
import { DocEditor } from "./DocEditor";
import type { DocIndex, DocNode } from "@/src/core/indexer";

interface Publication {
  id: string;
  handle: string;
  slug: string;
  root_doc_path: string;
  owner_email: string | null;
}

interface Props {
  publication: Publication;
  index: DocIndex;
  isSignedIn: boolean;
}

/**
 * Lean public render of a published subtree. Reuses GraphView + DocEditor
 * but skips the full App shell (no sidebar tree, no edit toolbar, no save
 * pipeline). All wiki-links in the markdown have already been rewritten
 * server-side — out-of-set ones are plain text by the time we get here,
 * so the DocEditor's wiki-link click handler only fires on in-set targets.
 */
export function PublicShareView({ publication, index, isSignedIn }: Props) {
  const [activePath, setActivePath] = useState<string>(publication.root_doc_path);
  const viewLoggedRef = useRef(false);

  // Map title → DocNode for wiki-link click routing.
  const byTitle = useMemo(() => {
    const m = new Map<string, DocNode>();
    for (const d of index.docs) m.set(d.title.toLowerCase(), d);
    return m;
  }, [index]);
  const byPath = useMemo(() => {
    const m = new Map<string, DocNode>();
    for (const d of index.docs) m.set(d.path, d);
    return m;
  }, [index]);

  const activeDoc = byPath.get(activePath) ?? null;

  // Telemetry. Page-load `view` fires once; `doc_open` fires each time the
  // user navigates to a non-root doc. Failures are swallowed — telemetry
  // is signal, not a hard requirement.
  const logEvent = useCallback(
    (eventType: string, docPath?: string) => {
      fetch("/api/publication-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publication_id: publication.id,
          event_type: eventType,
          doc_path: docPath ?? null,
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [publication.id]
  );

  useEffect(() => {
    if (viewLoggedRef.current) return;
    viewLoggedRef.current = true;
    logEvent("view");
  }, [logEvent]);

  const selectDoc = useCallback(
    (path: string) => {
      if (path === activePath) return;
      setActivePath(path);
      if (path !== publication.root_doc_path) logEvent("doc_open", path);
    },
    [activePath, logEvent, publication.root_doc_path]
  );

  // Wiki-link clicks from the DocEditor (rendered mode) resolve by title.
  // Out-of-set titles never become wiki-links (rewritten server-side), so
  // any miss here is a vault-state edge case — silently ignore.
  const handleWikiLinkClick = useCallback(
    (title: string) => {
      const doc = byTitle.get(title.toLowerCase());
      if (doc) selectDoc(doc.path);
    },
    [byTitle, selectDoc]
  );

  // Prev/next sibling derivation reuses the shared helper via the index.
  // Because the index is already scoped, in-set siblings are naturally
  // the only ones returned.
  const { prevSibling, nextSibling } = useMemo<{
    prevSibling: DocNode | null;
    nextSibling: DocNode | null;
  }>(() => {
    if (!activeDoc) return { prevSibling: null, nextSibling: null };
    const primaryParent = activeDoc.parents[0];
    if (!primaryParent) return { prevSibling: null, nextSibling: null };
    const parentDoc = byTitle.get(primaryParent.title.toLowerCase());
    if (!parentDoc) return { prevSibling: null, nextSibling: null };
    const siblings = parentDoc.children
      .map((l) => byTitle.get(l.title.toLowerCase()))
      .filter((d): d is DocNode => !!d);
    const idx = siblings.findIndex((d) => d.path === activeDoc.path);
    if (idx === -1) return { prevSibling: null, nextSibling: null };
    return {
      prevSibling: siblings[idx - 1] ?? null,
      nextSibling: siblings[idx + 1] ?? null,
    };
  }, [activeDoc, byTitle]);

  const onSignupClick = useCallback(() => {
    logEvent("signup_click");
    // Clerk's sign-up URL with attribution. Param is intentionally simple
    // (`ref`) so post-signup attribution can pick it up later via webhook
    // or the user's first landing on the app.
    window.location.href = `/sign-up?ref=${encodeURIComponent(`${publication.handle}/${publication.slug}`)}`;
  }, [logEvent, publication.handle, publication.slug]);

  const onSubscribeClick = useCallback(() => {
    logEvent("subscribe_click");
    // Phase 4 wires the actual subscription. For tonight, surface a friendly
    // notice so the CTA isn't dead — and the click is still logged.
    alert(
      "Subscribe is coming soon — saving this vault to your own VAULT > SHARED so your AI can read it too. We logged your interest; you'll get an email when it ships."
    );
  }, [logEvent]);

  return (
    <div className="public-share-root">
      <header className="public-share-header">
        <div className="public-share-title">
          <span className="public-share-handle">{publication.handle}</span>
          <span className="public-share-sep">/</span>
          <span className="public-share-slug">{publication.slug}</span>
        </div>
        <div className="public-share-actions">
          {isSignedIn ? (
            <button className="public-share-cta" onClick={onSubscribeClick} type="button">
              Save to my vault
            </button>
          ) : (
            <button className="public-share-cta" onClick={onSignupClick} type="button">
              Sign up free
            </button>
          )}
        </div>
      </header>

      <div className="public-share-body">
        {!isSignedIn && (
          <aside className="public-share-sidebar">
            <div className="public-share-card">
              <h2>EMDEE</h2>
              <p>You&rsquo;re reading a published vault — a graph of interlinked notes.</p>
              <p>Click any node to read it. Use the graph and breadcrumbs to navigate.</p>
              <button className="public-share-cta-strong" onClick={onSignupClick} type="button">
                Get your own vault &rarr;
              </button>
              <p className="public-share-card-foot">
                Free to sign up. Your notes, your graph, your AI&rsquo;s context.
              </p>
            </div>
          </aside>
        )}
        <main className="public-share-main">
          <div className="public-share-graph">
            <GraphView
              index={index}
              activePath={activePath}
              onSelect={selectDoc}
              prevSibling={prevSibling}
              nextSibling={nextSibling}
            />
          </div>
          <div className="public-share-doc">
            {activeDoc ? (
              <>
                <div className="public-share-doc-title">{activeDoc.title}</div>
                <div className="public-share-doc-host">
                  <DocEditor
                    path={`__public__:${activeDoc.path}`}
                    initialContent={activeDoc.content}
                    mode="rendered"
                    onChange={() => {}}
                    onWikiLinkClick={handleWikiLinkClick}
                    readOnly
                  />
                </div>
              </>
            ) : (
              <div className="public-share-empty">Pick a node from the graph to start reading.</div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
