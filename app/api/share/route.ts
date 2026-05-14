import { auth } from "@clerk/nextjs/server";
import { adminClient } from "@/src/lib/supabase/admin";
import { ensureProfile } from "@/src/lib/supabase/oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ShareRow {
  id: string;
  grantee_id: string;
  path_prefix: string;
  permission: "read" | "write";
  created_at: string;
  grantee?: { email: string | null } | { email: string | null }[] | null;
}

interface InviteRow {
  id: string;
  invitee_email: string;
  path_prefix: string;
  permission: "read" | "write";
  created_at: string;
  token: string;
}

/**
 * List active shares + pending invitations for one doc path.
 * Returns { shares: [...], invitations: [...] } so the UI can render both
 * in the same recipients list with a status badge.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path) return Response.json({ error: "path required" }, { status: 400 });

  const admin = adminClient();
  const [{ data: shares }, { data: invites }] = await Promise.all([
    admin
      .from("doc_shares")
      .select("id, grantee_id, path_prefix, permission, created_at, grantee:profiles!doc_shares_grantee_id_fkey(email)")
      .eq("owner_id", userId)
      .eq("path_prefix", path)
      .order("created_at", { ascending: false }),
    admin
      .from("share_invitations")
      .select("id, invitee_email, path_prefix, permission, created_at, token")
      .eq("inviter_id", userId)
      .eq("path_prefix", path)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const sharesOut = ((shares ?? []) as ShareRow[]).map((s) => {
    const g = Array.isArray(s.grantee) ? s.grantee[0] : s.grantee;
    return {
      id: s.id,
      kind: "share" as const,
      grantee_id: s.grantee_id,
      email: g?.email ?? null,
      permission: s.permission,
      created_at: s.created_at,
    };
  });
  const invitesOut = ((invites ?? []) as InviteRow[]).map((i) => ({
    id: i.id,
    kind: "invitation" as const,
    email: i.invitee_email,
    permission: i.permission,
    token: i.token,
    created_at: i.created_at,
  }));

  return Response.json({ shares: sharesOut, invitations: invitesOut });
}

/**
 * Share or invite. If the email matches an existing profile we create a
 * doc_shares row immediately; otherwise we record a pending invitation that
 * gets auto-claimed when the invitee signs up (see ensureProfile).
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.path !== "string" || typeof body.email !== "string") {
    return Response.json({ error: "path and email required" }, { status: 400 });
  }
  const path = body.path.trim();
  const email = body.email.trim().toLowerCase();
  const permission: "read" | "write" = body.permission === "write" ? "write" : "read";

  if (!email.includes("@")) return Response.json({ error: "invalid email" }, { status: 400 });

  // share_invitations + doc_shares both FK to profiles(clerk_id); make sure
  // the owner's row exists before either insert path runs.
  await ensureProfile(userId);

  const admin = adminClient();
  const { data: match } = await admin
    .from("profiles")
    .select("clerk_id, email")
    .ilike("email", email)
    .maybeSingle();

  if (match) {
    if (match.clerk_id === userId) {
      return Response.json({ error: "cannot share with yourself" }, { status: 400 });
    }
    const { data, error } = await admin
      .from("doc_shares")
      .upsert(
        { owner_id: userId, grantee_id: match.clerk_id, path_prefix: path, permission },
        { onConflict: "owner_id,path_prefix,grantee_id" }
      )
      .select("id")
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ kind: "share", id: data.id, email: match.email });
  }

  const { data, error } = await admin
    .from("share_invitations")
    .insert({ inviter_id: userId, invitee_email: email, path_prefix: path, permission })
    .select("id, token")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ kind: "invitation", id: data.id, token: data.token, email });
}
