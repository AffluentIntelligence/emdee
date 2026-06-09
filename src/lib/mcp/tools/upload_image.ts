import Anthropic from "@anthropic-ai/sdk";
import { adminClient } from "../../supabase/admin";
import { writeVaultFile } from "./vault";
import type { ToolContext } from "./types";

const IMAGE_BUCKET = "vault-images";

const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedMediaType = (typeof SUPPORTED_TYPES)[number];

function ext(mediaType: SupportedMediaType): string {
  const map: Record<SupportedMediaType, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[mediaType];
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function json(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

async function describe(imageData: string, mediaType: SupportedMediaType): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "";
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageData },
          },
          {
            type: "text",
            text: "Describe this image in 1-2 sentences for a personal knowledge base. Be specific: what is shown, any visible text, context and key details.",
          },
        ],
      },
    ],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

export async function uploadImage(ctx: ToolContext, args: Record<string, unknown>): Promise<unknown> {
  if (ctx.mode === "local") {
    return json({ error: "upload_image requires cloud mode — not available in local (stdio) mode" });
  }

  const imageData = String(args.image_data ?? "");
  const mediaType = String(args.media_type ?? "") as SupportedMediaType;
  const titleArg = args.title !== undefined ? String(args.title) : null;
  const pathArg = args.path !== undefined ? String(args.path) : null;
  const wantDescription = args.describe !== false;

  if (!imageData) return json({ error: "image_data is required" });
  if (!(SUPPORTED_TYPES as readonly string[]).includes(mediaType)) {
    return json({ error: `unsupported media_type — must be one of: ${SUPPORTED_TYPES.join(", ")}` });
  }

  // Validate base64 — Buffer.from will throw on truly malformed data
  let imageBuffer: Buffer;
  try {
    imageBuffer = Buffer.from(imageData, "base64");
  } catch {
    return json({ error: "image_data is not valid base64" });
  }
  if (imageBuffer.length === 0) return json({ error: "image_data decoded to empty buffer" });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${ts}.${ext(mediaType)}`;
  const storagePath = `${ctx.userId}/${filename}`;

  // Upload to vault-images bucket
  const { error: uploadErr } = await adminClient()
    .storage
    .from(IMAGE_BUCKET)
    .upload(storagePath, imageBuffer, { contentType: mediaType, upsert: false });

  if (uploadErr) return json({ error: `storage upload failed: ${uploadErr.message}` });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const imageUrl = `${supabaseUrl}/storage/v1/object/public/${IMAGE_BUCKET}/${storagePath}`;

  // Auto-describe
  let description = "";
  if (wantDescription) {
    try {
      description = await describe(imageData, mediaType);
    } catch (e) {
      // Non-fatal — ship the doc without a description rather than failing
      console.error("upload_image: describe failed:", e);
    }
  }

  const title = titleArg ?? `Image ${ts.slice(0, 10)}`;
  const summary = description || "Image uploaded via MCP";

  // Derive vault doc path
  const docSlug = titleArg ? slugify(titleArg) : ts.slice(0, 10);
  const docPath = pathArg ?? `images/${docSlug}.md`;

  const docContent = `# ${title}\n\n> ${summary}\n\n![${title}](${imageUrl})\n\n## Notes\n\n`;

  await writeVaultFile(ctx, docPath, docContent);

  return json({ doc_path: docPath, image_url: imageUrl, description, doc_created: true });
}
