"use client";
import type { UserStorageAggregate } from "./page";

interface Totals {
  user_count: number;
  total_docs: number;
  total_bytes: number;
}

interface Props {
  aggregates: UserStorageAggregate[];
  totals: Totals;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

export function AdminStorageView({ aggregates, totals }: Props) {
  return (
    <div className="admin-root">
      <section className="admin-totals">
        <div className="admin-stat"><div className="admin-stat-value">{totals.user_count}</div><div className="admin-stat-label">Users</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{totals.total_docs.toLocaleString()}</div><div className="admin-stat-label">Total docs</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{fmtBytes(totals.total_bytes)}</div><div className="admin-stat-label">Total stored</div></div>
      </section>

      <section className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th className="num">Docs</th>
              <th>Storage used</th>
              <th>Last write</th>
            </tr>
          </thead>
          <tbody>
            {aggregates.length === 0 && (
              <tr><td colSpan={4} className="admin-empty">No data yet.</td></tr>
            )}
            {aggregates.map((a) => (
              <tr key={a.namespace}>
                <td>
                  <div>{a.handle.startsWith("@") ? a.handle : `@${a.handle}`}</div>
                  {a.email && <div className="admin-sub">{a.email}</div>}
                </td>
                <td className="num">{a.doc_count.toLocaleString()}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 220 }}>
                    <div style={{ flex: 1, height: 6, background: "var(--border-subtle)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.min(100, a.text_pct * 100).toFixed(2)}%`,
                        background: a.text_pct > 0.9 ? "#ef4444" : a.text_pct > 0.7 ? "#f59e0b" : "var(--accent)",
                        borderRadius: 3,
                        minWidth: a.bytes_used > 0 ? 3 : 0,
                      }} />
                    </div>
                    <span style={{ whiteSpace: "nowrap", minWidth: 100, fontSize: 12, color: "var(--muted)" }}>
                      {fmtBytes(a.bytes_used)} / 5 GB
                    </span>
                  </div>
                </td>
                <td>{fmtRelative(a.last_write)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
