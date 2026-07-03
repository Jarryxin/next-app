import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCodeForToken } from "@/lib/feishu";
import { createSession } from "@/lib/auth";
import { completeAuth } from "@/lib/auth-state";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  try {
    const token = await exchangeCodeForToken(code, process.env.FEISHU_REDIRECT_URI!);

    const userInfo = {
      sub: token.open_id,
      name: token.name,
      picture: token.avatar_url || token.avatar_thumb || token.avatar_middle || token.avatar_big || "",
      open_id: token.open_id,
      union_id: token.union_id,
    };

    const existing = await prisma.user.findUnique({
      where: { feishuUid: userInfo.sub },
    });

    let userId: string;
    if (existing) {
      userId = existing.id;
      await prisma.user.update({
        where: { id: userId },
        data: {
          name: userInfo.name,
          avatar: userInfo.picture,
          feishuAccessToken: token.access_token,
          feishuRefreshToken: token.refresh_token,
        },
      });
    } else {
      const user = await prisma.user.create({
        data: {
          feishuUid: userInfo.sub,
          name: userInfo.name,
          avatar: userInfo.picture,
          feishuAccessToken: token.access_token,
          feishuRefreshToken: token.refresh_token,
        },
      });
      userId = user.id;
    }

    const session = await createSession(userId);
    completeAuth(state, session.token);

    const response = NextResponse.redirect(new URL("/chat", req.url));
    response.cookies.set("session_token", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (err) {
    console.error("[feishu/callback]", err);
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(String(err))}`, req.url));
  }
}
