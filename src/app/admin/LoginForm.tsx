"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 200) {
        router.push("/admin/reports");
        router.refresh();
        return;
      }
      if (res.status === 401) {
        setError("That email isn't an admin.");
      } else if (res.status === 503) {
        setError("Admin access isn't configured on the server (set ADMIN_EMAIL).");
      } else {
        setError(`Unexpected error (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="max-w-sm mx-auto mt-12 text-center" onSubmit={onSubmit}>
      <h1 className="text-2xl font-bold text-saffron-700">Admin sign-in</h1>
      <div className="flex flex-col gap-3 mt-4 text-left">
        <Label htmlFor="admin-email">Email</Label>
        <Input
          id="admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          autoComplete="email"
          required
        />
        <Button type="submit" disabled={busy || !email}>
          {busy ? "Checking…" : "Sign in"}
        </Button>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    </form>
  );
}
