"use client";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { saffronPin } from "@/lib/geo/leaflet-icon";
import type { Coord } from "./LocationPicker";

function ClickCapture({ onPick }: { onPick: (c: Coord) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function PinDropMap({
  value,
  onChange,
  initialCenter = { lat: 26.8467, lng: 80.9462 },
}: {
  value: Coord | null;
  onChange: (c: Coord) => void;
  initialCenter?: Coord;
}) {
  const center = value ?? initialCenter;
  return (
    <div className="h-80 rounded-md overflow-hidden border border-saffron-100">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture onPick={onChange} />
        {value && <Marker position={[value.lat, value.lng]} icon={saffronPin} />}
      </MapContainer>
    </div>
  );
}
