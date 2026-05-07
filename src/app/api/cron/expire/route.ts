import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

const STORAGE_DELETE_BATCH = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: Request) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  const { data: rows, error: selectError } = await admin.rpc("expiring_badamangals");
  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  const expiringRows = (rows ?? []) as { id: string; photo_path: string }[];

  if (expiringRows.length > 0) {
    for (const batch of chunk(
      expiringRows.map((r) => r.photo_path),
      STORAGE_DELETE_BATCH
    )) {
      const { error } = await admin.storage.from("badamangal-photos").remove(batch);
      if (error) console.error("storage remove error", error);
    }

    const { error: deleteError } = await admin
      .from("badamangals")
      .delete()
      .in(
        "id",
        expiringRows.map((r) => r.id)
      );
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  // Housekeep the rate-limit ledger (>7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const { error: rlError } = await admin
    .from("rate_limit_attempts")
    .delete()
    .lt("attempted_at", sevenDaysAgo);
  if (rlError) console.error("rate-limit cleanup error", rlError);

  console.log(`[cron/expire] removed ${expiringRows.length} listings`);
  return NextResponse.json({ expired: expiringRows.length });
}
