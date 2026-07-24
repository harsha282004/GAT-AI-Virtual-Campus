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
            <h3 className="font-display text-xl font-semibold text-ink">{building.name}</h3>
            {building.description && (
              <p className="mt-1 text-sm text-muted">{building.description}</p>
            )}
          </div>
          {building.code && (
            <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              {building.code}
            </span>
          )}
        </div>

        {sortedFloors.length === 0 ? (
          <p className="text-sm text-muted">No floor data available for this building yet.</p>
        ) : (
          <div className="space-y-5">
            {sortedFloors.map((floor) => {
              const floorRooms = rooms.filter((room) => room.floor_id === floor.id);
              return (
                <div key={floor.id} className="rounded-2xl border border-hairline p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                    <Layers className="h-4 w-4 text-brand" />
                    {floor.name}
                  </div>
                  {floorRooms.length === 0 ? (
                    <p className="pl-6 text-xs text-muted">No rooms recorded on this floor yet.</p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2">
                      {floorRooms.map((room) => (
                        <li
                          key={room.id}
                          className="flex items-center justify-between rounded-lg bg-brand/5 px-3 py-2 text-xs text-ink/80"
                        >
                          <span className="flex items-center gap-1.5">
                            <DoorOpen className="h-3.5 w-3.5 text-muted" />
                            {room.name}
                            {room.room_number && (
                              <span className="text-muted">({room.room_number})</span>
                            )}
                          </span>
                          {room.capacity && (
                            <span className="flex items-center gap-1 text-muted">
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
