import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildIndex, buildIndexFromContents, type DocIndex } from "../../../core/indexer";
import { adminClient } from "../../supabase/admin";
import type { ToolContext } from "./types";

/**
 * Paths under SHARED_PATH_PREFIX point at docs owned by another user that
 * this user has been granted read access to. Format:
 *   __shared__/<owner_clerk_id>/<rel_path>
 * These look like normal vault paths to MCP clients but are routed
 * cross-namespace by readVaultFile and refused by every write op.
 */
export const SHARED_PATH_PREFIX = "__shared__/";

export function validatePath(rel: string): void {
  if (!rel || rel.includes("..")) throw new Error("invalid path");
  if (!rel.endsWith(".md")) throw new Error("path must end in .md");
}

function localSafePath(docsDir: string, rel: string): string {
  const resolved = path.resolve(docsDir, rel);
  if (!resolved.startsWith(docsDir + path.sep) && resolved !== docsDir) {
    throw new Error("path escapes docs directory");
  }
  return resolved;
}

function parseSharedPath(rel: string): { ownerId: string; relPath: string } | null {
  if (!rel.startsWith(SHARED_PATH_PREFIX)) return null;
  const rest = rel.slice(SHARED_PATH_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  return { ownerId: rest.slice(0, slash), relPath: rest.slice(slash + 1) };
}

async function listSharedDocsForGrantee(granteeId: string): Promise<Array<{ ownerId: string; relPath: string }>> {
  const { data } = await adminClient()
    .from("doc_shares")
    .select("owner_id, path_prefix")
    .eq("grantee_id", granteeId);
  return (data ?? []).map((r) => ({ ownerId: r.owner_id as string, relPath: r.path_prefix as string }));
}

async function hasShareAccess(granteeId: string, ownerId: string, relPath: string): Promise<boolean> {
  const { data } = await adminClient()
    .from("doc_shares")
    .select("id")
    .eq("grantee_id", granteeId)
    .eq("owner_id", ownerId)
    .eq("path_prefix", relPath)
    .maybeSingle();
  return !!data;
}

/**
 * Builds the index of the user's own vault, then appends docs shared with
 * them. Edges from the two sub-indexes don't cross-link — wiki-link
 * resolution stays within each owner's namespace, so the grantee can
 * navigate shared docs by title without leaking back to their own vault.
 */
export async function loadVaultIndex(ctx: ToolContext): Promise<DocIndex> {
  if (ctx.mode === "local") return buildIndex(ctx.docsDir);

  const ownPrefix = `${ctx.userId}/`;
  const ownFiles = await ctx.storage.list(ownPrefix);
  const ownWithContent = await Promise.all(
    ownFiles.map(async (f) => ({
      path: f.path.slice(ownPrefix.length),
      content: (await ctx.storage.read(f.path)) ?? "",
    }))
  );
  const ownIndex = buildIndexFromContents(ownWithContent);

  const shared = await listSharedDocsForGrantee(ctx.userId);
  if (shared.length === 0) return ownIndex;

  const sharedFiles = await Promise.all(
    shared.map(async (s) => ({
      path: `${SHARED_PATH_PREFIX}${s.ownerId}/${s.relPath}`,
      content: (await ctx.storage.read(`${s.ownerId}/${s.relPath}`)) ?? "",
    }))
  );
  const sharedIndex = buildIndexFromContents(sharedFiles);

  return {
    docs: [...ownIndex.docs, ...sharedIndex.docs],
    edges: [...ownIndex.edges, ...sharedIndex.edges],
    entry: ownIndex.entry,
  };
}

export async function readVaultFile(ctx: ToolContext, rel: string): Promise<string | null> {
  if (ctx.mode === "local") {
    try {
      return await readFile(localSafePath(ctx.docsDir, rel), "utf8");
    } catch {
      return null;
    }
  }
  const shared = parseSharedPath(rel);
  if (shared) {
    const allowed = await hasShareAccess(ctx.userId, shared.ownerId, shared.relPath);
    if (!allowed) return null;
    return ctx.storage.read(`${shared.ownerId}/${shared.relPath}`);
  }
  return ctx.storage.read(`${ctx.userId}/${rel}`);
}

export async function writeVaultFile(ctx: ToolContext, rel: string, content: string): Promise<void> {
  if (rel.startsWith(SHARED_PATH_PREFIX)) {
    throw new Error("shared docs are read-only — ask the owner to make the edit");
  }
  if (ctx.mode === "local") {
    const file = localSafePath(ctx.docsDir, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, "utf8");
    return;
  }
  await ctx.storage.write(`${ctx.userId}/${rel}`, content);
}

export async function deleteVaultFile(ctx: ToolContext, rel: string): Promise<void> {
  if (rel.startsWith(SHARED_PATH_PREFIX)) {
    throw new Error("shared docs are read-only — ask the owner to delete");
  }
  if (ctx.mode === "local") {
    await rm(localSafePath(ctx.docsDir, rel), { force: true });
    return;
  }
  await ctx.storage.delete(`${ctx.userId}/${rel}`);
}
