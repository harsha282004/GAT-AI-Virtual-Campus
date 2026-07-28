"use client";

import { MapPin } from "lucide-react";

import { Skeleton } from "@/components/ui";
import { useNodes } from "@/hooks";
import { useNavigationStore } from "@/store";

export function CurrentLocationSelect() {
  const { data: nodes, isLoading } = useNodes();
  const fromNodeId = useNavigationStore((state) => state.fromNodeId);
  const setCurrentLocation = useNavigationStore((state) => state.setCurrentLocation);

  const sortedNodes = [...(nodes ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <MapPin className="h-3.5 w-3.5" />
        Current Location
      </label>
      {isLoading ? (
        <Skeleton className="h-11 w-full" />
      ) : (
        <select
          value={fromNodeId ?? ""}
          onChange={(event) => {
            const id = Number(event.target.value);
            const node = sortedNodes.find((n) => n.id === id);
            if (node) setCurrentLocation(node.id, node.name);
          }}
          className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:bg-[#0F172A]"
        >
          <option value="" disabled>
            Select your starting point…
          </option>
          {sortedNodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
