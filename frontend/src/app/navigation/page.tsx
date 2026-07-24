import { PageContainer, SectionTitle } from "@/components/ui";
import {
  CurrentLocationSelect,
  DestinationSearch,
  RouteResultPanel,
  SelectedDestination,
} from "@/features/navigation";

export default function NavigationPage() {
  return (
    <PageContainer>
      <SectionTitle
        eyebrow="Get There"
        title="Indoor Navigation"
        align="left"
        subtitle="Search for a room or building, set your starting point, and get the shortest walking route with turn-by-turn directions."
        className="mx-0"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 rounded-2xl border border-gat-navy/10 bg-white p-6 dark:border-white/10 dark:bg-gat-navy-light lg:col-span-2">
          <DestinationSearch />
          <SelectedDestination />
          <CurrentLocationSelect />
        </div>

        <div className="lg:col-span-3">
          <RouteResultPanel />
        </div>
      </div>
    </PageContainer>
  );
}
