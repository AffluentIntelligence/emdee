import { createHash } from "node:crypto";
import { validatePath, readVaultFile, writeVaultFile } from "./vault";
import type { ToolContext } from "./types";

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function hashBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex").slice(0, 16);
}

/**
 * Append content to the very end of a doc — after every existing section.
 *
 * Separate from `append_section`, which lands inside a named section's body
 * (which is *mid-doc* whenever that section isn't last). For chronological
 * note-taking — LOGS entries, daily notes, anywhere new content should land
 * at the bottom of the page regardless of section structure — this is the
 * right primitive. The body may include its own `##` headings to introduce
 * new sections at the end.
 */
export async function appendDoc(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const rel = String(args.path);
  validatePath(rel);
  const body = String(args.body ?? "");
  if (!body.trim()) throw new Error("body required");

  const content = await readVaultFile(ctx, rel);
  if (content === null) return json({ error: "doc_not_found", path: rel });

  // Normalise trailing whitespace so the new content starts on its own
  // paragraph, regardless of whether the existing doc ended cleanly.
  const trimmed = content.replace(/\s+$/, "");
  const newContent = trimmed + "\n\n" + body.replace(/\s+$/, "") + "\n";
  await writeVaultFile(ctx, rel, newContent);
  return json({ ok: true, content_hash: hashBody(body.trim()) });
}
