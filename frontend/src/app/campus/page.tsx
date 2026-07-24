"use client";

import { BookOpen } from "lucide-react";

import { ErrorState, PageContainer, SectionTitle, Skeleton, SkeletonCard } from "@/components/ui";
import { BuildingCard } from "@/features/campus";
import { useBuildings, useDocuments, useFloors } from "@/hooks";

const DOMAIN_LABELS: Record<string, string> = {
  admissions: "Admissions",
  academics: "Academics",
  facilities: "Facilities",
  navigation: "Navigation",
  general: "General",
};

export default function CampusPage() {
  const { data: buildings, isLoading, isError, refetch } = useBuildings();
  const { data: floors = [] } = useFloors();
  const {
    data: documents,
    isLoading: documentsLoading,
    isError: documentsError,
    refetch: refetchDocuments,
  } = useDocuments();

  return (
    <PageContainer>
      <SectionTitle
        eyebrow="Campus Overview"
        title="Buildings across GAT"
        align="left"
        subtitle="Live data straight from the campus backend — select a building to see its floors, rooms, and panoramas."
        className="mx-0"
      />

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState
          title="Couldn't load campus buildings"
          message="Make sure the backend is running at the configured API base URL."
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && buildings && buildings.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {buildings.map((building, index) => (
            <BuildingCard
              key={building.id}
              building={building}
              index={index}
              floorCount={floors.filter((f) => f.building_id === building.id).length}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && buildings && buildings.length === 0 && (
        <p className="text-sm text-muted">No buildings have been added to the campus yet.</p>
      )}

      <div className="mt-20">
        <h2 className="mb-6 flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <BookOpen className="h-5 w-5 text-brand" />
          Campus Information
        </h2>

        {documentsLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {documentsError && !documentsLoading && (
          <ErrorState
            title="Couldn't load campus information"
            message="Documents could not be retrieved from the backend."
            onRetry={() => refetchDocuments()}
          />
        )}

        {!documentsLoading && !documentsError && documents && documents.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {documents.map((doc) => (
              <div key={doc.id} className="rounded-3xl border border-hairline bg-white p-6 shadow-soft">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-semibold text-ink">{doc.title}</p>
                  <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
                    {DOMAIN_LABELS[doc.domain] ?? doc.domain}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted">{doc.content}</p>
              </div>
            ))}
          </div>
        )}

        {!documentsLoading && !documentsError && documents && documents.length === 0 && (
          <p className="text-sm text-muted">No campus information has been published yet.</p>
        )}
      </div>
    </PageContainer>
  );
}
