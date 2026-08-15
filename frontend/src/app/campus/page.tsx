import { PageContainer, SectionTitle } from "@/components/ui";
import { CampusGallery } from "@/features/campus";

export default function CampusPage() {
  return (
    <PageContainer>
      <SectionTitle
        eyebrow="Campus Experience"
        title="Explore the GAT Campus"
        subtitle="Discover the spaces, facilities, learning environments, and architectural highlights that make Global Academy of Technology a vibrant campus for learning and innovation."
      />

      <CampusGallery />
    </PageContainer>
  );
}
