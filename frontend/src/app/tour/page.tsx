import { PageContainer, SectionTitle } from "@/components/ui";
import { PanoramaGrid, PanoramaPlaceholder } from "@/features/tour";

export default function TourPage() {
  return (
    <PageContainer>
      <SectionTitle
        eyebrow="360° Experience"
        title="Virtual Tour"
        align="left"
        subtitle="Real Insta360 panoramas will drop into this viewer without any code changes — open a card below to reserve it."
        className="mx-0"
      />

      <PanoramaPlaceholder />

      <div className="mt-10">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gat-navy/60 dark:text-white/60">
          Available Panoramas
        </p>
        <PanoramaGrid />
      </div>
    </PageContainer>
  );
}
