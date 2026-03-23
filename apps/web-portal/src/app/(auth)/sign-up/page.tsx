"use client";

import { useCallback, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { getFirebaseAuth } from "@/lib/firebase/client";

function isSafeReturnTo(path: string | null): boolean {
  if (!path || path !== path.trim()) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("/admin") || path.startsWith("/landlord") || path.startsWith("/superadmin")) return false;
  return true;
}

const PASSWORD_MIN = 8;

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get("returnTo") ?? null;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const nameTrim = fullName.trim();
      const emailTrim = email.trim();
      const phoneTrim = phone.trim();
      if (!nameTrim || !emailTrim || !password) {
        setError("Name, email and password are required.");
        return;
      }
      if (password.length < PASSWORD_MIN) {
        setError(`Password must be at least ${PASSWORD_MIN} characters.`);
        return;
      }

      const auth = getFirebaseAuth();
      if (!auth) {
        setError("Sign up is not configured. Please try again later.");
        return;
      }

      setSubmitting(true);
      try {
        const userCred = await createUserWithEmailAndPassword(auth, emailTrim, password);
        const idToken = await userCred.user.getIdToken();

        const regRes = await fetch("/api/auth/register-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            fullName: nameTrim,
            email: emailTrim,
            phone: phoneTrim || undefined,
          }),
        });
        const regData = (await regRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!regRes.ok) {
          setError(regData?.error ?? "Could not complete registration.");
          setSubmitting(false);
          return;
        }

        await fetch("/api/auth/session-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        const target = returnTo && isSafeReturnTo(returnTo) ? returnTo : "/properties";
        router.replace(target);
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "code" in err
            ? (err as { code: string }).code === "auth/email-already-in-use"
              ? "This email is already registered. Sign in instead."
              : (err as { message?: string }).message ?? "Sign up failed"
            : "Sign up failed";
        setError(String(msg));
        setSubmitting(false);
      }
    },
    [fullName, email, phone, password, returnTo, router]
  );

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Create account</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Sign up to enquire about properties, save listings, and book viewings.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="signup-fullName" className="block text-sm font-medium text-zinc-700">
                Full name *
              </label>
              <input
                id="signup-fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={submitting}
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-zinc-700">
                Email *
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="signup-phone" className="block text-sm font-medium text-zinc-700">
                Phone (optional)
              </label>
              <input
                id="signup-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100"
                placeholder="07xxx xxxxxx"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-zinc-700">
                Password * (min {PASSWORD_MIN} characters)
              </label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
                minLength={PASSWORD_MIN}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-100"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-400"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href={returnTo && isSafeReturnTo(returnTo) ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : "/sign-in"}
              className="font-medium text-zinc-700 hover:underline"
            >
              Sign in
            </Link>
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-zinc-600 hover:underline">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col bg-zinc-50">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-zinc-500">Loading…</p>
        </main>
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
}
