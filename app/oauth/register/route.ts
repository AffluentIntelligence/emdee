import { registerClient } from "@/src/lib/supabase/oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request", error_description: "body must be JSON" }, { status: 400 });
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || !redirectUris.every((u) => typeof u === "string")) {
    return Response.json({ error: "invalid_redirect_uri", error_description: "redirect_uris must be a non-empty array of strings" }, { status: 400 });
  }

  const clientName = typeof body.client_name === "string" ? body.client_name : null;

  try {
    const clientId = await registerClient(clientName, redirectUris as string[]);
    return Response.json({ client_id: clientId, client_name: clientName, redirect_uris: redirectUris }, { status: 201 });
  } catch (err) {
    return Response.json({ error: "server_error", error_description: (err as Error).message }, { status: 500 });
  }
}
