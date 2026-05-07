"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginForm({ signedInOther }: { signedInOther: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="max-w-sm mx-auto mt-12 text-center">
      <h1 className="text-2xl font-bold text-saffron-700">Admin sign-in</h1>
      {signedInOther && (
        <p className="text-destructive mt-2">
          You&apos;re signed in but this email is not an admin. Sign out and try again.
        </p>
      )}
      {sent ? (
        <p className="mt-4">Check your inbox for the sign-in link.</p>
      ) : (
        <div className="flex flex-col gap-3 mt-4">
          <Label htmlFor="admin-email" className="text-left">
            Email
          </Label>
          <Input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
          />
          <Button type="button" onClick={send} disabled={!email}>
            Send magic link
          </Button>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
      )}
    </div>
  );
}
