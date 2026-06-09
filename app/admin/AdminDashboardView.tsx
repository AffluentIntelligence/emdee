"use client";
import type { UserRow, DashboardTotals } from "./page";

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
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function AdminDashboardView({ users, totals }: { users: UserRow[]; totals: DashboardTotals }) {
  return (
    <div className="admin-root">
      <section className="admin-totals">
        <div className="admin-stat admin-stat-accent">
          <div className="admin-stat-value">{totals.dau}</div>
          <div className="admin-stat-label">DAU</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{totals.wau}</div>
          <div className="admin-stat-label">WAU</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{totals.mau}</div>
          <div className="admin-stat-label">MAU</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{totals.total_users}</div>
          <div className="admin-stat-label">Total users</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">+{totals.new_users_7d}</div>
          <div className="admin-stat-label">New (7d)</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{totals.total_docs.toLocaleString()}</div>
          <div className="admin-stat-label">Total docs</div>
        </div>
        <div className="admin-stat admin-stat-muted">
          <div className="admin-stat-value">{fmtBytes(totals.total_bytes)}</div>
          <div className="admin-stat-label">Stored</div>
        </div>
      </section>

      <section className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Joined</th>
              <th className="num">Calls today</th>
              <th className="num">Calls (30d)</th>
              <th className="num">Docs</th>
              <th className="num">Storage</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={7} className="admin-empty">No users yet.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.clerk_id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 500 }}>
                      {u.handle.startsWith("@") ? u.handle : `@${u.handle}`}
                    </span>
                    {u.is_admin && (
                      <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 }}>admin</span>
                    )}
                    {u.calls_24h > 0 && (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", flexShrink: 0 }} title="Active today" />
                    )}
                  </div>
                  {u.email && <div className="admin-sub">{u.email}</div>}
                </td>
                <td>{fmtDate(u.joined_at)}</td>
                <td className="num">{u.calls_24h > 0 ? u.calls_24h : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                <td className="num">{u.calls_30d > 0 ? u.calls_30d.toLocaleString() : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                <td className="num">{u.doc_count > 0 ? u.doc_count.toLocaleString() : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                <td className="num">{u.bytes_used > 0 ? fmtBytes(u.bytes_used) : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                <td>{fmtRelative(u.last_active)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
