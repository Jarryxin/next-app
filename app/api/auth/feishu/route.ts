import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/feishu";
import { createPendingAuth } from "@/lib/auth-state";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomUUID();
  createPendingAuth(state);
  const url = getAuthorizationUrl(state);
  return NextResponse.json({ url, state });
}
