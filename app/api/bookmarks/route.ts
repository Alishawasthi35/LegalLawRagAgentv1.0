import { NextResponse } from "next/server";
import { getCurrentUser, getDbClient } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ikDocMeta, ikUrl } from "@/lib/indiankanoon";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getDbClient();

  const { data, error } = await sb
    .from("bookmarks")
    .select(
      `id, note, tags, created_at,
       case:cases(id, title, citation, court, url, ik_doc_id),
       statute:statutes(id, act_short, section, heading)`
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookmarks: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getDbClient();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  let { case_id, statute_id, ik_doc_id, note, tags } = body as {
    case_id?: string | null;
    statute_id?: string | null;
    ik_doc_id?: string | null;
    note?: string;
    tags?: string[];
  };

  if (!case_id && !statute_id && ik_doc_id) {
    const service = createServiceClient();
    const { data: existing } = await service
      .from("cases")
      .select("id")
      .eq("ik_doc_id", String(ik_doc_id))
      .maybeSingle();
    if (existing) {
      case_id = existing.id;
    } else {
      let stub: { title: string; court?: string; publishdate?: string; citation?: string } = {
        title: `IK Doc ${ik_doc_id}`
      };
      try {
        const meta = await ikDocMeta(Number(ik_doc_id));
        if (meta.title) stub.title = meta.title;
        if ((meta as any).docsource) stub.court = (meta as any).docsource;
        if ((meta as any).publishdate) stub.publishdate = (meta as any).publishdate;
        if (meta.citation) stub.citation = meta.citation;
      } catch {
        /* network failure — fall back to skeletal stub */
      }
      const { data: created, error } = await service
        .from("cases")
        .insert({
          ik_doc_id: String(ik_doc_id),
          title: stub.title,
          court: stub.court ?? null,
          citation: stub.citation ?? null,
          decision_date: stub.publishdate ? stub.publishdate.slice(0, 10) : null,
          url: ikUrl(Number(ik_doc_id))
        })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      case_id = created.id;
    }
  }

  if (!case_id && !statute_id) {
    return NextResponse.json({ error: "case_id, ik_doc_id, or statute_id required" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("bookmarks")
    .insert({
      user_id: user.id,
      case_id: case_id ?? null,
      statute_id: statute_id ?? null,
      note: note ?? null,
      tags: tags ?? []
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookmark: data });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getDbClient();
  const { id } = await req.json();
  const { error } = await sb.from("bookmarks").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
