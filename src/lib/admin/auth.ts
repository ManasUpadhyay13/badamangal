import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { ADMIN_COOKIE } from "@/app/api/admin/login/route";

export async function requireAdmin(): Promise<
  { ok: true; email: string } | { ok: false; status: 401 | 503 }
> {
  const adminEmail = serverEnv().ADMIN_EMAIL;
  if (!adminEmail) return { ok: false, status: 503 };

  const store = await cookies();
  const cookieValue = store.get(ADMIN_COOKIE)?.value;
  if (!cookieValue) return { ok: false, status: 401 };
  if (cookieValue.toLowerCase() !== adminEmail.toLowerCase()) {
    return { ok: false, status: 401 };
  }
  return { ok: true, email: adminEmail };
}
