import { PageContainer, SectionTitle } from "@/components/ui";
import {
  AutocompleteSearch,
  CampusSidebar,
  CurrentLocationSelect,
  FloorMapPlaceholder,
  RoomDetailsPanel,
  TopBar,
  TurnByTurnPanel,
} from "@/features/navigation";

export default function NavigationPage() {
  return (
    <PageContainer>
      <SectionTitle
        eyebrow="Get There"
        title="Indoor Navigation"
        align="left"
        subtitle="Search for a room, browse the campus tree, and get a step-by-step wheelchair-aware route."
        className="mx-0"
      />

      <div className="space-y-6">
        <TopBar />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-3">
            <div className="rounded-3xl border border-hairline bg-white p-4 shadow-soft">
              <AutocompleteSearch />
              <div className="mt-4">
                <CurrentLocationSelect />
              </div>
            </div>
            <CampusSidebar />
          </div>

          <div className="lg:col-span-6">
            <FloorMapPlaceholder />
          </div>

          <div className="lg:col-span-3">
            <RoomDetailsPanel />
          </div>
        </div>

        <TurnByTurnPanel />
      </div>
    </PageContainer>
  );
}
