import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: { next?: string };
}) {
  // If the user is already signed in, send them straight to /app
  // (or wherever the `next` param says). Prevents the awkward case
  // where a signed-in user hits /login from a stale tab.
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    redirect(searchParams.next || "/app");
  }
  return <LoginForm />;
}
