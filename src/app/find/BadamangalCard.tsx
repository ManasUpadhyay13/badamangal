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
  photo_url: string;
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
  const [ua, setUa] = useState("");
  useEffect(() => {
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
      <div className="relative aspect-video bg-saffron-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.photo_url}
          alt={item.name}
          loading="lazy"
          className="w-full h-full object-cover block"
        />
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
            asChild
            size="sm"
            onClick={(e) => {
              if (primaryHref === "#") e.preventDefault();
            }}
          >
            <a href={primaryHref}>Get directions ↗</a>
          </Button>
          {primaryHref !== fallbackHref && (
            <Button asChild size="sm" variant="outline">
              <a href={fallbackHref}>Open in browser</a>
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
