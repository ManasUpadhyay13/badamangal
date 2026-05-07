import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({ email: z.email() });

export const ADMIN_COOKIE = "bhandara_admin";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function POST(req: Request) {
  const adminEmail = serverEnv().ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: "admin_not_configured" }, { status: 503 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (parsed.data.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return NextResponse.json({ error: "not_admin" }, { status: 401 });
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, adminEmail, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
