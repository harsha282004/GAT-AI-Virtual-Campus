"use client";

import { motion } from "framer-motion";
import {
  Building2,
  Camera,
  Hash,
  Layers,
  MapPin,
  Navigation as NavigationIcon,
  Users,
  X,
} from "lucide-react";

import { Button, Spinner } from "@/components/ui";
import { useNearestPanorama } from "@/hooks";
import { useNavigationStore } from "@/store";
import { formatDistance } from "@/utils";

export function RoomDetailsPanel() {
  const selectedRoom = useNavigationStore((state) => state.selectedRoom);
  const setSelectedRoom = useNavigationStore((state) => state.setSelectedRoom);
  const setDestination = useNavigationStore((state) => state.setDestination);
  const fromNodeId = useNavigationStore((state) => state.fromNodeId);

  const { data: nearestPanorama, isLoading: panoramaLoading } = useNearestPanorama(
    selectedRoom?.node_id ?? null,
  );

  if (!selectedRoom) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-hairline p-8 text-center">
        <MapPin className="h-6 w-6 text-brand/25" />
        <p className="text-sm text-muted">
          Search or browse the sidebar to see room details here.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      key={selectedRoom.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex h-full flex-col rounded-3xl border border-hairline bg-white p-6 shadow-soft dark:bg-[#0F172A] dark:shadow-black/30"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold text-ink">{selectedRoom.name}</p>
          {selectedRoom.room_number && (
            <p className="text-xs text-muted">Room {selectedRoom.room_number}</p>
          )}
        </div>
        <button
          type="button"
          aria-label="Close room details"
          onClick={() => setSelectedRoom(null)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand/5 hover:text-brand"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="mb-5 space-y-2.5 text-sm">
        <div className="flex items-center gap-2 text-ink/80">
          <Building2 className="h-4 w-4 shrink-0 text-brand" />
          {selectedRoom.building_name}
        </div>
        <div className="flex items-center gap-2 text-ink/80">
          <Layers className="h-4 w-4 shrink-0 text-brand" />
          {selectedRoom.floor_name}
        </div>
        {selectedRoom.department && (
          <div className="flex items-center gap-2 text-ink/80">
            <Users className="h-4 w-4 shrink-0 text-brand" />
            {selectedRoom.department}
          </div>
        )}
        {selectedRoom.node_id && (
          <div className="flex items-center gap-2 text-ink/80">
            <Hash className="h-4 w-4 shrink-0 text-brand" />
            Nearest node: #{selectedRoom.node_id}
          </div>
        )}
      </dl>

      <div className="mb-5 rounded-2xl bg-brand/5 p-3.5 text-xs text-muted">
        {panoramaLoading && <Spinner size="sm" label="Locating nearest panorama…" />}
        {!panoramaLoading && nearestPanorama?.panorama_title && (
          <p className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5 shrink-0 text-brand" />
            Nearest panorama: {nearestPanorama.panorama_title}
            {nearestPanorama.distance !== null && nearestPanorama.distance > 0 && (
              <span>({formatDistance(nearestPanorama.distance)} away)</span>
            )}
          </p>
        )}
        {!panoramaLoading && !nearestPanorama?.panorama_title && (
          <p>No panorama captured near this room yet.</p>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        <Button
          variant="primary"
          fullWidth
          disabled={!fromNodeId || !selectedRoom.node_id}
          icon={<NavigationIcon className="h-4 w-4" />}
          onClick={() =>
            setDestination(
              "room",
              selectedRoom.id,
              `${selectedRoom.name} — ${selectedRoom.building_name}`,
            )
          }
        >
          Navigate Here
        </Button>

        {nearestPanorama?.panorama_title && (
          <Button href="/tour" variant="outline" fullWidth icon={<Camera className="h-4 w-4" />}>
            Open 360° View
          </Button>
        )}

        {!fromNodeId && (
          <p className="text-center text-[11px] text-muted">
            Set a current location above to enable navigation.
          </p>
        )}
      </div>
    </motion.div>
  );
}
