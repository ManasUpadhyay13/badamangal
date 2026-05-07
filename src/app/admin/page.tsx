import { redirect } from "next/navigation";
import { supabaseServerWithCookies } from "@/lib/supabase/server-cookies";
import { serverEnv } from "@/lib/env";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLanding() {
  const supabase = await supabaseServerWithCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && user.email === serverEnv().ADMIN_EMAIL) {
    redirect("/admin/reports");
  }
  return <LoginForm signedInOther={Boolean(user)} />;
}
