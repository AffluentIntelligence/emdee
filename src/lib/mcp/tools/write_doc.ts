import { validatePath, writeVaultFile } from "./vault.js";
import type { ToolContext } from "./types.js";

export async function writeDoc(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const rel = String(args.path);
  validatePath(rel);
  await writeVaultFile(ctx, rel, String(args.content ?? ""));
  return { content: [{ type: "text", text: `wrote ${rel}` }] };
}
