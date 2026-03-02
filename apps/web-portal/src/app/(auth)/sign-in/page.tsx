"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/contexts/AuthContext";

export default function SignInPage() {
  const router = useRouter();
  const { signIn, user, error, loading, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const ensureAttemptedRef = useRef(false);
  const [isEnsuringSession, setIsEnsuringSession] = useState(false);

  const redirectForRole = useCallback(
    (role: string) => {
      const target = role === "landlord" ? "/landlord" : "/admin";
      if (process.env.NODE_ENV !== "production") {
        console.info(`[SessionSync] session ok -> redirecting to ${target}`);
      }
      router.replace(target);
    },
    [router]
  );

  useEffect(() => {
    if (loading || !user || ensureAttemptedRef.current) return;
    ensureAttemptedRef.current = true;
    let cancelled = false;

    const fetchServerSession = async () => {
      const res = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        user: { role?: string } | null;
      };
      return data.user;
    };

    const ensureSessionAndRedirect = async () => {
      setErrorLocal(null);
      setIsEnsuringSession(true);
      try {
        const currentSession = await fetchServerSession();
        if (currentSession?.role) {
          redirectForRole(currentSession.role);
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          console.info(
            "[SessionSync] firebaseUser present, session missing -> creating session"
          );
        }

        const idToken = await user.getIdToken(true);
        await fetch("/api/auth/session-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        const refreshedSession = await fetchServerSession();
        if (refreshedSession?.role) {
          redirectForRole(refreshedSession.role);
          return;
        }

        if (!cancelled) {
          setErrorLocal(
            "Secure session could not be established. Please sign out and sign in again."
          );
        }
      } catch {
        if (!cancelled) {
          setErrorLocal(
            "Secure session setup failed. Please refresh and try again."
          );
        }
      } finally {
        if (!cancelled) {
          setIsEnsuringSession(false);
        }
      }
    };

    void ensureSessionAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [loading, user, redirectForRole]);

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
        await signIn(email, password);
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

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Sign in</h1>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="signin-email"
                className="block text-sm font-medium text-zinc-700"
              >
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || loading || isEnsuringSession}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="signin-password"
                className="block text-sm font-medium text-zinc-700"
              >
                Password
              </label>
              <input
                id="signin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || loading || isEnsuringSession}
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
              disabled={isSubmitting || loading || isEnsuringSession}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-400"
            >
              {isSubmitting || loading || isEnsuringSession
                ? "Signing in…"
                : "Sign in"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-500">
            No account?{" "}
            <span className="text-zinc-400">
              Contact admin to be invited.
            </span>
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
