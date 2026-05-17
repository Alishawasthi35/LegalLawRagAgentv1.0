import { NextResponse } from "next/server";
import { getCurrentUser, getDbClient } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getDbClient();

  const { data, error } = await sb
    .from("chat_sessions")
    .select("id, title, pinned, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getDbClient();

  const { title } = await req.json().catch(() => ({ title: "Untitled research" }));
  const { data, error } = await sb
    .from("chat_sessions")
    .insert({ user_id: user.id, title: title || "Untitled research" })
    .select("id, title")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}
