import { NextResponse } from "next/server";
import { getCurrentUser, getDbClient } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getDbClient();

  const { data, error } = await sb
    .from("messages")
    .select("id, retrieved_context, content_json, created_at, model")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: data.id,
    model: data.model,
    created_at: data.created_at,
    trace: data.retrieved_context ?? null,
    answer_meta: (data.content_json as any)?.meta ?? null
  });
}
