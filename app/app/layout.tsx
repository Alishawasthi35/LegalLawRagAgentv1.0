import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionSidebar } from "@/components/sidebar/SessionSidebar";
import { TopBar } from "@/components/layout/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessions } = await sb
    .from("chat_sessions")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <SessionSidebar sessions={sessions ?? []} userEmail={user.email ?? ""} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
