"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { writeAuditLog } from "@/lib/firestore/audit";

/** Role presets for provisioning (admin/agent only; never superAdmin from UI). */
const ROLE_PRESETS: Record<"admin" | "agent", string[]> = {
  admin: [
    "crm.read",
    "crm.write",
    "properties.read",
    "properties.write",
    "applications.read",
    "applications.write",
    "tenancies.read",
    "tenancies.write",
    "tickets.read",
    "tickets.write",
    "landlords.read",
    "landlords.write",
    "tenants.read",
    "tenants.write",
    "contractors.read",
    "contractors.write",
    "settings.read",
    "settings.write",
  ],
  agent: [
    "properties.read",
    "applications.read",
    "tenancies.read",
    "tickets.read",
    "tickets.write",
  ],
};

type UserStatus = "active" | "disabled";
type ProvisionRole = "admin" | "agent";

type UserRow = {
  uid: string;
  email: string;
  agencyId: string;
  role: string;
  status: string;
};

const defaultCreateForm = {
  email: "",
  uid: "",
  agencyId: "",
  role: "agent" as ProvisionRole,
  status: "active" as UserStatus,
};

export default function AdminUsersPage() {
  const { profile, user: currentUser } = useAuth();
  const db = getFirebaseFirestore();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyFilter, setAgencyFilter] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [auditWarning, setAuditWarning] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<{ role: ProvisionRole; status: UserStatus } | null>(null);

  const isSuperAdmin = profile?.role === "superAdmin";

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  useEffect(() => {
    if (!db || !isSuperAdmin) {
      setLoading(false);
      setUsers([]);
      return;
    }
    getDocs(collection(db, "users"))
      .then((snap) => {
        const list: UserRow[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            email: typeof data.email === "string" ? data.email : "",
            agencyId: data.agencyId != null ? String(data.agencyId) : "",
            role: typeof data.role === "string" ? data.role : "",
            status: typeof data.status === "string" ? data.status : "active",
          };
        });
        setUsers(list);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [db, isSuperAdmin]);

  const agencyOptions = Array.from(
    new Set(users.map((u) => u.agencyId).filter(Boolean))
  ).sort();
  const filteredUsers =
    agencyFilter === ""
      ? users
      : users.filter((u) => u.agencyId === agencyFilter);

  const handleCreateSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!db || !isSuperAdmin) return;
      const uid = createForm.uid.trim();
      const email = createForm.email.trim();
      const agencyId = createForm.agencyId.trim();
      if (!uid || !email || !agencyId) {
        setMessage({ type: "error", text: "Email, UID, and Agency are required." });
        return;
      }
      if (createForm.role !== "admin" && createForm.role !== "agent") {
        setMessage({ type: "error", text: "Role must be admin or agent." });
        return;
      }
      setSubmitting(true);
      setMessage(null);
      setAuditWarning(null);
      let mainActionSucceeded = false;
      try {
        const ref = doc(db, "users", uid);
        const existing = await getDoc(ref);
        const permissions = ROLE_PRESETS[createForm.role];
        const payload: Record<string, unknown> = {
          uid,
          email,
          agencyId,
          role: createForm.role,
          status: createForm.status,
          permissions,
          updatedAt: serverTimestamp(),
        };
        if (!existing.exists()) {
          payload.createdAt = serverTimestamp();
        }
        await setDoc(ref, payload, { merge: true });
        mainActionSucceeded = true;
        setMessage({ type: "success", text: "User saved." });
        setCreateOpen(false);
        setCreateForm(defaultCreateForm);
        setUsers((prev) => {
          const next = prev.filter((r) => r.uid !== uid);
          next.push({
            uid,
            email,
            agencyId,
            role: createForm.role,
            status: createForm.status,
          });
          return next.sort((a, b) => a.email.localeCompare(b.email));
        });
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        const text =
          e?.code === "permission-denied"
            ? "Permission denied."
            : e?.message ?? "Failed to save user.";
        setMessage({ type: "error", text });
      } finally {
        setSubmitting(false);
      }
      if (mainActionSucceeded && currentUser?.uid) {
        writeAuditLog(db, {
          action: "USER_CREATED",
          agencyId: agencyId || null,
          performedByUid: currentUser.uid,
          targetUid: uid,
          before: null,
          after: {
            role: createForm.role,
            status: createForm.status,
            agencyId,
            permissions: ROLE_PRESETS[createForm.role],
          },
        }).catch((err) => {
          setAuditWarning("Audit log failed (check rules)");
          console.error("[audit]", err);
        });
      }
    },
    [db, isSuperAdmin, createForm, currentUser?.uid]
  );

  const openEdit = useCallback((row: UserRow) => {
    const role: ProvisionRole =
      row.role === "admin" ? "admin" : "agent";
    setEditingUser(row);
    setEditForm({ role, status: row.status as UserStatus });
  }, []);

  const handleEditSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!db || !isSuperAdmin || !editingUser || !editForm) return;
      if (editingUser.role === "superAdmin") {
        setMessage({ type: "error", text: "Cannot edit superAdmin from this UI." });
        return;
      }
      setSubmitting(true);
      setMessage(null);
      setAuditWarning(null);
      let mainActionSucceeded = false;
      const agencyIdAudit = editingUser.agencyId || null;
      const permissions = ROLE_PRESETS[editForm.role];
      try {
        const ref = doc(db, "users", editingUser.uid);
        await setDoc(
          ref,
          {
            role: editForm.role,
            status: editForm.status,
            permissions,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        mainActionSucceeded = true;
        setMessage({ type: "success", text: "User saved." });
        setEditingUser(null);
        setEditForm(null);
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === editingUser.uid
              ? { ...u, role: editForm.role, status: editForm.status }
              : u
          )
        );
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        const text =
          e?.code === "permission-denied"
            ? "Permission denied."
            : e?.message ?? "Failed to save user.";
        setMessage({ type: "error", text });
      } finally {
        setSubmitting(false);
      }
      if (mainActionSucceeded && currentUser?.uid) {
        const onAuditFail = (err: unknown) => {
          setAuditWarning("Audit log failed (check rules)");
          console.error("[audit]", err);
        };
        if (editingUser.role !== editForm.role) {
          writeAuditLog(db, {
            action: "USER_ROLE_CHANGED",
            agencyId: agencyIdAudit,
            performedByUid: currentUser.uid,
            targetUid: editingUser.uid,
            before: { role: editingUser.role },
            after: { role: editForm.role, permissions },
          }).catch(onAuditFail);
        }
        if (editingUser.status !== editForm.status) {
          writeAuditLog(db, {
            action: "USER_STATUS_CHANGED",
            agencyId: agencyIdAudit,
            performedByUid: currentUser.uid,
            targetUid: editingUser.uid,
            before: { status: editingUser.status },
            after: { status: editForm.status },
          }).catch(onAuditFail);
        }
      }
    },
    [db, isSuperAdmin, editingUser, editForm, currentUser?.uid]
  );

  if (!isSuperAdmin) {
    return (
      <>
        <PageHeader title="Users" />
        <Card className="p-6">
          <p className="text-zinc-600">Not authorized.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Users"
        action={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Add user
          </button>
        }
      />

      {message && (
        <div
          className={`mb-4 rounded-md px-4 py-2 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
          role="alert"
        >
          {message.text}
        </div>
      )}
      {auditWarning && (
        <div className="mb-4 rounded-md px-4 py-2 text-sm bg-amber-50 text-amber-800" role="alert">
          {auditWarning}
        </div>
      )}

      <Card className="p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <label className="text-sm font-medium text-zinc-700">
            Agency filter
            <select
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
              className="ml-2 rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-900"
            >
              <option value="">All</option>
              {agencyOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-sm text-zinc-500">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-600">
                  <th className="pb-2 pr-4 font-medium">UID</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Agency</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((row) => (
                  <tr key={row.uid} className="border-b border-zinc-100">
                    <td className="py-2 pr-4 font-mono text-xs text-zinc-700">
                      {row.uid.slice(0, 12)}…
                    </td>
                    <td className="py-2 pr-4 text-zinc-900">{row.email}</td>
                    <td className="py-2 pr-4 text-zinc-700">{row.agencyId || "—"}</td>
                    <td className="py-2 pr-4">{row.role}</td>
                    <td className="py-2 pr-4">{row.status}</td>
                    <td className="py-2">
                      {row.role !== "superAdmin" && (
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="text-zinc-600 hover:text-zinc-900 underline"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {createOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Add user</h2>
            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="user-email" className="block text-sm font-medium text-zinc-700">
                  Email *
                </label>
                <input
                  id="user-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="user-uid" className="block text-sm font-medium text-zinc-700">
                  UID (Firebase Auth) *
                </label>
                <input
                  id="user-uid"
                  type="text"
                  value={createForm.uid}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, uid: e.target.value }))
                  }
                  required
                  placeholder="Paste Firebase Auth UID"
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 font-mono text-sm"
                />
              </div>
              <div>
                <label htmlFor="user-agencyId" className="block text-sm font-medium text-zinc-700">
                  Agency ID *
                </label>
                <input
                  id="user-agencyId"
                  type="text"
                  value={createForm.agencyId}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, agencyId: e.target.value }))
                  }
                  required
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                />
              </div>
              <div>
                <label htmlFor="user-role" className="block text-sm font-medium text-zinc-700">
                  Role preset
                </label>
                <select
                  id="user-role"
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      role: e.target.value as ProvisionRole,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                >
                  <option value="agent">agent</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <label htmlFor="user-status" className="block text-sm font-medium text-zinc-700">
                  Status
                </label>
                <select
                  id="user-status"
                  value={createForm.status}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      status: e.target.value as UserStatus,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                >
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateForm(defaultCreateForm);
                  }}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {editingUser && editForm && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Edit user</h2>
            <p className="text-sm text-zinc-500 mt-1">{editingUser.email}</p>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="edit-role" className="block text-sm font-medium text-zinc-700">
                  Role preset
                </label>
                <select
                  id="edit-role"
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, role: e.target.value as ProvisionRole } : null
                    )
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                >
                  <option value="agent">agent</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-status" className="block text-sm font-medium text-zinc-700">
                  Status (Disable user)
                </label>
                <select
                  id="edit-status"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev ? { ...prev, status: e.target.value as UserStatus } : null
                    )
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
                >
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    setEditForm(null);
                  }}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
