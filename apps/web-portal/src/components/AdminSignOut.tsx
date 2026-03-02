"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function AdminSignOut() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/sign-in");
  }, [signOut, router]);

  if (!user) return null;

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="block w-full rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 text-left"
    >
      Sign out
    </button>
  );
}
