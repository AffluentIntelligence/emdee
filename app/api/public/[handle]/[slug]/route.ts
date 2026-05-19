import { adminClient } from "@/src/lib/supabase/admin";
import { getVaultStorage } from "@/src/lib/storage";
import { buildIndexFromContents } from "@/src/core/indexer";
import { rewriteForPublic, scopeIndex } from "@/src/lib/publications/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  params: Promise<{ handle: string; slug: string }>;
}

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/**
 * Anonymous-readable scoped vault index for a published subtree.
 *
 * Resolves /api/public/<handle>/<slug> → publication row → owner's vault →
 * scoped DocIndex containing only the publication's included_paths, with
 * each doc's markdown rewritten so out-of-set wiki-links become plain text
 * and relationship sections (Child of / Parent of / Associated with) keep
 * only in-set bullets.
 */
export async function GET(_: Request, { params }: Params) {
  const { handle, slug } = await params;
  if (!handle || !slug) return Response.json({ error: "not_found" }, { status: 404 });

  const admin = adminClient();
  const { data: owner, error: ownerErr } = await admin
    .from("profiles")
    .select("clerk_id, handle, email")
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (ownerErr || !owner) return Response.json({ error: "not_found" }, { status: 404 });

  const { data: pub, error: pubErr } = await admin
    .from("publications")
    .select("id, slug, root_doc_path, included_paths")
    .eq("owner_id", owner.clerk_id)
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (pubErr || !pub) return Response.json({ error: "not_found" }, { status: 404 });

  // Load the owner's vault and build the full index, then scope down.
  const { storage, prefix } = getVaultStorage(owner.clerk_id);
  const listed = await storage.listWithContent(prefix || undefined);
  const files = listed.map((f) => ({
    path: prefix ? f.path.slice(prefix.length) : f.path,
    content: f.content,
  }));
  const fullIndex = buildIndexFromContents(files);

  // Stale-path filter: published may reference docs that have since been
  // deleted. Drop missing paths silently — re-publish refreshes the list.
  const existingPaths = new Set(fullIndex.docs.map((d) => d.path));
  const includedPaths = (pub.included_paths as string[]).filter((p) =>
    existingPaths.has(p)
  );

  const scoped = scopeIndex(fullIndex, includedPaths);

  // Rewrite each doc's markdown for public consumption.
  const includedTitlesLower = new Set(scoped.docs.map((d) => d.title.toLowerCase()));
  const rewrittenDocs = scoped.docs.map((d) => ({
    ...d,
    content: rewriteForPublic(d.content, includedTitlesLower),
  }));

  // Re-build the index from the rewritten markdown so the doc body, the
  // graph edges, and the prev/next derivation all agree on what's public.
  const rewrittenIndex = buildIndexFromContents(
    rewrittenDocs.map((d) => ({ path: d.path, content: d.content }))
  );

  return Response.json(
    {
      publication: {
        id: pub.id,
        handle: owner.handle,
        slug: pub.slug,
        root_doc_path: pub.root_doc_path,
        owner_email: owner.email,
      },
      index: {
        docs: rewrittenIndex.docs,
        edges: rewrittenIndex.edges,
        entry: includedPaths.includes(pub.root_doc_path) ? pub.root_doc_path : (rewrittenIndex.entry ?? null),
      },
    },
    NO_STORE
  );
}
