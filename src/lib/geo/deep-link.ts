export type Destination = {
  lat: number;
  lng: number;
  name: string;
};

export function directionsUrl(d: Destination, userAgent: string): string {
  const ua = userAgent || "";
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  if (isIOS) {
    return `comgooglemaps://?daddr=${d.lat},${d.lng}&directionsmode=walking`;
  }
  if (isAndroid) {
    return `geo:${d.lat},${d.lng}?q=${d.lat},${d.lng}(${encodeURIComponent(d.name)})`;
  }
  const params = new URLSearchParams({
    api: "1",
    destination: `${d.lat},${d.lng}`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Web URL fallback for app-deep-link failures. */
export function directionsWebUrl(d: Destination): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${d.lat},${d.lng}`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
