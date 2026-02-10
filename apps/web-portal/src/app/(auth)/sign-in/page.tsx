import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Sign in</h1>
          <p className="text-sm text-zinc-500 mt-2">
            Sign-in form will be wired to Firebase Auth here.
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
