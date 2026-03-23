"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };
type NavSection = { title: string; items: NavItem[] };

type SidebarLayoutProps = {
  children: ReactNode;
  title: string;
  navItems: NavItem[];
  /** Optional: grouped navigation sections (preferred for admin IA) */
  navSections?: NavSection[];
  footerContent?: ReactNode;
  /** Optional content to show in the main header (e.g. agency switcher for superAdmin) */
  headerAction?: ReactNode;
};

export function SidebarLayout({
  children,
  title,
  navItems,
  navSections,
  footerContent,
  headerAction,
}: SidebarLayoutProps) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    const [path] = href.split("?");
    if (!path) return false;
    if (path === "/admin") return pathname === "/admin";
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  return (
    <div className="min-h-screen flex bg-admin-bg">
      <aside className="w-56 border-r border-admin-border bg-admin-surface flex flex-col shrink-0">
        <div className="p-4 border-b border-admin-border shrink-0">
          <Link href="/" className="font-semibold text-admin-fg">
            IP12 Estate Portal
          </Link>
          <p className="text-xs text-admin-muted-fg mt-1">{title}</p>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto p-2">
          {Array.isArray(navSections) && navSections.length > 0 ? (
            <div className="space-y-5">
              {navSections.map((section) => (
                <div key={section.title}>
                  <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-admin-muted-fg uppercase tracking-wide">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          "block rounded-md px-3 py-2.5 text-sm transition-colors",
                          isActive(item.href)
                            ? "bg-admin-accent-soft text-admin-accent font-semibold ring-1 ring-admin-accent/15"
                            : "text-admin-neutral-fg hover:bg-admin-surface-muted/50 hover:text-admin-fg",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "block rounded-md px-3 py-2.5 text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-admin-accent-soft text-admin-accent font-semibold ring-1 ring-admin-accent/15"
                    : "text-admin-neutral-fg hover:bg-admin-surface-muted/50 hover:text-admin-fg",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))
          )}
        </nav>
        {footerContent != null ? (
          <div className="p-2 border-t border-admin-border shrink-0">{footerContent}</div>
        ) : null}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-admin-border bg-admin-surface flex items-center justify-between px-6 shrink-0">
          <span className="text-sm text-admin-muted-fg">{title}</span>
          {headerAction != null ? <div>{headerAction}</div> : null}
        </header>
        <main className="flex-1 px-6 py-7 lg:px-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
