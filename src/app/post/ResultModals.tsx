"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type Result =
  | { kind: "rejected"; reason: string }
  | { kind: "rate_limited"; retryAt: Date }
  | null;

export default function ResultModals({
  result,
  onDismiss,
  onRetry,
}: {
  result: Result;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  if (!result) return null;
  if (result.kind === "rejected") {
    return (
      <Dialog open onOpenChange={(o) => !o && onDismiss()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This photo doesn&apos;t look like a bhandara</DialogTitle>
            <DialogDescription>{result.reason}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Try a different photo that clearly shows cooking vessels, prasad distribution, or
            seated devotees being served.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={onDismiss}>
              Close
            </Button>
            <Button onClick={onRetry}>Try a different photo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submission limit reached</DialogTitle>
          <DialogDescription>
            You&apos;ve reached the limit of 5 submissions per hour. Please try again at{" "}
            {result.retryAt.toLocaleTimeString()}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onDismiss}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
