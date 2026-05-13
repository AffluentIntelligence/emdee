import { buildIndexFromContents } from "@/src/core/indexer";
import { SupabaseStorage } from "@/src/lib/storage/SupabaseStorage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ns = url.searchParams.get("ns") ?? "public";
  const debug = url.searchParams.get("debug") === "1";

  const diag: Record<string, unknown> = {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSecretKey: !!process.env.SUPABASE_SECRET_KEY,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    ns,
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return Response.json(
      debug ? { ...diag, reason: "missing-env" } : { docs: [], edges: [], entry: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const storage = new SupabaseStorage();
  const prefix = `${ns}/`;
  let listed: Awaited<ReturnType<typeof storage.list>>;
  let listError: string | null = null;
  try {
    listed = await storage.list(prefix);
  } catch (err) {
    listError = (err as Error).message;
    listed = [];
  }

  diag.listedCount = listed.length;
  diag.listError = listError;
  diag.firstPaths = listed.slice(0, 5).map((f) => f.path);

  if (listed.length === 0) {
    return Response.json(
      debug ? { ...diag, reason: "empty-list" } : { docs: [], edges: [], entry: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const files = await Promise.all(
    listed.map(async (f) => ({
      path: f.path.slice(prefix.length),
      content: (await storage.read(f.path)) ?? "",
    }))
  );

  const index = buildIndexFromContents(files);
  if (debug) return Response.json({ ...diag, entry: index.entry, docCount: index.docs.length }, { headers: { "Cache-Control": "no-store" } });
  return Response.json(index, { headers: { "Cache-Control": "no-store" } });
}
