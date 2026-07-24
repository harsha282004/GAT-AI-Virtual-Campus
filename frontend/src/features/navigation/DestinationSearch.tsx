"use client";

import { Building2, DoorOpen, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { Skeleton, Spinner } from "@/components/ui";
import { useBuildings, useBuildingSearch, useFloors, useRoomSearch, useRooms } from "@/hooks";
import { useNavigationStore } from "@/store";
import { cn } from "@/utils";
import type { BuildingMatch, RoomMatch } from "@/types";

type Tab = "room" | "building";

export function DestinationSearch() {
  const [tab, setTab] = useState<Tab>("room");
  const [query, setQuery] = useState("");

  const roomSearch = useRoomSearch();
  const buildingSearch = useBuildingSearch();

  // "Load all buildings / load all rooms" — the browsable default list shown
  // before (or without) a search query; the /navigation/room and
  // /navigation/building search endpoints narrow it down on submit.
  const { data: allBuildings, isLoading: buildingsLoading } = useBuildings();
  const { data: allRooms, isLoading: roomsLoading } = useRooms();
  const { data: allFloors } = useFloors();

  const setDestination = useNavigationStore((state) => state.setDestination);
  const destinationId = useNavigationStore((state) => state.destinationId);
  const destinationType = useNavigationStore((state) => state.destinationType);

  const activeMutation = tab === "room" ? roomSearch : buildingSearch;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    if (tab === "room") roomSearch.mutate(query.trim());
    else buildingSearch.mutate(query.trim());
  }

  function handleTabChange(next: Tab) {
    setTab(next);
    setQuery("");
    roomSearch.reset();
    buildingSearch.reset();
  }

  const browseAllRooms: RoomMatch[] = (allRooms ?? []).map((room) => {
    const floor = allFloors?.find((f) => f.id === room.floor_id);
    const building = allBuildings?.find((b) => b.id === floor?.building_id);
    return {
      id: room.id,
      name: room.name,
      room_number: room.room_number,
      floor_id: room.floor_id,
      floor_name: floor?.name ?? "Unknown floor",
      building_id: building?.id ?? 0,
      building_name: building?.name ?? "Unknown building",
      node_id: room.node_id,
    };
  });

  const browseAllBuildings: BuildingMatch[] = (allBuildings ?? []).map((building) => ({
    id: building.id,
    name: building.name,
    code: building.code,
    campus_id: building.campus_id,
    entrance_node_id: null,
  }));

  const roomResults = roomSearch.isSuccess ? (roomSearch.data?.matches ?? []) : browseAllRooms;
  const buildingResults = buildingSearch.isSuccess
    ? (buildingSearch.data?.matches ?? [])
    : browseAllBuildings;

  const isBrowsing = tab === "room" ? roomSearch.isIdle : buildingSearch.isIdle;
  const isListLoading = tab === "room" ? roomsLoading : buildingsLoading;

  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
        Destination
      </label>

      <div className="mb-3 inline-flex rounded-xl bg-brand/5 p-1">
        <button
          type="button"
          onClick={() => handleTabChange("room")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "room" ? "bg-white text-ink shadow-sm" : "text-muted",
          )}
        >
          <DoorOpen className="h-3.5 w-3.5" /> Room
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("building")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "building" ? "bg-white text-ink shadow-sm" : "text-muted",
          )}
        >
          <Building2 className="h-3.5 w-3.5" /> Building
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tab === "room" ? "e.g. Server Room, Reading Hall…" : "e.g. Library, CSE Block…"}
          className="flex-1 rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex items-center justify-center rounded-xl bg-brand px-4 text-white transition-colors hover:bg-brand-dark"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>

      <p className="mt-2 text-[11px] text-muted">
        {isBrowsing ? "Browsing all — search to narrow down." : `Results for "${query}"`}
      </p>

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {isListLoading &&
          isBrowsing &&
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}

        {activeMutation.isPending && <Spinner size="sm" label="Searching…" />}

        {activeMutation.isError && (
          <p className="text-xs text-rose-500">Search failed. Please try again.</p>
        )}

        {tab === "room" &&
          !activeMutation.isPending &&
          !activeMutation.isError &&
          (roomResults.length === 0 ? (
            <p className="text-xs text-muted">
              {roomSearch.isSuccess ? `No rooms matched "${query}".` : "No rooms available yet."}
            </p>
          ) : (
            roomResults.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() =>
                  setDestination("room", room.id, `${room.name} — ${room.building_name}`)
                }
                className={cn(
                  "flex w-full flex-col items-start rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                  destinationType === "room" && destinationId === room.id
                    ? "border-brand bg-brand/5"
                    : "border-hairline hover:border-brand/30",
                )}
              >
                <span className="font-medium text-ink">{room.name}</span>
                <span className="text-xs text-muted">
                  {room.building_name} · {room.floor_name}
                  {room.node_id === null && " · No route point set"}
                </span>
              </button>
            ))
          ))}

        {tab === "building" &&
          !activeMutation.isPending &&
          !activeMutation.isError &&
          (buildingResults.length === 0 ? (
            <p className="text-xs text-muted">
              {buildingSearch.isSuccess
                ? `No buildings matched "${query}".`
                : "No buildings available yet."}
            </p>
          ) : (
            buildingResults.map((building) => (
              <button
                key={building.id}
                type="button"
                onClick={() => setDestination("building", building.id, building.name)}
                className={cn(
                  "flex w-full flex-col items-start rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                  destinationType === "building" && destinationId === building.id
                    ? "border-brand bg-brand/5"
                    : "border-hairline hover:border-brand/30",
                )}
              >
                <span className="font-medium text-ink">{building.name}</span>
                {building.code && <span className="text-xs text-muted">{building.code}</span>}
              </button>
            ))
          ))}
      </div>
    </div>
  );
}
