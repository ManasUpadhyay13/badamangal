import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({ id: z.uuid() });

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Look up the photo path so we can delete the file too.
  const { data: row, error: selectError } = await admin
    .from("badamangals")
    .select("photo_path")
    .eq("id", parsed.data.id)
    .single();

  if (selectError) {
    if (selectError.code === "PGRST116") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  // Delete the photo first (best-effort; ignore not-found errors).
  if (row?.photo_path) {
    const { error: storageError } = await admin.storage
      .from("badamangal-photos")
      .remove([row.photo_path]);
    if (storageError) console.error("storage remove failed", storageError);
  }

  // Delete the row. ON DELETE CASCADE on `reports` cleans up linked reports.
  const { error: deleteError } = await admin
    .from("badamangals")
    .delete()
    .eq("id", parsed.data.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
