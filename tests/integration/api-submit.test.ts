import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/vision/validator", () => ({
  validatePhoto: vi.fn(),
  ValidationInfraError: class extends Error {},
}));
vi.mock("@/lib/rate-limit/check", () => ({
  checkAndRecordAttempt: vi.fn(),
  markOutcome: vi.fn(),
  deleteAttempt: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: vi.fn(),
}));

import { POST } from "@/app/api/submit/route";
import { validatePhoto } from "@/lib/vision/validator";
import { checkAndRecordAttempt, markOutcome, deleteAttempt } from "@/lib/rate-limit/check";
import { supabaseAdmin } from "@/lib/supabase/server";

function isoToday(): string {
  // IST today (UTC+5:30)
  const ms = Date.now() + 5.5 * 3600 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function makeFormData(overrides: Partial<Record<string, string | Blob>> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Hanuman Mandir Bhandara");
  fd.set("lat", "26.8467");
  fd.set("lng", "80.9462");
  fd.set("event_date", isoToday());
  fd.set("start_time", "17:00");
  fd.set("end_time", "20:00");
  fd.set(
    "photo",
    new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }),
    "p.jpg"
  );
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v as string | Blob);
  return fd;
}

function makeReq(fd: FormData): Request {
  return new Request("http://localhost/api/submit", {
    method: "POST",
    body: fd,
    headers: { "x-device-fingerprint": "fp-test", "x-forwarded-for": "9.9.9.9" },
  });
}

function fakeAdmin() {
  const inserted: Array<Record<string, unknown>> = [];
  const removed: string[] = [];
  return {
    inserted,
    removed,
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: "uuid.jpg" }, error: null }),
        remove: async (paths: string[]) => {
          removed.push(...paths);
          return { data: null, error: null };
        },
      }),
    },
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "row-uuid" }, error: null }),
          }),
        };
      },
    }),
  };
}

describe("POST /api/submit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 201 on accepted submission", async () => {
    (checkAndRecordAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      attemptId: 42,
    });
    (validatePhoto as ReturnType<typeof vi.fn>).mockResolvedValue({
      is_authentic: true,
      confidence: "high",
      reason: "ok",
    });
    const admin = fakeAdmin();
    (supabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const res = await POST(makeReq(makeFormData()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("row-uuid");
    expect(markOutcome).toHaveBeenCalledWith(admin, 42, "accepted");
  });

  it("returns 422 when Gemini rejects", async () => {
    (checkAndRecordAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      attemptId: 43,
    });
    (validatePhoto as ReturnType<typeof vi.fn>).mockResolvedValue({
      is_authentic: false,
      confidence: "high",
      reason: "looks like a wedding",
    });
    const admin = fakeAdmin();
    (supabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const res = await POST(makeReq(makeFormData()));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.reason).toMatch(/wedding/);
    expect(markOutcome).toHaveBeenCalledWith(admin, 43, "rejected_validation");
    expect(admin.removed.length).toBe(1);
  });

  it("returns 429 when rate-limited", async () => {
    (checkAndRecordAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      retryAfterSeconds: 1234,
    });
    const admin = fakeAdmin();
    (supabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const res = await POST(makeReq(makeFormData()));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.retry_after_seconds).toBe(1234);
  });

  it("returns 502 and refunds the attempt on Gemini infra failure", async () => {
    (checkAndRecordAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      attemptId: 50,
    });
    (validatePhoto as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("timeout"));
    const admin = fakeAdmin();
    (supabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const res = await POST(makeReq(makeFormData()));
    expect(res.status).toBe(502);
    expect(deleteAttempt).toHaveBeenCalledWith(admin, 50);
  });

  it("returns 400 on field validation failure", async () => {
    const fd = makeFormData({ name: "" });
    const res = await POST(makeReq(fd));
    expect(res.status).toBe(400);
  });

  it("accepts a submission without a photo (skips OpenAI validation)", async () => {
    (checkAndRecordAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      attemptId: 60,
    });
    const admin = fakeAdmin();
    (supabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const fd = new FormData();
    fd.set("name", "No-photo Bhandara");
    fd.set("lat", "26.8467");
    fd.set("lng", "80.9462");
    fd.set("event_date", isoToday());
    fd.set("start_time", "17:00");
    fd.set("end_time", "20:00");
    // no photo

    const res = await POST(
      new Request("http://localhost/api/submit", {
        method: "POST",
        body: fd,
        headers: { "x-device-fingerprint": "fp-test", "x-forwarded-for": "9.9.9.9" },
      })
    );
    expect(res.status).toBe(201);
    expect(validatePhoto).not.toHaveBeenCalled();
    expect(markOutcome).toHaveBeenCalledWith(admin, 60, "accepted");
    // photo_path should be null on the inserted row
    expect(admin.inserted[0]?.photo_path).toBeNull();
  });

  it("returns 400 on event_date outside window", async () => {
    const tooFar = new Date(Date.now() + 30 * 86400 * 1000 + 5.5 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const fd = makeFormData({ event_date: tooFar });
    const res = await POST(makeReq(fd));
    expect(res.status).toBe(400);
  });
});
