"use client";

import { useState, useCallback, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  query,
  limit,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { applicationsCol, userDoc } from "@/lib/firestore/paths";
import {
  PERMISSION_PRESETS,
  buildUserDoc,
  type PresetName,
} from "@/lib/auth/permissions";

const TARGET_AGENCY = "ip12";
const OTHER_AGENCY = "test";

type TestResult =
  | { status: "idle" }
  | { status: "running" }
  | { status: "blocked"; message: string; code?: string }
  | { status: "succeeded"; message: string; docId?: string; count?: number };

type ProfileTestResult =
  | { status: "idle" }
  | { status: "running" }
  | { status: "succeeded" }
  | { status: "blocked" }
  | { status: "failed"; code?: string; message?: string };

export default function SecurityTestPage() {
  const { user, profile } = useAuth();
  const db = getFirebaseFirestore();

  const [readIp12, setReadIp12] = useState<TestResult>({ status: "idle" });
  const [writeIp12, setWriteIp12] = useState<TestResult>({ status: "idle" });
  const [readTest, setReadTest] = useState<TestResult>({ status: "idle" });
  const [writeTest, setWriteTest] = useState<TestResult>({ status: "idle" });
  const [displayNameResult, setDisplayNameResult] =
    useState<ProfileTestResult>({ status: "idle" });
  const [agencyIdResult, setAgencyIdResult] =
    useState<ProfileTestResult>({ status: "idle" });

  // Presets + buildUserDoc (dev-only)
  const [presetUid, setPresetUid] = useState("");
  const [presetEmail, setPresetEmail] = useState("");
  const [presetAgencyId, setPresetAgencyId] = useState("");
  const [presetRole, setPresetRole] = useState("agent");
  const [presetDisplayName, setPresetDisplayName] = useState("");
  const [presetName, setPresetName] = useState<PresetName>("lettingsStaff");
  const presetPayload =
    presetUid && presetEmail
      ? buildUserDoc({
          uid: presetUid,
          email: presetEmail,
          agencyId: presetAgencyId || null,
          role: presetRole,
          displayName: presetDisplayName || undefined,
          presetName,
        })
      : null;
  const presetJson = presetPayload
    ? JSON.stringify(
        {
          ...presetPayload,
          createdAt: "SERVER_TIMESTAMP",
          updatedAt: "SERVER_TIMESTAMP",
        },
        null,
        2
      )
    : "";
  const copyPresetJson = useCallback(() => {
    if (!presetJson) return;
    void navigator.clipboard.writeText(presetJson);
  }, [presetJson]);

  // Seed preset form from current user once when auth is ready (dev-only)
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (user?.uid) setPresetUid((prev) => (prev === "" ? user.uid : prev));
    if (user?.email != null)
      setPresetEmail((prev) => (prev === "" ? user.email ?? "" : prev));
    if (profile?.agencyId != null)
      setPresetAgencyId((prev) => (prev === "" ? profile.agencyId! : prev));
  }, [user?.uid, user?.email, profile?.agencyId]);

  const runRead = useCallback(
    async (agencyId: string, setResult: (r: TestResult) => void) => {
      if (!db) return;
      setResult({ status: "running" });
      try {
        const colRef = collection(db, applicationsCol(agencyId));
        const q = query(colRef, limit(1));
        const snap = await getDocs(q);
        setResult({
          status: "succeeded",
          message: "READ SUCCEEDED (this is bad)",
          count: snap.size,
        });
        if (snap.docs.length > 0) {
          console.log("[SecurityTest] READ docs:", snap.docs.map((d) => d.id));
        }
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        setResult({
          status: "blocked",
          message: "READ BLOCKED ✅",
          code: e?.code,
        });
        console.log("[SecurityTest] READ error:", e?.code, e?.message, err);
      }
    },
    [db]
  );

  const runWrite = useCallback(
    async (agencyId: string, setResult: (r: TestResult) => void) => {
      if (!db || !user) return;
      setResult({ status: "running" });
      try {
        const colRef = collection(db, applicationsCol(agencyId));
        const ref = await addDoc(colRef, {
          fullName: "Security test applicant",
          email: "test@security.test",
          phone: null,
          propertyRef: null,
          status: "New",
          notes: "Dev security test – safe to delete",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdByUid: user.uid,
        });
        setResult({
          status: "succeeded",
          message: "WRITE SUCCEEDED (this is bad)",
          docId: ref.id,
        });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        setResult({
          status: "blocked",
          message: "WRITE BLOCKED ✅",
          code: e?.code,
        });
        console.log("[SecurityTest] WRITE error:", e?.code, e?.message, err);
      }
    },
    [db, user]
  );

  const runDisplayNameUpdate = useCallback(async () => {
    if (!db || !user) return;
    setDisplayNameResult({ status: "running" });
    try {
      const userRef = doc(db, userDoc(user.uid));
      await updateDoc(userRef, {
        displayName: `Test User ${Date.now()}`,
        updatedAt: serverTimestamp(),
      });
      setDisplayNameResult({ status: "succeeded" });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === "permission-denied") {
        setDisplayNameResult({ status: "blocked" });
      } else {
        setDisplayNameResult({
          status: "failed",
          code: e?.code,
          message: e?.message,
        });
      }
    }
  }, [db, user]);

  const runAgencyIdChange = useCallback(async () => {
    if (!db || !user) return;
    const targetAgencyId =
      profile?.agencyId === "ip12" ? "test" : "ip12";
    setAgencyIdResult({ status: "running" });
    try {
      const userRef = doc(db, userDoc(user.uid));
      await updateDoc(userRef, {
        agencyId: targetAgencyId,
        updatedAt: serverTimestamp(),
      });
      setAgencyIdResult({ status: "succeeded" });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === "permission-denied") {
        setAgencyIdResult({ status: "blocked" });
      } else {
        setAgencyIdResult({
          status: "failed",
          code: e?.code,
          message: e?.message,
        });
      }
    }
  }, [db, user, profile?.agencyId]);

  const resetResults = useCallback(() => {
    setReadIp12({ status: "idle" });
    setWriteIp12({ status: "idle" });
    setReadTest({ status: "idle" });
    setWriteTest({ status: "idle" });
    setDisplayNameResult({ status: "idle" });
    setAgencyIdResult({ status: "idle" });
  }, []);

  if (process.env.NODE_ENV !== "development") {
    return (
      <>
        <PageHeader title="Security test" />
        <Card className="p-6">
          <p className="text-zinc-600">Not available.</p>
        </Card>
      </>
    );
  }

  function resultText(r: TestResult): string {
    if (r.status === "idle") return "—";
    if (r.status === "running") return "Running…";
    if (r.status === "blocked")
      return `${r.message}${r.code ? ` (${r.code})` : ""}`;
    if (r.status === "succeeded")
      return `${r.message}${r.docId ? ` docId: ${r.docId}` : ""}${r.count !== undefined ? ` count: ${r.count}` : ""}`;
    return "—";
  }

  function profileResultText(r: ProfileTestResult): string {
    if (r.status === "idle") return "Not run";
    if (r.status === "running") return "Running…";
    if (r.status === "succeeded") return "✅ SUCCEEDED";
    if (r.status === "blocked") return "✅ BLOCKED (permission-denied)";
    if (r.status === "failed")
      return `❌ FAILED: ${r.code ?? r.message ?? "unknown"}`;
    return "Not run";
  }

  return (
    <>
      <PageHeader
        title="Security test (dev only)"
        action={
          <button
            type="button"
            onClick={resetResults}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Reset results
          </button>
        }
      />

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">
          Current auth (useAuth)
        </h2>
        <dl className="grid gap-1 text-sm">
          <dt className="text-zinc-500">UID</dt>
          <dd className="font-mono text-zinc-900">{user?.uid ?? "—"}</dd>
          <dt className="text-zinc-500">profile?.agencyId</dt>
          <dd className="font-mono text-zinc-900">
            {profile?.agencyId ?? "—"}
          </dd>
          <dt className="text-zinc-500">profile?.role</dt>
          <dd className="font-mono text-zinc-900">{profile?.role ?? "—"}</dd>
          <dt className="text-zinc-500">profile?.permissions</dt>
          <dd className="font-mono text-zinc-900 text-xs">
            {profile?.permissions?.length
              ? JSON.stringify(profile.permissions)
              : "—"}
          </dd>
        </dl>
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">
          Profile write tests (current user)
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Real Firestore writes to users/&#123;uid&#125; for the logged-in user.
        </p>
        <div className="flex flex-wrap gap-4 items-center">
          <button
            type="button"
            onClick={runDisplayNameUpdate}
            disabled={displayNameResult.status === "running"}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Update display name (should succeed)
          </button>
          <span className="text-sm text-zinc-600 min-w-[220px]">
            {profileResultText(displayNameResult)}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 items-center mt-3">
          <button
            type="button"
            onClick={runAgencyIdChange}
            disabled={agencyIdResult.status === "running"}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Attempt agencyId change (should be blocked)
          </button>
          <span className="text-sm text-zinc-600 min-w-[220px]">
            {profileResultText(agencyIdResult)}
          </span>
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">
          Forced cross-agency: {TARGET_AGENCY}
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          These do not use profile.agencyId; they hardcode agency &quot;{TARGET_AGENCY}&quot;.
        </p>
        <div className="flex flex-wrap gap-4 items-center">
          <button
            type="button"
            onClick={() => runRead(TARGET_AGENCY, setReadIp12)}
            disabled={readIp12.status === "running"}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Attempt READ {TARGET_AGENCY} applicants
          </button>
          <span className="text-sm text-zinc-600 min-w-[200px]">
            {resultText(readIp12)}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 items-center mt-3">
          <button
            type="button"
            onClick={() => runWrite(TARGET_AGENCY, setWriteIp12)}
            disabled={writeIp12.status === "running"}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Attempt WRITE {TARGET_AGENCY} applicants
          </button>
          <span className="text-sm text-zinc-600 min-w-[200px]">
            {resultText(writeIp12)}
          </span>
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">
          Forced cross-agency: {OTHER_AGENCY}
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Same tests with hardcoded agency &quot;{OTHER_AGENCY}&quot;.
        </p>
        <div className="flex flex-wrap gap-4 items-center">
          <button
            type="button"
            onClick={() => runRead(OTHER_AGENCY, setReadTest)}
            disabled={readTest.status === "running"}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Attempt READ {OTHER_AGENCY} applicants
          </button>
          <span className="text-sm text-zinc-600 min-w-[200px]">
            {resultText(readTest)}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 items-center mt-3">
          <button
            type="button"
            onClick={() => runWrite(OTHER_AGENCY, setWriteTest)}
            disabled={writeTest.status === "running"}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Attempt WRITE {OTHER_AGENCY} applicants
          </button>
          <span className="text-sm text-zinc-600 min-w-[200px]">
            {resultText(writeTest)}
          </span>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">
          Permission presets &amp; buildUserDoc (dev only)
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Single source of truth: <code className="bg-zinc-100 px-1 rounded">@/lib/auth/permissions</code>.
          Build a user doc payload and copy JSON for Firestore (replace SERVER_TIMESTAMP with serverTimestamp() when writing).
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-zinc-700 mb-2">Presets</h3>
            <ul className="text-sm text-zinc-600 space-y-2">
              {(Object.keys(PERMISSION_PRESETS) as PresetName[]).map((name) => (
                <li key={name}>
                  <span className="font-medium text-zinc-800">{name}</span>
                  <span className="ml-1">
                    ({PERMISSION_PRESETS[name].length} permissions):{" "}
                    {PERMISSION_PRESETS[name].join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-700 mb-2">Build user doc</h3>
            <div className="space-y-2 text-sm">
              <label className="block">
                <span className="text-zinc-500">uid</span>
                <input
                  type="text"
                  value={presetUid}
                  onChange={(e) => setPresetUid(e.target.value)}
                  placeholder="e.g. user uid"
                  className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1 font-mono text-zinc-900"
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">email</span>
                <input
                  type="text"
                  value={presetEmail}
                  onChange={(e) => setPresetEmail(e.target.value)}
                  placeholder="e.g. user@example.com"
                  className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1 font-mono text-zinc-900"
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">agencyId</span>
                <input
                  type="text"
                  value={presetAgencyId}
                  onChange={(e) => setPresetAgencyId(e.target.value)}
                  placeholder="optional"
                  className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1 font-mono text-zinc-900"
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">role</span>
                <input
                  type="text"
                  value={presetRole}
                  onChange={(e) => setPresetRole(e.target.value)}
                  className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1 font-mono text-zinc-900"
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">displayName</span>
                <input
                  type="text"
                  value={presetDisplayName}
                  onChange={(e) => setPresetDisplayName(e.target.value)}
                  placeholder="optional"
                  className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1 font-mono text-zinc-900"
                />
              </label>
              <label className="block">
                <span className="text-zinc-500">presetName</span>
                <select
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value as PresetName)}
                  className="mt-0.5 block w-full rounded border border-zinc-300 px-2 py-1 text-zinc-900"
                >
                  {(Object.keys(PERMISSION_PRESETS) as PresetName[]).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
        {presetJson && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-zinc-700">JSON (copy and replace SERVER_TIMESTAMP when writing)</span>
              <button
                type="button"
                onClick={copyPresetJson}
                className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Copy
              </button>
            </div>
            <pre className="rounded border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800 overflow-x-auto max-h-48 overflow-y-auto">
              {presetJson}
            </pre>
          </div>
        )}
      </Card>
    </>
  );
}
