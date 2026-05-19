import { auth } from "@clerk/nextjs/server";
import { adminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set([
  "view",
  "doc_open",
  "signup_click",
  "signup_attributed",
  "subscribe_click",
]);

interface EventBody {
  publication_id: string;
  event_type: string;
  doc_path?: string | null;
  referrer?: string | null;
}

/**
 * Lightweight ingestion endpoint for publication telemetry. Anonymous +
 * signed-in both POST here — when authed, viewer_user_id gets stamped;
 * otherwise null. Validates the event type against a whitelist so a
 * misconfigured client can't dump arbitrary strings into the table.
 */
export async function POST(request: Request) {
  let body: EventBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.publication_id || !body.event_type) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!ALLOWED_EVENTS.has(body.event_type)) {
    return Response.json({ error: "unknown_event_type" }, { status: 400 });
  }

  const { userId } = await auth();
  const admin = adminClient();
  const { error } = await admin.from("publication_events").insert({
    publication_id: body.publication_id,
    event_type: body.event_type,
    viewer_user_id: userId ?? null,
    doc_path: body.doc_path ?? null,
    referrer: body.referrer ?? null,
  });
  if (error) return Response.json({ error: "insert_failed" }, { status: 500 });
  return Response.json({ ok: true });
}
