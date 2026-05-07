export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 5) return "Here";
  if (metres < 1000) {
    const rounded = Math.round(metres / 10) * 10;
    return `${rounded} m away`;
  }
  return `${(metres / 1000).toFixed(1)} km away`;
}
