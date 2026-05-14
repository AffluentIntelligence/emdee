import { auth } from "@clerk/nextjs/server";
import { adminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Returns whether the supplied email is a registered user — used by the
 * share modal to switch between "Share with <user>" and "Invite <email>"
 * affordances. Only fires on a complete-looking email (callsite gates).
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ user: null });

  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return Response.json({ user: null });

  const { data } = await adminClient()
    .from("profiles")
    .select("clerk_id, email")
    .ilike("email", email)
    .maybeSingle();

  if (!data || data.clerk_id === userId) return Response.json({ user: null });
  return Response.json({ user: { clerk_id: data.clerk_id, email: data.email } });
}
