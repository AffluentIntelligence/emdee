import { validatePath, readVaultFile } from "./vault";
import { lintDocContent } from "./lint";
import type { ToolContext } from "./types";

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/**
 * Audit a doc for known quality defects. Returns warnings + structural info.
 * Never throws on a "bad" doc — lint is a signal, not a gate. For the same
 * lint logic at write time, see the integration in write_doc and patch_section.
 */
export async function lintDoc(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const rel = String(args.path);
  validatePath(rel);
  const content = await readVaultFile(ctx, rel);
  if (content === null) return json({ error: "doc_not_found", path: rel });

  const result = lintDocContent(content);
  return json({ path: rel, ...result });
}
