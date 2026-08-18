"use client";

import { PageContainer, SectionTitle } from "@/components/ui";
import { CampusGallery } from "@/features/campus";
import { useTranslation } from "@/hooks/useTranslation";

export default function CampusPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <SectionTitle
        eyebrow={t("Campus Experience")}
        title={t("Explore the GAT Campus")}
        subtitle={t(
          "Discover the spaces, facilities, learning environments, and architectural highlights that make Global Academy of Technology a vibrant campus for learning and innovation.",
        )}
      />

      <CampusGallery />
    </PageContainer>
  );
}
