import { NextRequest, NextResponse } from "next/server";
import { searchSimilar } from "@/lib/rag";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query as string | undefined;
    const k = Math.min(Math.max(body.k ?? 5, 1), 20);

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const results = await searchSimilar(query, k);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Retrieve error:", error);
    return NextResponse.json({ error: "检索失败" }, { status: 500 });
  }
}
