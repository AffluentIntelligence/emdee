import { auth } from "@clerk/nextjs/server";
import { getVaultStorage } from "@/src/lib/storage";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const url = new URL(request.url);
  const rel = url.searchParams.get("path");
  const ns = url.searchParams.get("ns") ?? "public";
  if (!rel) return new Response("missing path", { status: 400 });
  if (!rel.endsWith(".md")) return new Response("invalid path", { status: 400 });

  const body = await request.text();
  const { storage, prefix, isLocal } = getVaultStorage(ns);

  if (!isLocal) {
    const { userId } = await auth();
    if (!userId || userId !== ns) return new Response("unauthorized", { status: 403 });
  }

  try {
    await storage.write(`${prefix}${rel}`, body);
    return new Response(null, { status: 204 });
  } catch (err) {
    return new Response(`save failed: ${(err as Error).message}`, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const rel = url.searchParams.get("path");
  const ns = url.searchParams.get("ns") ?? "public";
  if (!rel) return new Response("missing path", { status: 400 });
  if (!rel.endsWith(".md")) return new Response("invalid path", { status: 400 });

  const { storage, prefix, isLocal } = getVaultStorage(ns);

  if (!isLocal) {
    const { userId } = await auth();
    if (!userId || userId !== ns) return new Response("unauthorized", { status: 403 });
  }

  try {
    await storage.delete(`${prefix}${rel}`);
    return new Response(null, { status: 204 });
  } catch (err) {
    return new Response(`delete failed: ${(err as Error).message}`, { status: 500 });
  }
}
