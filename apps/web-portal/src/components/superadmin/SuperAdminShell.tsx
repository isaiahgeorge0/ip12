"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/sign-in");
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100">
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-6 shrink-0">
        <Link href="/superadmin" className="font-semibold text-zinc-900">
          SuperAdmin
        </Link>
        {user && (
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Sign out
          </button>
        )}
      </header>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
