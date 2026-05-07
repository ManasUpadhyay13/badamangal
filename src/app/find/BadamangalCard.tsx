"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { directionsUrl, directionsWebUrl } from "@/lib/geo/deep-link";
import { formatDistance } from "@/lib/geo/distance";
import { deriveTimingLabel } from "@/lib/ist/happening";

export type FindItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  photo_url: string | null;
  start_time: string;
  end_time: string;
  event_date: string;
  distance_m: number;
  is_happening_now: boolean;
};

export default function BadamangalCard({
  item,
  onReport,
}: {
  item: FindItem;
  onReport: (id: string) => void;
}) {
  const [ua, setUa] = useState<string>("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot UA capture on client
    setUa(navigator.userAgent);
  }, []);

  const label = deriveTimingLabel({
    event_date: item.event_date,
    start_time: item.start_time,
    end_time: item.end_time,
  });

  const primaryHref = ua
    ? directionsUrl({ lat: item.lat, lng: item.lng, name: item.name }, ua)
    : "#";
  const fallbackHref = directionsWebUrl({
    lat: item.lat,
    lng: item.lng,
    name: item.name,
  });

  return (
    <Card className="overflow-hidden mb-3 p-0 gap-0">
      <div className="relative aspect-video bg-saffron-100 flex items-center justify-center">
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo_url}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover block"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              backgroundImage:
                "conic-gradient(from 0deg, var(--color-gold-500) 0deg 60deg, transparent 60deg 90deg, var(--color-gold-500) 90deg 150deg, transparent 150deg 180deg, var(--color-gold-500) 180deg 240deg, transparent 240deg 270deg, var(--color-gold-500) 270deg 330deg, transparent 330deg 360deg)",
              backgroundSize: "20px 20px",
              backgroundColor: "var(--color-saffron-50)",
            }}
            aria-hidden
          >
            <span className="text-4xl">🪔</span>
          </div>
        )}
        {item.is_happening_now && (
          <Badge className="absolute top-2 left-2 bg-green-700 text-white hover:bg-green-700">
            Happening now
          </Badge>
        )}
      </div>
      <CardContent className="px-4 py-3">
        <h3 className="m-0 mb-1 text-base font-semibold text-ink-900">{item.name}</h3>
        <p className="m-0 text-sm text-muted-foreground">
          {label} · {formatDistance(item.distance_m)}
        </p>
        <div className="flex gap-2 mt-3 items-center flex-wrap">
          <Button
            size="sm"
            render={
              <a
                href={primaryHref}
                onClick={(e) => {
                  if (primaryHref === "#") e.preventDefault();
                }}
              />
            }
          >
            Get directions ↗
          </Button>
          {primaryHref !== fallbackHref && (
            <Button size="sm" variant="outline" render={<a href={fallbackHref} />}>
              Open in browser
            </Button>
          )}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={() => onReport(item.id)}
          >
            Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
