"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import { saffronPin } from "@/lib/geo/leaflet-icon";
import type { FindItem } from "./BadamangalCard";
import { directionsWebUrl } from "@/lib/geo/deep-link";
import { formatDistance } from "@/lib/geo/distance";
import { deriveTimingLabel } from "@/lib/ist/happening";

function FitBounds({
  items,
  center,
}: {
  items: FindItem[];
  center: { lat: number; lng: number };
}) {
  const map = useMap();
  useEffect(() => {
    if (items.length === 0) {
      map.setView([center.lat, center.lng], 15);
      return;
    }
    const bounds = L.latLngBounds(
      items
        .map((i) => [i.lat, i.lng] as [number, number])
        .concat([[center.lat, center.lng]])
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [items, center, map]);
  return null;
}

export default function MapView({
  items,
  center,
}: {
  items: FindItem[];
  center: { lat: number; lng: number };
}) {
  return (
    <div className="h-[70vh] rounded-xl overflow-hidden border border-saffron-100">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {items.map((item) => (
          <Marker key={item.id} position={[item.lat, item.lng]} icon={saffronPin}>
            <Popup>
              <strong>{item.name}</strong>
              <br />
              {deriveTimingLabel({
                event_date: item.event_date,
                start_time: item.start_time,
                end_time: item.end_time,
              })}
              <br />
              {formatDistance(item.distance_m)}
              <br />
              <a href={directionsWebUrl({ lat: item.lat, lng: item.lng, name: item.name })}>
                Get directions ↗
              </a>
            </Popup>
          </Marker>
        ))}
        <FitBounds items={items} center={center} />
      </MapContainer>
    </div>
  );
}
