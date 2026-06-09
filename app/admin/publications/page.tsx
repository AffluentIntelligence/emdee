import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { adminClient } from "@/src/lib/supabase/admin";
import { AdminPublicationsView } from "./AdminPublicationsView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PublicationRow {
  id: string;
  owner_id: string;
  slug: string;
  root_doc_path: string;
  included_paths: string[];
  include_descendants: boolean;
  include_direct_associates: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  clerk_id: string;
  handle: string | null;
  email: string | null;
}

interface EventRow {
  publication_id: string;
  event_type: string;
  doc_path: string | null;
  viewer_user_id: string | null;
  created_at: string;
}

export interface PublicationAggregate {
  id: string;
  handle: string;
  slug: string;
  root_doc_path: string;
  included_count: number;
  owner_email: string | null;
  created_at: string;
  updated_at: string;
  views: number;
  doc_opens: number;
  signup_clicks: number;
  subscribe_clicks: number;
  unique_viewers: number;
  last_event_at: string | null;
  recent_events: {
    type: string;
    doc_path: string | null;
    viewer_user_id: string | null;
    created_at: string;
  }[];
}

export default async function AdminPublicationsPage() {
  const { userId } = await auth();
  if (!userId) notFound();

  const admin = adminClient();

  // Gate: caller must have is_admin = true in profiles. Anything else 404s
  // — no leaking that the route exists.
  const { data: me } = await admin
    .from("profiles")
    .select("clerk_id, is_admin")
    .eq("clerk_id", userId)
    .maybeSingle();
  if (!me?.is_admin) notFound();

  const [{ data: pubs }, { data: events }] = await Promise.all([
    admin
      .from("publications")
      .select(
        "id, owner_id, slug, root_doc_path, included_paths, include_descendants, include_direct_associates, created_at, updated_at"
      )
      .order("updated_at", { ascending: false }),
    admin
      .from("publication_events")
      .select("publication_id, event_type, doc_path, viewer_user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const publications = (pubs ?? []) as PublicationRow[];
  const allEvents = (events ?? []) as EventRow[];

  // Resolve owner profiles for handle + email display.
  const ownerIds = Array.from(new Set(publications.map((p) => p.owner_id)));
  const { data: profiles } = ownerIds.length
    ? await admin
        .from("profiles")
        .select("clerk_id, handle, email")
        .in("clerk_id", ownerIds)
    : { data: [] };
  const profileById = new Map<string, ProfileRow>(
    (profiles ?? []).map((p) => [p.clerk_id as string, p as ProfileRow])
  );

  // Bucket events by publication for O(n) aggregation.
  const eventsByPub = new Map<string, EventRow[]>();
  for (const e of allEvents) {
    const arr = eventsByPub.get(e.publication_id) ?? [];
    arr.push(e);
    eventsByPub.set(e.publication_id, arr);
  }

  const aggregates: PublicationAggregate[] = publications.map((p) => {
    const pubEvents = eventsByPub.get(p.id) ?? [];
    let views = 0;
    let docOpens = 0;
    let signupClicks = 0;
    let subscribeClicks = 0;
    const viewers = new Set<string>();
    for (const e of pubEvents) {
      if (e.event_type === "view") views++;
      else if (e.event_type === "doc_open") docOpens++;
      else if (e.event_type === "signup_click") signupClicks++;
      else if (e.event_type === "subscribe_click") subscribeClicks++;
      if (e.viewer_user_id) viewers.add(e.viewer_user_id);
    }
    const profile = profileById.get(p.owner_id);
    return {
      id: p.id,
      handle: profile?.handle ?? "—",
      slug: p.slug,
      root_doc_path: p.root_doc_path,
      included_count: p.included_paths?.length ?? 0,
      owner_email: profile?.email ?? null,
      created_at: p.created_at,
      updated_at: p.updated_at,
      views,
      doc_opens: docOpens,
      signup_clicks: signupClicks,
      subscribe_clicks: subscribeClicks,
      unique_viewers: viewers.size,
      last_event_at: pubEvents[0]?.created_at ?? null,
      recent_events: pubEvents.slice(0, 8).map((e) => ({
        type: e.event_type,
        doc_path: e.doc_path,
        viewer_user_id: e.viewer_user_id,
        created_at: e.created_at,
      })),
    };
  });

  // Top-line totals across all publications (last 24h vs all-time).
  // eslint-disable-next-line react-hooks/purity -- server component, single render per request.
  const now = Date.now();
  const since24h = now - 24 * 60 * 60 * 1000;
  const since7d = now - 7 * 24 * 60 * 60 * 1000;
  const totals = {
    publications: publications.length,
    events_total: allEvents.length,
    views_total: allEvents.filter((e) => e.event_type === "view").length,
    views_24h: allEvents.filter(
      (e) => e.event_type === "view" && new Date(e.created_at).getTime() > since24h
    ).length,
    views_7d: allEvents.filter(
      (e) => e.event_type === "view" && new Date(e.created_at).getTime() > since7d
    ).length,
    signups_total: allEvents.filter((e) => e.event_type === "signup_click").length,
    subscribe_total: allEvents.filter((e) => e.event_type === "subscribe_click").length,
  };

  return <AdminPublicationsView aggregates={aggregates} totals={totals} />;
}
