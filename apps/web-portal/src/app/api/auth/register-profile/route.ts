/**
 * POST /api/auth/register-profile
 * After a public user signs up with Firebase Auth (client createUserWithEmailAndPassword),
 * call this with idToken + fullName + phone to create/update their users/{uid} doc with role public.
 * Only allows create when no doc exists, or update when existing role is "public".
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { userDoc } from "@/lib/firestore/paths";

function safeStr(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const idToken = safeStr(body.idToken);
    const fullName = safeStr(body.fullName);
    const email = safeStr(body.email ?? body.emailAddress);
    const phone = safeStr(body.phone);

    if (!idToken) {
      return NextResponse.json({ error: "idToken is required" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const tokenEmail = decoded.email ?? "";

    if (!uid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const db = getAdminFirestore();
    const ref = db.doc(userDoc(uid));
    const snap = await ref.get();

    if (snap.exists) {
      const data = snap.data();
      const existingRole = data?.role as string | undefined;
      if (existingRole && existingRole !== "public") {
        return NextResponse.json(
          { error: "Account already exists with a different role" },
          { status: 403 }
        );
      }
      await ref.update({
        displayName: fullName || (data?.displayName ?? null),
        phone: phone || (data?.phone ?? null),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, created: false });
    }

    const now = FieldValue.serverTimestamp();
    await ref.set({
      uid,
      email: tokenEmail || email || "",
      role: "public",
      status: "active",
      permissions: [],
      displayName: fullName || null,
      phone: phone || null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, created: true });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[register-profile]", err);
    }
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
