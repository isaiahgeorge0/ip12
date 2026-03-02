import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/serverSession";

const IS_PROD = process.env.NODE_ENV === "production";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
