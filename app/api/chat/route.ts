import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  query: string;
  session_id?: string | null;
}

export async function POST(req: Request) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const query = (body.query || "").trim();
  if (!query) return NextResponse.json({ error: "empty query" }, { status: 400 });

  const service = createServiceClient();

  // Ensure / create the session.
  let sessionId = body.session_id ?? null;
  if (!sessionId) {
    const { data: created, error } = await service
      .from("chat_sessions")
      .insert({ user_id: user.id, title: query.slice(0, 80) })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    sessionId = created.id;
  }

  // Persist the user message.
  await service.from("messages").insert({
    session_id: sessionId,
    user_id: user.id,
    role: "user",
    content_text: query
  });

  // Build a tiny rolling history summary from the last 4 messages.
  const { data: hist } = await service
    .from("messages")
    .select("role, content_text, content_json")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(4);
  const history = (hist ?? [])
    .reverse()
    .map((m) =>
      m.role === "user"
        ? `User: ${m.content_text ?? ""}`
        : `Assistant: ${(m.content_json as any)?.headline ?? ""}`
    )
    .join("\n");

  // Stream the agent as SSE.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };
      send("session", { session_id: sessionId });
      try {
        const gen = runAgent(query, history);
        let finalAnswer: any = null;
        let finalTrace: any = null;
        for await (const ev of gen) {
          if (ev.type === "stage") send("stage", { stage: ev.stage, message: ev.message, data: ev.data });
          else if (ev.type === "result") {
            finalAnswer = ev.data.answer;
            finalTrace = ev.data.trace;
            send("answer", ev.data.answer);
          } else if (ev.type === "error") {
            send("error", { message: ev.message });
          }
        }

        if (finalAnswer) {
          // Persist assistant message with compressed audit trail.
          const compressedTrace = finalTrace
            ? {
                plan: finalTrace.plan,
                reranked_meta: finalTrace.reranked.map((c: any) => ({
                  case_title: c.case_title,
                  citation: c.citation,
                  url: c.url,
                  source: c.source,
                  rerank_score: c.rerank_score,
                  para: c.para_number
                })),
                elapsed: finalTrace.elapsed
              }
            : null;
          await service.from("messages").insert({
            session_id: sessionId,
            user_id: user.id,
            role: "assistant",
            content_json: finalAnswer,
            retrieved_context: compressedTrace,
            model: finalAnswer.meta?.model ?? "gemini"
          });
        }
      } catch (err: any) {
        send("error", { message: err?.message ?? "agent failed" });
      } finally {
        send("end", {});
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
