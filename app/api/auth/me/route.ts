import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";

export async function GET() {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  const { id, name, avatar } = session.user;
  return NextResponse.json({ user: { id, name, avatar } });
}
