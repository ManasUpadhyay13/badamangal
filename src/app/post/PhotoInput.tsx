"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prepareForUpload } from "@/lib/photo/prepare";

export default function PhotoInput({
  onChange,
}: {
  onChange: (blob: Blob | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      onChange(null);
      setPreview(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { blob } = await prepareForUpload(file);
      const url = URL.createObjectURL(blob);
      setPreview(url);
      onChange(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process photo");
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="photo-input">Photo of the bhandara setup</Label>
      <Input
        id="photo-input"
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleFile}
      />
      {busy && <p className="text-sm text-muted-foreground">Preparing photo…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Preview"
          className="max-w-full rounded-md mt-2"
        />
      )}
    </div>
  );
}
