"use client";

import { motion } from "framer-motion";
import { DoorOpen, Layers, Users } from "lucide-react";

import { Card } from "@/components/ui";
import type { Building, Floor, Room } from "@/types";

interface BuildingDetailProps {
  building: Building;
  floors: Floor[];
  rooms: Room[];
}

export function BuildingDetail({ building, floors, rooms }: BuildingDetailProps) {
  const sortedFloors = [...floors].sort((a, b) => a.level - b.level);

  return (
    <motion.div
      key={building.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-gat-navy dark:text-white">
              {building.name}
            </h3>
            {building.description && (
              <p className="mt-1 text-sm text-gat-navy/60 dark:text-white/60">
                {building.description}
              </p>
            )}
          </div>
          {building.code && (
            <span className="shrink-0 rounded-full bg-gat-gold/15 px-3 py-1 text-xs font-semibold text-gat-gold-dark">
              {building.code}
            </span>
          )}
        </div>

        {sortedFloors.length === 0 ? (
          <p className="text-sm text-gat-navy/50 dark:text-white/50">
            No floor data available for this building yet.
          </p>
        ) : (
          <div className="space-y-5">
            {sortedFloors.map((floor) => {
              const floorRooms = rooms.filter((room) => room.floor_id === floor.id);
              return (
                <div
                  key={floor.id}
                  className="rounded-xl border border-gat-navy/10 p-4 dark:border-white/10"
                >
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gat-navy dark:text-white">
                    <Layers className="h-4 w-4 text-gat-maroon" />
                    {floor.name}
                  </div>
                  {floorRooms.length === 0 ? (
                    <p className="pl-6 text-xs text-gat-navy/50 dark:text-white/50">
                      No rooms recorded on this floor yet.
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2">
                      {floorRooms.map((room) => (
                        <li
                          key={room.id}
                          className="flex items-center justify-between rounded-lg bg-gat-navy/5 px-3 py-2 text-xs text-gat-navy/80 dark:bg-white/5 dark:text-white/80"
                        >
                          <span className="flex items-center gap-1.5">
                            <DoorOpen className="h-3.5 w-3.5 text-gat-navy/40 dark:text-white/40" />
                            {room.name}
                            {room.room_number && (
                              <span className="text-gat-navy/40 dark:text-white/40">
                                ({room.room_number})
                              </span>
                            )}
                          </span>
                          {room.capacity && (
                            <span className="flex items-center gap-1 text-gat-navy/50 dark:text-white/50">
                              <Users className="h-3 w-3" />
                              {room.capacity}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
