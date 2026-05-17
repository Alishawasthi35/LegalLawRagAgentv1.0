import { redirect } from "next/navigation";
import { getCurrentUser, AUTH_DISABLED } from "@/lib/auth";
import { getDbClient } from "@/lib/auth";
import { SessionSidebar } from "@/components/sidebar/SessionSidebar";
import { TopBar } from "@/components/layout/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sb = getDbClient();
  const { data: sessions } = await sb
    .from("chat_sessions")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <SessionSidebar
        sessions={sessions ?? []}
        userEmail={user.email}
        isGuest={user.is_guest}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar guestMode={AUTH_DISABLED} />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
