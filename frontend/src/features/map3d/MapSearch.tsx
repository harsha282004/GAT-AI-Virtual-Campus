"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { Building } from "@/types";

interface MapSearchProps {
  buildings: Building[];
  onLocate: (buildingId: number) => void;
}

/** Simple client-side filter over the already-loaded building list
 * (Section 12) — no separate search architecture/endpoint, since
 * useBuildings() already has the full list in memory. */
export function MapSearch({ buildings, onLocate }: MapSearchProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(trimmed) || (b.code ?? "").toLowerCase().includes(trimmed),
    );
  }, [buildings, query]);

  function handleSelect(buildingId: number) {
    onLocate(buildingId);
    setQuery("");
  }

  return (
    <div className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 rounded-full border border-hairline bg-white px-4 py-2.5 shadow-soft dark:bg-[#0F172A]">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search buildings…"
          aria-label="Search campus buildings"
          className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="shrink-0 text-muted hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-10 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-hairline bg-white p-2 shadow-soft dark:bg-[#0F172A]">
          {results.map((building) => (
            <li key={building.id}>
              <button
                type="button"
                onClick={() => handleSelect(building.id)}
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink/80 transition-colors hover:bg-brand/5"
              >
                {building.name}
                {building.code && <span className="ml-1.5 text-xs text-muted">{building.code}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim() && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-2xl border border-hairline bg-white p-3 text-center text-xs text-muted shadow-soft dark:bg-[#0F172A]">
          No buildings match &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
