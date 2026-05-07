import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Row = {
  id: string;
  name: string;
  photo_path: string;
  event_date: string;
  hidden_at: string | null;
  reports: { id: string; reason: string | null; created_at: string }[];
};

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: auth.status });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("badamangals")
    .select(
      `
      id,
      name,
      photo_path,
      event_date,
      hidden_at,
      reports!inner ( id, reason, created_at )
    `
    )
    .order("created_at", { foreignTable: "reports", ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Row[];

  const items = rows.map((row) => {
    const { data: pub } = admin.storage.from("badamangal-photos").getPublicUrl(row.photo_path);
    return {
      id: row.id,
      name: row.name,
      photo_url: pub.publicUrl,
      event_date: row.event_date,
      hidden_at: row.hidden_at,
      report_count: row.reports.length,
      reasons: row.reports.map((r) => r.reason).filter((r): r is string => Boolean(r)),
      latest_report_at: row.reports[0]?.created_at,
    };
  });

  items.sort((a, b) => {
    if (b.report_count !== a.report_count) return b.report_count - a.report_count;
    return (b.latest_report_at ?? "").localeCompare(a.latest_report_at ?? "");
  });

  return NextResponse.json({ items });
}
