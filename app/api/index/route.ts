import { buildIndexFromContents } from "@/src/core/indexer";
import { SupabaseStorage } from "@/src/lib/storage/SupabaseStorage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERSION_MARKER = "v2-supabase-only-2026-05-14";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ns = url.searchParams.get("ns") ?? "public";
  const debug = url.searchParams.get("debug") === "1";

  const diag = {
    version: VERSION_MARKER,
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSecretKey: !!process.env.SUPABASE_SECRET_KEY,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ns,
  };

  if (debug) return Response.json(diag, { headers: { "Cache-Control": "no-store" } });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return Response.json({ docs: [], edges: [], entry: null, _v: VERSION_MARKER, _reason: "missing-env" }, { headers: { "Cache-Control": "no-store" } });
  }

  const storage = new SupabaseStorage();
  const prefix = `${ns}/`;
  let listed: Awaited<ReturnType<typeof storage.list>>;
  try {
    listed = await storage.list(prefix);
  } catch {
    listed = [];
  }

  if (listed.length === 0) {
    return Response.json({ docs: [], edges: [], entry: null, _v: VERSION_MARKER, _reason: "empty-list" }, { headers: { "Cache-Control": "no-store" } });
  }

  const files = await Promise.all(
    listed.map(async (f) => ({
      path: f.path.slice(prefix.length),
      content: (await storage.read(f.path)) ?? "",
    }))
  );

  const index = buildIndexFromContents(files);
  return Response.json(index, { headers: { "Cache-Control": "no-store" } });
}
