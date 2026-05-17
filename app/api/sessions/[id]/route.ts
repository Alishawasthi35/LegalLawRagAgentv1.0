import { NextResponse } from "next/server";
import { getCurrentUser, getDbClient } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getDbClient();

  const { data: session } = await sb
    .from("chat_sessions")
    .select("id, title, created_at, updated_at")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: messages } = await sb
    .from("messages")
    .select("id, role, content_text, content_json, created_at")
    .eq("session_id", params.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ session, messages: messages ?? [] });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getDbClient();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim().slice(0, 200);
  if (typeof body.pinned === "boolean") update.pinned = body.pinned;
  if (!Object.keys(update).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { data, error } = await sb
    .from("chat_sessions")
    .update(update)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id, title, pinned")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getDbClient();

  const { error } = await sb
    .from("chat_sessions")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
