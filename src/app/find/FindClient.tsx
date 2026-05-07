"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import MotifBand from "@/components/MotifBand";
import RadiusSlider from "./RadiusSlider";
import ListView from "./ListView";
import type { FindItem } from "./BadamangalCard";

export default function FindClient() {
  const router = useRouter();
  const search = useSearchParams();
  const showToast = search.get("submitted") === "1";

  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [radius, setRadius] = useState(500);
  const [items, setItems] = useState<FindItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showToast) return;
    toast.success("Thanks for sharing 🪔");
    router.replace("/find");
  }, [showToast, router]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPermissionDenied(true),
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  }, []);

  const fetchNearby = useCallback(async (lat: number, lng: number, r: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nearby?lat=${lat}&lng=${lng}&radius_m=${r}`);
      if (!res.ok) {
        setItems([]);
        return;
      }
      const body = await res.json();
      setItems(body.items as FindItem[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!coord) return;
    void fetchNearby(coord.lat, coord.lng, radius);
  }, [coord, radius, fetchNearby]);

  return (
    <main className="max-w-2xl mx-auto px-4 pb-16">
      <header className="sticky top-0 bg-background z-10 pt-4 pb-3">
        <h1 className="m-0 text-2xl font-bold text-saffron-700 text-center">
          🪔 Find a Bhandara
        </h1>
        <MotifBand marginBlock="0.5rem 0" />
        <div className="flex flex-col gap-2 mt-2">
          <RadiusSlider value={radius} onCommit={setRadius} disabled={!coord} />
        </div>
      </header>

      {!coord && !permissionDenied && (
        <p className="text-center text-muted-foreground mt-4">
          Looking up your location…
        </p>
      )}

      {permissionDenied && !coord && (
        <div className="bg-saffron-100 text-ink-900 px-4 py-3 rounded-md mb-4">
          We couldn&apos;t access your location. Use the location picker on the Post page to drop a pin instead.
        </div>
      )}

      <ListView
        items={items}
        loading={loading && Boolean(coord)}
        onReport={(id) => {
          // Wired in Phase 5 (ReportDialog)
          console.log("Report requested for", id);
        }}
      />
    </main>
  );
}
