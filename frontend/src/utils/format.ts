export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatWalkTime(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  const rounded = Math.round(minutes);
  return `${rounded} min${rounded === 1 ? "" : "s"}`;
}

export function formatEdgeType(edgeType: string | null): string {
  if (!edgeType) return "";
  return edgeType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
