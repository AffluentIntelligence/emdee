import { auth } from "@clerk/nextjs/server";
import { getVaultStorage } from "@/src/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DocStamp {
  path: string;
  updated_at: string;
}

/**
 * Per-path version endpoint for change polling. Returns
 * `{ version, docs: [{path, updated_at}, ...] }`.
 *
 * SPRINT-024 Phase 4: previously returned only the namespace-wide max
 * `updated_at`. Clients then refetched the full index on every change.
 * The per-path list lets `useDocsChanged` diff the previous Map against
 * the current one — true zero-op when nothing changed, narrow scope
 * (changed-paths only) when something did.
 *
 * Spec-vs-codebase note: the sprint asked for a push broadcast carrying
 * `doc_content_hash` per change. The codebase has no per-write push
 * channel (only a poll); adding `doc_content_hash` here would mean
 * either fetching every body each poll (defeats listMeta) or a new
 * vault_files.content_hash column (out of scope). Using `updated_at`
 * as the change signal + Phase 3's ETag on `/api/doc` as the content
 * confirmation gives the same end behaviour without those costs.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ns = url.searchParams.get("ns") ?? "public";
  const { storage, prefix, isLocal } = getVaultStorage(ns);

  if (!isLocal && ns !== "public") {
    const { userId } = await auth();
    if (!userId || userId !== ns) {
      return Response.json(
        { version: null, docs: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  try {
    const listed = await storage.listMeta(prefix || undefined);
    const docs: DocStamp[] = listed.map((f) => ({
      path: prefix ? f.path.slice(prefix.length) : f.path,
      updated_at: f.updatedAt,
    }));
    const version = docs.reduce((max, d) => (d.updated_at > max ? d.updated_at : max), "");
    // SPRINT-037: ETag = `"${count}-${maxUpdatedAt}"`. Captures add/delete
    // (count moves), any edit (max ts moves), and rename (rename touches
    // updated_at). When the client sends a matching If-None-Match,
    // return 304 with no body — saves ~99% of polling payload bytes
    // since almost every poll confirms "nothing changed".
    const etag = `"${docs.length}-${version || "empty"}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": "no-store" },
      });
    }
    return Response.json(
      { version: version || null, docs },
      { headers: { "Cache-Control": "no-store", ETag: etag } },
    );
  } catch {
    return Response.json(
      { version: null, docs: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
