import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="admin-root" style={{ paddingBottom: 0 }}>
        <header className="admin-header">
          <div className="admin-header-left">
            <Link href="/" className="admin-logo">
              <span className="admin-logo-dot" />
              EMDEE
            </Link>
            <span className="admin-header-sep">·</span>
            <nav style={{ display: "flex", gap: 2 }}>
              {[
                { href: "/admin", label: "Overview" },
                { href: "/admin/publications", label: "Publications" },
                { href: "/admin/storage", label: "Storage" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  style={{ fontSize: 13, padding: "3px 8px", borderRadius: "var(--radius-sm)", color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="admin-header-right">
            <Link href="/" className="admin-header-link">← Back to vault</Link>
          </div>
        </header>
      </div>
      {children}
    </>
  );
}
