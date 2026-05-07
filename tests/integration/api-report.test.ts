import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: vi.fn(),
}));

import { POST } from "@/app/api/report/route";
import { supabaseAdmin } from "@/lib/supabase/server";

function makeAdmin(insertResult: { data: unknown; error: unknown }) {
  return {
    from: () => ({
      insert: vi.fn().mockResolvedValue(insertResult),
    }),
  };
}

function makeReq(body: unknown) {
  return new Request("http://localhost/api/report", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-device-fingerprint": "fp-x",
      "x-forwarded-for": "8.8.8.8",
    },
  });
}

describe("POST /api/report", () => {
  beforeEach(() => vi.resetAllMocks());

  it("inserts and returns 201 on success", async () => {
    (supabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdmin({ data: { id: "r1" }, error: null })
    );
    const res = await POST(
      makeReq({ badamangal_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", reason: "fake" })
    );
    expect(res.status).toBe(201);
  });

  it("returns 409 when same fingerprint already reported (unique violation)", async () => {
    (supabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(
      makeAdmin({ data: null, error: { code: "23505", message: "duplicate" } })
    );
    const res = await POST(
      makeReq({ badamangal_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" })
    );
    expect(res.status).toBe(409);
  });

  it("returns 400 for missing fingerprint", async () => {
    const res = await POST(
      new Request("http://localhost/api/report", {
        method: "POST",
        body: JSON.stringify({ badamangal_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid uuid", async () => {
    const res = await POST(makeReq({ badamangal_id: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });
});
