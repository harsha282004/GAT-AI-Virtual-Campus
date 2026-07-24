import { BuildingNodeSidebar, Map3DPlaceholder } from "@/features/map3d";

export default function MapPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-24 sm:px-6 lg:flex-row lg:px-8">
      <BuildingNodeSidebar />
      <Map3DPlaceholder />
    </div>
  );
}
