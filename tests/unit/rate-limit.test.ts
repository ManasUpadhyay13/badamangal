import { describe, it, expect } from "vitest";
import { checkAndRecordAttempt } from "../../src/lib/rate-limit/check";

function makeFakeAdmin(initialPriorCount: number) {
  const inserted: { device_fingerprint: string; ip_address: string }[] = [];
  let nextId = 100;
  const fake = {
    from(table: string) {
      if (table !== "rate_limit_attempts") throw new Error(`Unexpected table ${table}`);
      return {
        insert(row: { device_fingerprint: string; ip_address: string }) {
          const id = ++nextId;
          inserted.push(row);
          return {
            select: () => ({
              single: async () => ({
                data: { id, attempted_at: new Date().toISOString() },
                error: null,
              }),
            }),
          };
        },
        select() {
          const total = initialPriorCount + 1;
          const chain = {
            gt() {
              return chain;
            },
            or() {
              return Promise.resolve({ count: total, error: null });
            },
          };
          return chain;
        },
      };
    },
  };
  return { admin: fake as unknown as Parameters<typeof checkAndRecordAttempt>[0], inserted };
}

describe("checkAndRecordAttempt", () => {
  it("allows when prior attempts < 5 (this is the 5th)", async () => {
    const { admin } = makeFakeAdmin(/*priorCount=*/ 4);
    const result = await checkAndRecordAttempt(admin, {
      fingerprint: "fp1",
      ip: "1.2.3.4",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.attemptId).toBeGreaterThan(0);
  });

  it("blocks when prior attempts >= 5 (this is the 6th)", async () => {
    const { admin } = makeFakeAdmin(/*priorCount=*/ 5);
    const result = await checkAndRecordAttempt(admin, {
      fingerprint: "fp1",
      ip: "1.2.3.4",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(3600);
    }
  });
});
