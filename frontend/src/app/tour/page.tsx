"use client";

import { useRef, useState } from "react";

import { ErrorState, PageContainer, Spinner } from "@/components/ui";
import {
  MinimapPlaceholder,
  PanoramaViewer,
  TourControls,
  TourSidebar,
  TourTopBar,
} from "@/features/tour";
import type { PanoramaViewerHandle } from "@/features/tour";
import { useTourPanoramas } from "@/hooks";
import type { TourPanorama } from "@/types";

const START_PANORAMA_ID = "main-gate";

export default function TourPage() {
  const { data: panoramas, isLoading, isError, refetch } = useTourPanoramas();
  const [currentId, setCurrentId] = useState(START_PANORAMA_ID);
  const viewerRef = useRef<PanoramaViewerHandle>(null);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" label="Loading virtual tour…" />
      </div>
    );
  }

  if (isError || !panoramas) {
    return (
      <PageContainer>
        <ErrorState
          title="Couldn't load the virtual tour"
          message="The panorama metadata could not be loaded."
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  // Re-bound with an explicit (non-union) type so the closures below — which
  // TypeScript can't narrow `panoramas` inside, since it's captured from a
  // union-typed outer binding — see a plain, always-defined array.
  const allPanoramas: TourPanorama[] = panoramas;

  const currentIndex = allPanoramas.findIndex((p) => p.id === currentId);
  const current = allPanoramas[currentIndex] ?? allPanoramas[0];

  function goTo(id: string) {
    if (allPanoramas.some((p) => p.id === id)) setCurrentId(id);
  }

  function goToOffset(offset: number) {
    const nextIndex = (currentIndex + offset + allPanoramas.length) % allPanoramas.length;
    setCurrentId(allPanoramas[nextIndex].id);
  }

  return (
    <div className="flex h-screen flex-col gap-4 px-4 pb-4 pt-24 sm:px-6 lg:flex-row lg:px-8">
      <TourSidebar panoramas={allPanoramas} currentId={current.id} onSelect={goTo} />

      <div className="relative min-h-[50vh] flex-1">
        <PanoramaViewer
          ref={viewerRef}
          panorama={current}
          onHotspotClick={goTo}
          className="h-full w-full"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <div className="pointer-events-auto">
            <TourTopBar panorama={current} />
          </div>
          <div className="pointer-events-auto hidden sm:block">
            <MinimapPlaceholder panorama={current} />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="pointer-events-auto">
            <TourControls
              onNext={() => goToOffset(1)}
              onPrevious={() => goToOffset(-1)}
              onReset={() => viewerRef.current?.resetView()}
              onFullscreen={() => viewerRef.current?.toggleFullscreen()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
