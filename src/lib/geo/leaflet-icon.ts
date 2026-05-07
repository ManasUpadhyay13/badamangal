"use client";

import L from "leaflet";

// Default Leaflet marker icons reference paths that don't resolve under Next.js bundling.
type IconDefault = L.Icon.Default & { _getIconUrl?: () => string };
delete (L.Icon.Default.prototype as IconDefault)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export const saffronPin = L.divIcon({
  className: "saffron-pin",
  html: `<div style="
    width: 24px; height: 24px;
    border-radius: 50% 50% 50% 0;
    background: #ea580c;
    border: 2px solid #92400e;
    transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});
