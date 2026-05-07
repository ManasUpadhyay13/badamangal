import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  badamangal_id: z.uuid(),
  reason: z.string().trim().max(500).optional(),
});

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function POST(req: Request) {
  const fingerprint = req.headers.get("x-device-fingerprint");
  if (!fingerprint) {
    return NextResponse.json({ error: "missing_fingerprint" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("reports").insert({
    badamangal_id: parsed.data.badamangal_id,
    reporter_fingerprint: fingerprint,
    reporter_ip: clientIp(req),
    reason: parsed.data.reason ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_reported" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
