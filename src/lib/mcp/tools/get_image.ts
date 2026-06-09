import { readVaultFile, validatePath } from "./vault";
import type { ToolContext } from "./types";

function err(text: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: text }) }] };
}

/**
 * Fetch an image doc from the vault and return both its metadata and the raw
 * image bytes as an MCP image content block so Claude can visually analyze it.
 *
 * Workflow for batch labelling:
 *   1. list_docs → find images/*.md with "_description pending_" in summary
 *   2. get_image(doc_path) → Claude sees the image
 *   3. patch_preamble → write a real description as the blockquote summary
 *   4. add_association → link to relevant project / person / event docs
 */
export async function getImage(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  const docPath = String(args.doc_path ?? "").trim();
  if (!docPath) return err("doc_path is required");

  try { validatePath(docPath); } catch (e) { return err(String(e)); }

  const raw = await readVaultFile(ctx, docPath);
  if (!raw) return err(`doc not found: ${docPath}`);

  // Extract the first image URL from the doc body.
  const m = raw.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
  if (!m) return err(`no image URL found in ${docPath}`);
  const imageUrl = m[1];

  // Fetch the image binary.
  let imageResp: Response;
  try {
    imageResp = await fetch(imageUrl);
  } catch (e) {
    return err(`failed to fetch image: ${String(e)}`);
  }
  if (!imageResp.ok) return err(`image fetch returned ${imageResp.status}`);

  const contentType = imageResp.headers.get("content-type") ?? "image/jpeg";
  const mimeType = contentType.split(";")[0].trim();

  const buffer = Buffer.from(await imageResp.arrayBuffer());
  if (buffer.length === 0) return err("image fetch returned empty body");

  const base64 = buffer.toString("base64");

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ doc_path: docPath, image_url: imageUrl }),
      },
      {
        type: "image" as const,
        data: base64,
        mimeType,
      },
    ],
  };
}
