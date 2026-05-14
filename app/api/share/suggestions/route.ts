import { auth } from "@clerk/nextjs/server";
import { adminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ShareJoin {
  grantee: { email: string | null } | { email: string | null }[] | null;
}

/**
 * Past grantees (people I've already shared with or invited). The share
 * modal uses this to power autocomplete-while-typing. Combined list of:
 *  - emails from doc_shares (grantee.email via profiles join)
 *  - emails from share_invitations (regardless of status — we include
 *    accepted invitations too so previously-invited contacts stay
 *    available even after they signed up).
 * Optional ?q filters by email prefix (case-insensitive).
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ emails: [] });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const admin = adminClient();
  const [{ data: shares }, { data: invites }] = await Promise.all([
    admin
      .from("doc_shares")
      .select("grantee:profiles!doc_shares_grantee_id_fkey(email)")
      .eq("owner_id", userId),
    admin
      .from("share_invitations")
      .select("invitee_email")
      .eq("inviter_id", userId),
  ]);

  const emails = new Set<string>();
  for (const s of (shares ?? []) as ShareJoin[]) {
    const g = Array.isArray(s.grantee) ? s.grantee[0] : s.grantee;
    if (g?.email) emails.add(g.email.toLowerCase());
  }
  for (const i of invites ?? []) {
    if (i.invitee_email) emails.add(i.invitee_email.toLowerCase());
  }

  let out = Array.from(emails);
  if (q) out = out.filter((e) => e.startsWith(q));
  out.sort();

  return Response.json({ emails: out });
}
