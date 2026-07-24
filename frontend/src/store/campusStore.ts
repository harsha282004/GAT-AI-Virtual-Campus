import { create } from "zustand";

interface CampusState {
  selectedBuildingId: number | null;
  setSelectedBuildingId: (id: number | null) => void;
}

export const useCampusStore = create<CampusState>()((set) => ({
  selectedBuildingId: null,
  setSelectedBuildingId: (id) => set({ selectedBuildingId: id }),
}));
