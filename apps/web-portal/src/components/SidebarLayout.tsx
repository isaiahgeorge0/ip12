import Link from "next/link";
import { type ReactNode } from "react";

type NavItem = { href: string; label: string };

type SidebarLayoutProps = {
  children: ReactNode;
  title: string;
  navItems: NavItem[];
  footerContent?: ReactNode;
};

export function SidebarLayout({
  children,
  title,
  navItems,
  footerContent,
}: SidebarLayoutProps) {
  return (
    <div className="min-h-screen flex bg-zinc-100">
      <aside className="w-56 border-r border-zinc-200 bg-white flex flex-col">
        <div className="p-4 border-b border-zinc-200">
          <Link href="/" className="font-semibold text-zinc-900">
            IP12 Estate Portal
          </Link>
          <p className="text-xs text-zinc-500 mt-1">{title}</p>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {footerContent != null ? (
          <div className="p-2 border-t border-zinc-200">{footerContent}</div>
        ) : null}
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-zinc-200 bg-white flex items-center px-6">
          <span className="text-sm text-zinc-600">{title}</span>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
