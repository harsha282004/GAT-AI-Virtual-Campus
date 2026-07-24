import { create } from "zustand";

import type { RoomMatch, RouteResponse, RouteStep } from "@/types";

export type DestinationType = "room" | "building" | null;

interface NavigationState {
  // Current node
  fromNodeId: number | null;
  fromNodeLabel: string | null;

  // Destination
  destinationType: DestinationType;
  destinationId: number | null;
  destinationLabel: string | null;

  // A lighter-weight "peek" selection for the room details panel — set when
  // browsing/searching, independent of committing to it as the destination.
  selectedRoom: RoomMatch | null;

  // Route + derived fields
  route: RouteResponse | null;
  instructions: RouteStep[];
  distance: number | null;
  etaMinutes: number | null;
  isRouting: boolean;

  // Accessibility
  wheelchairMode: boolean;

  setCurrentLocation: (nodeId: number, label: string) => void;
  setDestination: (type: DestinationType, id: number | null, label: string | null) => void;
  setSelectedRoom: (room: RoomMatch | null) => void;
  setRoute: (route: RouteResponse | null) => void;
  setIsRouting: (value: boolean) => void;
  toggleWheelchairMode: () => void;
  reset: () => void;
}

const initialState = {
  fromNodeId: null,
  fromNodeLabel: null,
  destinationType: null as DestinationType,
  destinationId: null,
  destinationLabel: null,
  selectedRoom: null as RoomMatch | null,
  route: null,
  instructions: [] as RouteStep[],
  distance: null,
  etaMinutes: null,
  isRouting: false,
  wheelchairMode: false,
};

export const useNavigationStore = create<NavigationState>()((set) => ({
  ...initialState,

  setCurrentLocation: (nodeId, label) => set({ fromNodeId: nodeId, fromNodeLabel: label }),

  setDestination: (type, id, label) =>
    set({
      destinationType: type,
      destinationId: id,
      destinationLabel: label,
      route: null,
      instructions: [],
      distance: null,
      etaMinutes: null,
    }),

  setSelectedRoom: (room) => set({ selectedRoom: room }),

  setRoute: (route) =>
    set({
      route,
      instructions: route?.turn_by_turn ?? [],
      distance: route?.total_distance ?? null,
      etaMinutes: route?.estimated_walk_time_minutes ?? null,
    }),

  setIsRouting: (value) => set({ isRouting: value }),

  toggleWheelchairMode: () => set((state) => ({ wheelchairMode: !state.wheelchairMode })),

  reset: () => set(initialState),
}));
