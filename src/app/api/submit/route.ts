import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  checkAndRecordAttempt,
  markOutcome,
  deleteAttempt,
} from "@/lib/rate-limit/check";
import { validatePhoto } from "@/lib/vision/validator";
import { isWithinSubmissionWindow } from "@/lib/ist/time";

export const runtime = "nodejs";
export const maxDuration = 30;

const FormSchema = z.object({
  name: z.string().trim().min(1).max(80),
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

function normaliseTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "0.0.0.0";
}

function pickExt(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: Request) {
  const fingerprint = req.headers.get("x-device-fingerprint");
  if (!fingerprint) {
    return NextResponse.json(
      { errors: { _root: "Missing fingerprint" } },
      { status: 400 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { errors: { _root: "Invalid multipart body" } },
      { status: 400 }
    );
  }

  const fields = {
    name: form.get("name"),
    lat: form.get("lat"),
    lng: form.get("lng"),
    event_date: form.get("event_date"),
    start_time: form.get("start_time"),
    end_time: form.get("end_time"),
  };

  const parsed = FormSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const start = normaliseTime(parsed.data.start_time);
  const end = normaliseTime(parsed.data.end_time);
  if (end <= start) {
    return NextResponse.json(
      { errors: { end_time: "End time must be after start time" } },
      { status: 400 }
    );
  }

  if (!isWithinSubmissionWindow(parsed.data.event_date)) {
    return NextResponse.json(
      { errors: { event_date: "Event date must be within the next 14 days (IST)" } },
      { status: 400 }
    );
  }

  const photoEntry = form.get("photo");
  // Cross-realm-safe check: in test env Blob globals can differ between jsdom and undici.
  const isFileLike =
    photoEntry !== null &&
    typeof photoEntry === "object" &&
    "size" in photoEntry &&
    "arrayBuffer" in photoEntry &&
    typeof (photoEntry as { arrayBuffer: unknown }).arrayBuffer === "function";
  if (!isFileLike) {
    return NextResponse.json({ errors: { photo: "Photo is required" } }, { status: 400 });
  }
  const photo = photoEntry as Blob;
  if (photo.size === 0) {
    return NextResponse.json({ errors: { photo: "Photo is required" } }, { status: 400 });
  }
  if (photo.size > 10 * 1024 * 1024) {
    return NextResponse.json({ errors: { photo: "Photo too large" } }, { status: 400 });
  }

  const ip = clientIp(req);
  const admin = supabaseAdmin();

  const limit = await checkAndRecordAttempt(admin, { fingerprint, ip });
  if (!limit.ok) {
    return NextResponse.json(
      { retry_after_seconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  const ext = pickExt(photo.type);
  const key = `${crypto.randomUUID()}.${ext}`;

  const upload = await admin.storage.from("badamangal-photos").upload(key, photo, {
    contentType: photo.type || "image/jpeg",
    upsert: false,
  });
  if (upload.error) {
    await deleteAttempt(admin, limit.attemptId);
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }

  let outcome;
  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    outcome = await validatePhoto({
      data: buffer.toString("base64"),
      mimeType: photo.type || "image/jpeg",
    });
  } catch {
    await admin.storage.from("badamangal-photos").remove([key]);
    await deleteAttempt(admin, limit.attemptId);
    return NextResponse.json({ error: "validation_unavailable" }, { status: 502 });
  }

  if (!outcome.is_authentic) {
    await admin.storage.from("badamangal-photos").remove([key]);
    await markOutcome(admin, limit.attemptId, "rejected_validation");
    return NextResponse.json({ reason: outcome.reason }, { status: 422 });
  }

  const insert = await admin
    .from("badamangals")
    .insert({
      name: parsed.data.name,
      location: `SRID=4326;POINT(${parsed.data.lng} ${parsed.data.lat})`,
      start_time: start,
      end_time: end,
      event_date: parsed.data.event_date,
      photo_path: key,
      device_fingerprint: fingerprint,
      ip_address: ip,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    await admin.storage.from("badamangal-photos").remove([key]);
    await markOutcome(admin, limit.attemptId, "rejected_validation");
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  await markOutcome(admin, limit.attemptId, "accepted");
  return NextResponse.json({ id: insert.data.id }, { status: 201 });
}
