"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, DoorOpen, Landmark, Layers } from "lucide-react";
import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui";
import { useBuildings, useFloors, useRooms } from "@/hooks";
import { useNavigationStore } from "@/store";
import { cn } from "@/utils";
import type { Building, Floor, Room, RoomMatch } from "@/types";

function toRoomMatch(room: Room, floor: Floor, building: Building): RoomMatch {
  return {
    id: room.id,
    name: room.name,
    room_number: room.room_number,
    room_type: room.room_type,
    department: room.department,
    floor_id: floor.id,
    floor_name: floor.name,
    building_id: building.id,
    building_name: building.name,
    node_id: room.node_id,
  };
}

export function CampusSidebar() {
  const buildings = useBuildings();
  const floors = useFloors();
  const rooms = useRooms();

  const selectedRoom = useNavigationStore((state) => state.selectedRoom);
  const setSelectedRoom = useNavigationStore((state) => state.setSelectedRoom);

  const [openBuilding, setOpenBuilding] = useState<number | null>(null);
  const [openFloor, setOpenFloor] = useState<number | null>(null);

  const isLoading = buildings.isLoading || floors.isLoading || rooms.isLoading;

  const tree = useMemo(() => {
    const map = new Map<number, Map<number, Room[]>>();
    for (const room of rooms.data ?? []) {
      const floor = floors.data?.find((f) => f.id === room.floor_id);
      if (!floor) continue;
      if (!map.has(floor.building_id)) map.set(floor.building_id, new Map());
      const floorMap = map.get(floor.building_id) as Map<number, Room[]>;
      if (!floorMap.has(floor.id)) floorMap.set(floor.id, []);
      floorMap.get(floor.id)?.push(room);
    }
    return map;
  }, [rooms.data, floors.data]);

  if (isLoading) {
    return (
      <aside className="flex h-full w-full flex-col gap-3 overflow-y-auto rounded-3xl border border-hairline bg-white p-5 shadow-soft dark:bg-[#0F172A] dark:shadow-black/30 lg:w-72">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto rounded-3xl border border-hairline bg-white p-5 shadow-soft dark:bg-[#0F172A] dark:shadow-black/30 lg:w-72">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Landmark className="h-3.5 w-3.5" />
        Global Academy of Technology
      </h2>

      <div className="space-y-1.5">
        {(buildings.data ?? []).map((building) => {
          const floorMap = tree.get(building.id) ?? new Map<number, Room[]>();
          const isBuildingOpen = openBuilding === building.id;

          return (
            <div key={building.id}>
              <button
                type="button"
                onClick={() => setOpenBuilding(isBuildingOpen ? null : building.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  isBuildingOpen ? "bg-brand/10 text-brand" : "text-ink hover:bg-brand/5",
                )}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {building.name}
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", isBuildingOpen && "rotate-180")}
                />
              </button>

              <AnimatePresence initial={false}>
                {isBuildingOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pl-3"
                  >
                    {(floors.data ?? [])
                      .filter((f) => f.building_id === building.id)
                      .sort((a, b) => a.level - b.level)
                      .map((floor) => {
                        const isFloorOpen = openFloor === floor.id;
                        const floorRooms = floorMap.get(floor.id) ?? [];
                        return (
                          <div key={floor.id} className="mt-1">
                            <button
                              type="button"
                              onClick={() => setOpenFloor(isFloorOpen ? null : floor.id)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                                isFloorOpen ? "text-brand" : "text-muted hover:text-ink",
                              )}
                            >
                              <span className="flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5" />
                                {floor.name}
                              </span>
                              <ChevronDown
                                className={cn(
                                  "h-3.5 w-3.5 transition-transform",
                                  isFloorOpen && "rotate-180",
                                )}
                              />
                            </button>

                            <AnimatePresence initial={false}>
                              {isFloorOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden pl-4"
                                >
                                  {floorRooms.length === 0 ? (
                                    <p className="px-3 py-2 text-xs text-muted">No rooms yet.</p>
                                  ) : (
                                    floorRooms.map((room) => (
                                      <button
                                        key={room.id}
                                        type="button"
                                        onClick={() =>
                                          setSelectedRoom(toRoomMatch(room, floor, building))
                                        }
                                        className={cn(
                                          "flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                                          selectedRoom?.id === room.id
                                            ? "bg-brand text-white"
                                            : "text-ink/70 hover:bg-brand/5",
                                        )}
                                      >
                                        <DoorOpen className="h-3 w-3 shrink-0" />
                                        {room.name}
                                      </button>
                                    ))
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
