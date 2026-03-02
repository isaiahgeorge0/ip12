import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/serverSession";

export async function GET() {
  try {
    const user = await getServerSession();
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
