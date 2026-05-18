import { validatePath, writeVaultFile } from "./vault";
import { lintDocContent } from "./lint";
import type { ToolContext } from "./types";

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/**
 * Create or overwrite a doc. Returns an envelope including any lint warnings
 * surfaced from the just-written content (missing preamble, undeclared
 * inline mentions). Warnings are signal, not gate — the write always
 * succeeds; the caller decides whether to act on them.
 */
export async function writeDoc(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const rel = String(args.path);
  validatePath(rel);
  const content = String(args.content ?? "");
  await writeVaultFile(ctx, rel, content);

  const lint = lintDocContent(content);
  const payload: Record<string, unknown> = { ok: true, path: rel, message: `wrote ${rel}` };
  if (lint.warnings.length > 0) payload.warnings = lint.warnings;
  return json(payload);
}
