import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Row = {
  id: string;
  name: string;
  photo_path: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  created_at: string;
  hidden_at: string | null;
  reports: { id: string; reason: string | null; created_at: string }[];
};

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const admin = supabaseAdmin();

  // Pull every badamangal (including hidden) plus its reports.
  const { data, error } = await admin
    .from("badamangals")
    .select(
      `
      id,
      name,
      photo_path,
      event_date,
      start_time,
      end_time,
      created_at,
      hidden_at,
      reports ( id, reason, created_at )
    `
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];

  const items = rows.map((row) => {
    const photoUrl = row.photo_path
      ? admin.storage.from("badamangal-photos").getPublicUrl(row.photo_path).data.publicUrl
      : null;
    return {
      id: row.id,
      name: row.name,
      photo_url: photoUrl,
      event_date: row.event_date,
      start_time: row.start_time,
      end_time: row.end_time,
      created_at: row.created_at,
      hidden_at: row.hidden_at,
      report_count: row.reports.length,
      reasons: row.reports.map((r) => r.reason).filter((r): r is string => Boolean(r)),
      latest_report_at: row.reports
        .map((r) => r.created_at)
        .sort()
        .reverse()[0],
    };
  });

  // Reported listings first, then most recent.
  items.sort((a, b) => {
    if ((b.report_count > 0 ? 1 : 0) !== (a.report_count > 0 ? 1 : 0)) {
      return (b.report_count > 0 ? 1 : 0) - (a.report_count > 0 ? 1 : 0);
    }
    return b.created_at.localeCompare(a.created_at);
  });

  return NextResponse.json({ items });
}
