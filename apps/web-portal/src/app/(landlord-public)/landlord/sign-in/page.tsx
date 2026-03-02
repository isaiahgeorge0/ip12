"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LandlordSignInPage() {
  const router = useRouter();
  const { signIn, user, profile, error, loading, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    if (profile.role === "landlord") {
      router.replace("/landlord");
      return;
    }
  }, [user, profile, router]);

  useEffect(() => {
    if (error) setIsSubmitting(false);
  }, [error]);

  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const displayError = error ?? errorLocal;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      clearError();
      setErrorLocal(null);
      if (!email.trim() || !password) return;
      setIsSubmitting(true);
      try {
        await signIn(email.trim(), password);
      } catch (err) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Sign in failed";
        setErrorLocal(message);
        setIsSubmitting(false);
      }
    },
    [email, password, signIn, clearError]
  );

  if (user && profile && profile.role !== "landlord") {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-50">
        <header className="border-b border-zinc-200 bg-white h-14 flex items-center px-4">
          <Link href="/" className="font-semibold text-zinc-900">
            IP12 Estate Portal
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm text-center">
            <h1 className="text-xl font-semibold text-zinc-900">Not authorized</h1>
            <p className="mt-2 text-sm text-zinc-500">
              This page is for landlords. Staff should use the Admin CRM.
            </p>
            <Link
              href="/admin"
              className="mt-4 inline-block w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Go to Admin
            </Link>
            <Link
              href="/"
              className="mt-3 inline-block text-sm text-zinc-600 hover:underline"
            >
              ← Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center">
          <Link href="/" className="font-semibold text-zinc-900">
            IP12 Estate Portal
          </Link>
          <span className="ml-4 text-sm text-zinc-500">Landlord sign in</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Landlord sign in</h1>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="landlord-signin-email"
                className="block text-sm font-medium text-zinc-700"
              >
                Email
              </label>
              <input
                id="landlord-signin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || loading}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="landlord-signin-password"
                className="block text-sm font-medium text-zinc-700"
              >
                Password
              </label>
              <input
                id="landlord-signin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || loading}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100"
              />
            </div>
            {displayError && (
              <p className="text-sm text-red-600" role="alert">
                {displayError}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {isSubmitting || loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-500">
            Invite-only. No signup — contact your agency for an invite.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-zinc-600 hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
