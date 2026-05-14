import { auth } from "@clerk/nextjs/server";
import { adminClient } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Revoke a share or pending invitation. `kind` query param disambiguates
 * between the two tables since their UUIDs live in separate spaces.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const kind = new URL(request.url).searchParams.get("kind");

  const admin = adminClient();
  if (kind === "invitation") {
    const { error } = await admin
      .from("share_invitations")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("inviter_id", userId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("doc_shares")
      .delete()
      .eq("id", id)
      .eq("owner_id", userId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
