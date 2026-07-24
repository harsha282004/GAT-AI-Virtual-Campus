import { create } from "zustand";

interface TourState {
  currentNodeId: number | null;
  currentLocationName: string | null;
  /** Populated once /api/navigate drives a guided walk — reserved for a future phase. */
  guidedPathNodeIds: number[] | null;

  setLocation: (nodeId: number, name: string) => void;
  setGuidedPath: (nodeIds: number[] | null) => void;
  reset: () => void;
}

export const useTourStore = create<TourState>()((set) => ({
  currentNodeId: null,
  currentLocationName: null,
  guidedPathNodeIds: null,

  setLocation: (nodeId, name) => set({ currentNodeId: nodeId, currentLocationName: name }),
  setGuidedPath: (nodeIds) => set({ guidedPathNodeIds: nodeIds }),
  reset: () => set({ currentNodeId: null, currentLocationName: null, guidedPathNodeIds: null }),
}));
