import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

export const dynamic = "force-dynamic";

/** Temporary debug: which env vars the Next server sees. No secrets. */
export async function GET() {
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const resolvedPath = credsPath
    ? path.isAbsolute(credsPath)
      ? credsPath
      : path.resolve(process.cwd(), credsPath)
    : null;

  const body = {
    cwd: process.cwd(),
    has_FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID?.trim()),
    has_GOOGLE_CLOUD_PROJECT: Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim()),
    has_GOOGLE_APPLICATION_CREDENTIALS: Boolean(credsPath),
    googleAppCredsPath: credsPath ?? null,
    googleAppCredsExists: resolvedPath ? fs.existsSync(resolvedPath) : null,
    nodeEnv: process.env.NODE_ENV ?? null,
  };

  return NextResponse.json(body);
}
