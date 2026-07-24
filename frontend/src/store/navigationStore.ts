import { create } from "zustand";

import type { RouteResponse } from "@/types";

export type DestinationType = "room" | "building" | null;

interface NavigationState {
  fromNodeId: number | null;
  fromNodeLabel: string | null;
  destinationType: DestinationType;
  destinationId: number | null;
  destinationLabel: string | null;
  route: RouteResponse | null;
  isRouting: boolean;

  setCurrentLocation: (nodeId: number, label: string) => void;
  setDestination: (type: DestinationType, id: number | null, label: string | null) => void;
  setRoute: (route: RouteResponse | null) => void;
  setIsRouting: (value: boolean) => void;
  reset: () => void;
}

const initialState = {
  fromNodeId: null,
  fromNodeLabel: null,
  destinationType: null as DestinationType,
  destinationId: null,
  destinationLabel: null,
  route: null,
  isRouting: false,
};

export const useNavigationStore = create<NavigationState>()((set) => ({
  ...initialState,

  setCurrentLocation: (nodeId, label) =>
    set({ fromNodeId: nodeId, fromNodeLabel: label }),

  setDestination: (type, id, label) =>
    set({ destinationType: type, destinationId: id, destinationLabel: label, route: null }),

  setRoute: (route) => set({ route }),

  setIsRouting: (value) => set({ isRouting: value }),

  reset: () => set(initialState),
}));
