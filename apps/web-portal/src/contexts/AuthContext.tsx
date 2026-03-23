"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/lib/types/userProfile";
import { fetchUserProfile } from "@/lib/auth/profile";
import { getFirebaseAuth } from "@/lib/firebase/client";

const STAFF_ROLES: Array<UserProfile["role"]> = [
  "superAdmin",
  "admin",
  "agent",
];

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/session-logout", { method: "POST" });
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Auth] session-logout failed", e);
      }
    }
    const auth = getFirebaseAuth();
    if (auth) await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setError(null);
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setError(null);
        setLoading(false);
        return;
      }
      try {
        const p = await fetchUserProfile(firebaseUser.uid);
        if (!p) {
          await firebaseSignOut(auth);
          setUser(null);
          setProfile(null);
          setError("No access");
          setLoading(false);
          return;
        }
        const isStaff = STAFF_ROLES.includes(p.role);
        const isLandlord = p.role === "landlord";
        const isPublicOrLead = p.role === "public" || p.role === "lead";
        if (!isStaff && !isLandlord && !isPublicOrLead) {
          await firebaseSignOut(auth);
          setUser(null);
          setProfile(null);
          setError("No access");
          setLoading(false);
          return;
        }
        // Only disabled accounts are locked out; pending/invited are allowed (landlord pending is upgraded to active on first serverSession read).
        if (p.status === "disabled") {
          await firebaseSignOut(auth);
          setUser(null);
          setProfile(null);
          setError("Account disabled");
          setLoading(false);
          return;
        }
        setProfile(p);
        setError(null);
      } catch {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        setError("No access");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const auth = getFirebaseAuth();
      if (!auth) {
        setError(
          "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_API_KEY, " +
            "AUTH_DOMAIN, and PROJECT_ID to .env.local and restart the dev server."
        );
        return;
      }
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await userCred.user.getIdToken();
      try {
        const res = await fetch("/api/auth/session-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok && process.env.NODE_ENV !== "production") {
          console.warn("[Auth] session-login failed", res.status);
        }
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[Auth] session-login failed", e);
        }
      }
      // Profile load and redirect happen via onAuthStateChanged
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      error,
      signIn,
      signOut,
      clearError,
    }),
    [user, profile, loading, error, signIn, signOut, clearError]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
