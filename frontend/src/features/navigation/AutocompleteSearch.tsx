"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Building2, DoorOpen, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui";
import { useRoomSearch } from "@/hooks";
import { useNavigationStore } from "@/store";

const EXAMPLES = ["Library", "Principal Office", "Computer Lab", "Room 101", "Server Room"];

export function AutocompleteSearch() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const roomSearch = useRoomSearch();
  const debounceRef = useRef<number | null>(null);

  const setSelectedRoom = useNavigationStore((state) => state.setSelectedRoom);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    if (!query.trim()) {
      roomSearch.reset();
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      roomSearch.mutate(query.trim());
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const results = roomSearch.data?.matches ?? [];
  const showDropdown = isFocused && query.trim().length > 0;

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-full border border-hairline bg-white px-4 py-2.5 shadow-soft dark:bg-[#0F172A] dark:shadow-black/30">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 150)}
          placeholder="Search rooms, labs, offices…"
          className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      {!isFocused && !query && (
        <p className="mt-1.5 px-2 text-[11px] text-muted">
          Try: {EXAMPLES.slice(0, 3).join(" · ")}
        </p>
      )}

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="glass absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 max-h-72 overflow-y-auto rounded-2xl p-2 shadow-glow"
          >
            {roomSearch.isPending && <Spinner size="sm" label="Searching…" />}

            {!roomSearch.isPending && results.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted">No rooms matched &ldquo;{query}&rdquo;.</p>
            )}

            {!roomSearch.isPending &&
              results.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setSelectedRoom(room);
                    setQuery(room.name);
                    setIsFocused(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-brand/5"
                >
                  <DoorOpen className="h-4 w-4 shrink-0 text-brand" />
                  <span className="flex-1">
                    <span className="block font-medium">{room.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Building2 className="h-3 w-3" />
                      {room.building_name} · {room.floor_name}
                    </span>
                  </span>
                </button>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
