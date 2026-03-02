"use client";

import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signOut as firebaseSignOut } from "firebase/auth";

export function DisabledSignOut() {
  const router = useRouter();

  async function handleSignOut() {
    try {
      await fetch("/api/auth/session-logout", { method: "POST" });
    } catch {
      // continue
    }
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
    router.replace("/sign-in");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
    >
      Sign out
    </button>
  );
}
