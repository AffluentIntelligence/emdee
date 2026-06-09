import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { adminClient } from "@/src/lib/supabase/admin";
import { AdminDashboardView } from "./AdminDashboardView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ProfileRow {
  clerk_id: string;
  handle: string | null;
  email: string | null;
  is_admin: boolean;
  created_at: string;
}

interface StorageRow {
  namespace: string;
  doc_count: number;
  bytes_used: number;
  last_write: string | null;
}

interface ActivityRow {
  clerk_id: string;
  last_active: string | null;
  total_calls: number;
  calls_24h: number;
  calls_7d: number;
  calls_30d: number;
}

export interface UserRow {
  clerk_id: string;
  handle: string;
  email: string | null;
  is_admin: boolean;
  joined_at: string;
  doc_count: number;
  bytes_used: number;
  last_write: string | null;
  last_active: string | null;
  calls_24h: number;
  calls_7d: number;
  calls_30d: number;
}

export interface DashboardTotals {
  total_users: number;
  new_users_7d: number;
  dau: number;
  wau: number;
  mau: number;
  total_docs: number;
  total_bytes: number;
}

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) notFound();

  const admin = adminClient();

  const { data: me } = await admin
    .from("profiles")
    .select("clerk_id, is_admin")
    .eq("clerk_id", userId)
    .maybeSingle();
  if (!me?.is_admin) notFound();

  const [
    { data: profiles },
    { data: storageRows },
    { data: activityRows },
  ] = await Promise.all([
    admin.from("profiles").select("clerk_id, handle, email, is_admin, created_at").order("created_at", { ascending: false }),
    admin.from("vault_storage_by_namespace").select("namespace, doc_count, bytes_used, last_write"),
    admin.from("user_activity_stats").select("clerk_id, last_active, total_calls, calls_24h, calls_7d, calls_30d"),
  ]);

  const storageById = new Map<string, StorageRow>(
    ((storageRows ?? []) as StorageRow[]).map((r) => [r.namespace, r])
  );
  const activityById = new Map<string, ActivityRow>(
    ((activityRows ?? []) as ActivityRow[]).map((r) => [r.clerk_id, r])
  );

  const now = Date.now();
  const ms7d = 7 * 24 * 60 * 60 * 1000;

  const users: UserRow[] = ((profiles ?? []) as ProfileRow[]).map((p) => {
    const s = storageById.get(p.clerk_id);
    const a = activityById.get(p.clerk_id);
    return {
      clerk_id: p.clerk_id,
      handle: p.handle ?? p.clerk_id.slice(0, 12),
      email: p.email,
      is_admin: p.is_admin,
      joined_at: p.created_at,
      doc_count: s?.doc_count ?? 0,
      bytes_used: s?.bytes_used ?? 0,
      last_write: s?.last_write ?? null,
      last_active: a?.last_active ?? null,
      calls_24h: a?.calls_24h ?? 0,
      calls_7d: a?.calls_7d ?? 0,
      calls_30d: a?.calls_30d ?? 0,
    };
  });

  // Sort: most recently active first, then by join date
  users.sort((a, b) => {
    const ta = a.last_active ? new Date(a.last_active).getTime() : 0;
    const tb = b.last_active ? new Date(b.last_active).getTime() : 0;
    if (ta !== tb) return tb - ta;
    return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
  });

  const totals: DashboardTotals = {
    total_users: users.length,
    new_users_7d: users.filter((u) => now - new Date(u.joined_at).getTime() < ms7d).length,
    dau: users.filter((u) => u.calls_24h > 0).length,
    wau: users.filter((u) => u.calls_7d > 0).length,
    mau: users.filter((u) => u.calls_30d > 0).length,
    total_docs: users.reduce((s, u) => s + u.doc_count, 0),
    total_bytes: users.reduce((s, u) => s + u.bytes_used, 0),
  };

  return <AdminDashboardView users={users} totals={totals} />;
}
