import { supabaseServerWithCookies } from "@/lib/supabase/server-cookies";
import { serverEnv } from "@/lib/env";

export async function requireAdmin(): Promise<
  { ok: true; email: string } | { ok: false; status: 401 | 403 | 503 }
> {
  const adminEmail = serverEnv().ADMIN_EMAIL;
  if (!adminEmail) return { ok: false, status: 503 };

  const supabase = await supabaseServerWithCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };
  if (user.email !== adminEmail) return { ok: false, status: 403 };
  return { ok: true, email: user.email };
}
