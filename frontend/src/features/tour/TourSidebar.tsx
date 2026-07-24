"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, DoorOpen, Layers } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/utils";
import type { TourPanorama } from "@/types";

interface TourSidebarProps {
  panoramas: TourPanorama[];
  currentId: string;
  onSelect: (id: string) => void;
}

type BuildingTree = Map<string, Map<string, TourPanorama[]>>;

function groupByBuildingAndFloor(panoramas: TourPanorama[]): BuildingTree {
  const tree: BuildingTree = new Map();
  for (const panorama of panoramas) {
    if (!panorama.room) continue;
    if (!tree.has(panorama.building)) tree.set(panorama.building, new Map());
    const floors = tree.get(panorama.building) as Map<string, TourPanorama[]>;
    if (!floors.has(panorama.floor)) floors.set(panorama.floor, []);
    floors.get(panorama.floor)?.push(panorama);
  }
  return tree;
}

export function TourSidebar({ panoramas, currentId, onSelect }: TourSidebarProps) {
  const tree = useMemo(() => groupByBuildingAndFloor(panoramas), [panoramas]);
  const current = panoramas.find((p) => p.id === currentId);

  const [openBuilding, setOpenBuilding] = useState<string | null>(current?.building ?? null);
  const [openFloor, setOpenFloor] = useState<string | null>(current?.floor ?? null);

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto rounded-3xl border border-hairline bg-white p-5 shadow-soft lg:w-72">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Building2 className="h-3.5 w-3.5" />
        Buildings
      </h2>

      <div className="space-y-1.5">
        {Array.from(tree.entries()).map(([building, floors]) => {
          const isBuildingOpen = openBuilding === building;
          return (
            <div key={building}>
              <button
                type="button"
                onClick={() => setOpenBuilding(isBuildingOpen ? null : building)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  isBuildingOpen ? "bg-brand/10 text-brand" : "text-ink hover:bg-brand/5",
                )}
              >
                {building}
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
                    {Array.from(floors.entries()).map(([floor, rooms]) => {
                      const isFloorOpen = openFloor === floor;
                      return (
                        <div key={floor} className="mt-1">
                          <button
                            type="button"
                            onClick={() => setOpenFloor(isFloorOpen ? null : floor)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                              isFloorOpen ? "text-brand" : "text-muted hover:text-ink",
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5" />
                              {floor}
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
                                {rooms.map((room) => (
                                  <button
                                    key={room.id}
                                    type="button"
                                    onClick={() => onSelect(room.id)}
                                    className={cn(
                                      "flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                                      currentId === room.id
                                        ? "bg-brand text-white"
                                        : "text-ink/70 hover:bg-brand/5",
                                    )}
                                  >
                                    <DoorOpen className="h-3 w-3 shrink-0" />
                                    {room.room}
                                  </button>
                                ))}
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
