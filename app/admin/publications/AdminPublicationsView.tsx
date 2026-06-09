"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import type { PublicationAggregate } from "./page";

interface Totals {
  publications: number;
  events_total: number;
  views_total: number;
  views_24h: number;
  views_7d: number;
  signups_total: number;
  subscribe_total: number;
}

interface Props {
  aggregates: PublicationAggregate[];
  totals: Totals;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminPublicationsView({ aggregates, totals }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="admin-root">
      <section className="admin-totals">
        <Stat label="Publications" value={totals.publications} />
        <Stat label="Views (24h)" value={totals.views_24h} accent />
        <Stat label="Views (7d)" value={totals.views_7d} />
        <Stat label="Views (all-time)" value={totals.views_total} />
        <Stat label="Signup clicks" value={totals.signups_total} />
        <Stat label="Subscribe clicks" value={totals.subscribe_total} />
        <Stat label="Events tracked" value={totals.events_total} muted />
      </section>

      <section className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Publication</th>
              <th>Owner</th>
              <th className="num">Docs</th>
              <th className="num">Views</th>
              <th className="num">Doc opens</th>
              <th className="num">Uniq viewers</th>
              <th className="num">Signup clicks</th>
              <th>Last activity</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {aggregates.length === 0 && (
              <tr>
                <td colSpan={10} className="admin-empty">
                  No publications yet. As people publish, they&rsquo;ll appear here.
                </td>
              </tr>
            )}
            {aggregates.map((a) => {
              const url = `/share/${a.handle}/${a.slug}`;
              const isOpen = expanded === a.id;
              return (
                <Fragment key={a.id}>
                  <tr className={isOpen ? "open" : undefined}>
                    <td>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="admin-link-strong">
                        {a.handle}/{a.slug}
                      </a>
                      <div className="admin-sub">{a.root_doc_path.replace(/\.md$/, "")}</div>
                    </td>
                    <td>
                      <div>{a.handle === "—" ? "—" : `@${a.handle}`}</div>
                      <div className="admin-sub">{a.owner_email ?? "—"}</div>
                    </td>
                    <td className="num">{a.included_count}</td>
                    <td className="num">{a.views}</td>
                    <td className="num">{a.doc_opens}</td>
                    <td className="num">{a.unique_viewers}</td>
                    <td className="num">{a.signup_clicks}</td>
                    <td>{fmtRelative(a.last_event_at)}</td>
                    <td>{fmtRelative(a.updated_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-row-toggle"
                        onClick={() => setExpanded(isOpen ? null : a.id)}
                      >
                        {isOpen ? "Hide" : "Recent"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="admin-events-row">
                      <td colSpan={10}>
                        <div className="admin-events-wrap">
                          <div className="admin-events-title">Recent events</div>
                          {a.recent_events.length === 0 ? (
                            <div className="admin-sub">No events recorded yet.</div>
                          ) : (
                            <ul className="admin-events-list">
                              {a.recent_events.map((e, i) => (
                                <li key={i}>
                                  <span className={`admin-event-pill admin-event-${e.type}`}>
                                    {e.type}
                                  </span>
                                  <span className="admin-event-path">
                                    {e.doc_path ?? "—"}
                                  </span>
                                  <span className="admin-event-meta">
                                    {e.viewer_user_id ? "signed-in · " : "anon · "}
                                    {fmtAbsolute(e.created_at)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}) {
  const cls = ["admin-stat", accent ? "admin-stat-accent" : "", muted ? "admin-stat-muted" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <div className="admin-stat-value">{value.toLocaleString()}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}
