import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isHappeningNowIST } from "@/lib/ist/time";

export const runtime = "nodejs";

const QuerySchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
  radius_m: z.coerce.number().gte(50).lte(5000).default(500),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  if (latRaw === null || lngRaw === null) {
    return NextResponse.json(
      { errors: { lat: latRaw === null ? "required" : null, lng: lngRaw === null ? "required" : null } },
      { status: 400 }
    );
  }
  const parsed = QuerySchema.safeParse({
    lat: latRaw,
    lng: lngRaw,
    radius_m: url.searchParams.get("radius_m") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("nearby_badamangals", {
    in_lat: parsed.data.lat,
    in_lng: parsed.data.lng,
    in_radius_m: parsed.data.radius_m,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    photo_path: string | null;
    start_time: string;
    end_time: string;
    event_date: string;
    distance_m: number;
  }>;

  const items = rows.map((row) => {
    const photoUrl = row.photo_path
      ? admin.storage.from("badamangal-photos").getPublicUrl(row.photo_path).data.publicUrl
      : null;
    return {
      id: row.id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      photo_url: photoUrl,
      start_time: row.start_time,
      end_time: row.end_time,
      event_date: row.event_date,
      distance_m: row.distance_m,
      is_happening_now: isHappeningNowIST(row.event_date, row.start_time, row.end_time),
    };
  });

  return NextResponse.json({ items }, { status: 200 });
}
