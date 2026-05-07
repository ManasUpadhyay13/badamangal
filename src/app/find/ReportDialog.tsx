"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFingerprint } from "@/lib/fingerprint/useFingerprint";

type State =
  | { kind: "open" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "duplicate" }
  | { kind: "error"; message: string };

export default function ReportDialog({
  badamangalId,
  onClose,
}: {
  badamangalId: string | null;
  onClose: () => void;
}) {
  const fp = useFingerprint();
  const [reason, setReason] = useState("");
  const [state, setState] = useState<State>({ kind: "open" });

  async function submit() {
    if (!fp || !badamangalId) return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-device-fingerprint": fp,
        },
        body: JSON.stringify({
          badamangal_id: badamangalId,
          reason: reason.trim() || undefined,
        }),
      });
      if (res.status === 201) setState({ kind: "done" });
      else if (res.status === 409) setState({ kind: "duplicate" });
      else setState({ kind: "error", message: `Unexpected status ${res.status}` });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  if (!badamangalId) return null;
  const open = true;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this listing</DialogTitle>
        </DialogHeader>
        {state.kind === "open" || state.kind === "submitting" ? (
          <>
            <Label htmlFor="report-reason">What&apos;s wrong with this listing?</Label>
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Optional: tell us what's off"
            />
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={onClose}
                disabled={state.kind === "submitting"}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={state.kind === "submitting" || !fp}
              >
                {state.kind === "submitting" ? "Submitting…" : "Submit report"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {state.kind === "done" && <p>Thanks. We&apos;ll review this listing soon.</p>}
            {state.kind === "duplicate" && (
              <p>You&apos;ve already reported this listing.</p>
            )}
            {state.kind === "error" && (
              <p className="text-destructive">{state.message}</p>
            )}
            <DialogFooter>
              <Button onClick={onClose}>OK</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
