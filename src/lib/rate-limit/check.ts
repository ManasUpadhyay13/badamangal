import type { SupabaseClient } from "@supabase/supabase-js";

export const HOURLY_LIMIT = 5;
export const WINDOW_MS = 60 * 60 * 1000;

export type AttemptInput = {
  fingerprint: string;
  ip: string;
};

export type AttemptResult =
  | { ok: true; attemptId: number }
  | { ok: false; retryAfterSeconds: number };

/**
 * Inserts a rate_limit_attempts row (outcome='rate_limited' as placeholder),
 * counts attempts in the trailing 60-minute window, and returns whether the
 * caller should be allowed to proceed.
 *
 * The caller must update the row's outcome via markOutcome() after the
 * downstream work resolves, OR delete it via deleteAttempt() if the call
 * should be made free (e.g., on validation infrastructure failure).
 */
export async function checkAndRecordAttempt(
  admin: SupabaseClient,
  input: AttemptInput
): Promise<AttemptResult> {
  const insertRes = await admin
    .from("rate_limit_attempts")
    .insert({
      device_fingerprint: input.fingerprint,
      ip_address: input.ip,
      outcome: "rate_limited",
    })
    .select("id, attempted_at")
    .single();

  if (insertRes.error || !insertRes.data) {
    throw new Error(`Failed to insert rate-limit attempt: ${insertRes.error?.message}`);
  }

  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const countRes = await admin
    .from("rate_limit_attempts")
    .select("id", { count: "exact", head: true })
    .gt("attempted_at", since)
    .or(`device_fingerprint.eq.${input.fingerprint},ip_address.eq.${input.ip}`);

  const total = countRes.count ?? 0;

  if (total > HOURLY_LIMIT) {
    return { ok: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }

  return { ok: true, attemptId: insertRes.data.id as number };
}

export async function markOutcome(
  admin: SupabaseClient,
  attemptId: number,
  outcome: "accepted" | "rejected_validation"
): Promise<void> {
  const { error } = await admin
    .from("rate_limit_attempts")
    .update({ outcome })
    .eq("id", attemptId);
  if (error) throw new Error(`markOutcome failed: ${error.message}`);
}

export async function deleteAttempt(admin: SupabaseClient, attemptId: number): Promise<void> {
  const { error } = await admin
    .from("rate_limit_attempts")
    .delete()
    .eq("id", attemptId);
  if (error) throw new Error(`deleteAttempt failed: ${error.message}`);
}
