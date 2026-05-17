import { redirect } from "next/navigation";
import { getCurrentUser, getDbClient } from "@/lib/auth";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default async function SessionPage({ params }: { params: { sessionId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sb = getDbClient();
  const { data: session } = await sb
    .from("chat_sessions")
    .select("id, title")
    .eq("id", params.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session) redirect("/app");

  const { data: messages } = await sb
    .from("messages")
    .select("id, role, content_text, content_json, created_at")
    .eq("session_id", params.sessionId)
    .order("created_at", { ascending: true });

  return <ChatWindow sessionId={session.id} initialMessages={messages ?? []} />;
}
