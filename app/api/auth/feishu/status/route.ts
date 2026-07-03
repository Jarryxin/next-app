import { NextRequest, NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth-state";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state");
  if (!state) {
    return NextResponse.json({ status: "expired" }, { status: 400 });
  }

  const auth = getAuthStatus(state);
  if (auth.status === "success" && auth.token) {
    const response = NextResponse.json({ status: "success" });
    response.cookies.set("session_token", auth.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  }

  return NextResponse.json({ status: auth.status });
}
