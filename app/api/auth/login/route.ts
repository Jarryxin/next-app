import { NextRequest, NextResponse } from "next/server";
import { createUser, createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let user = await prisma.user.findFirst({ where: { name: name.trim() } });
  if (!user) {
    user = await createUser(name.trim());
  }

  const session = await createSession(user.id);
  const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name } });
  res.cookies.set("session_token", session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  return res;
}
