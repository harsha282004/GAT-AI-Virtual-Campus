"use client";

import { ArrowRight, Layers, MapPin, Navigation2, X } from "lucide-react";

import { Button, Card } from "@/components/ui";

import type { BuildingPlacement } from "./campusLayout";

interface BuildingInfoPanelProps {
  placement: BuildingPlacement;
  nodeCount: number;
  onClose: () => void;
}

/** The selected-building card (Section 13). Every field is either real
 * project data (name/code/description from Building, floor count from
 * Floor rows, node count from Node rows) or an explicitly-labeled
 * placeholder/limitation — nothing here is invented. "Get Directions" is
 * the documented future integration point with the existing
 * backend/app/navigation/ engine (Section 18/19) — deliberately disabled
 * rather than wired to fabricated route data. */
export function BuildingInfoPanel({ placement, nodeCount, onClose }: BuildingInfoPanelProps) {
  const { building, floorCount, isPositionVerified } = placement;

  return (
    <Card className="w-full lg:w-80">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">{building.name}</h3>
          {building.code && (
            <span className="mt-1 inline-block rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
              {building.code}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close building info"
          className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-brand/5 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {building.description && (
        <p className="mb-4 text-sm leading-relaxed text-muted">{building.description}</p>
      )}

      <dl className="mb-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-brand/5 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <Layers className="h-3.5 w-3.5" />
            Floors
          </dt>
          <dd className="mt-1 font-semibold text-ink">
            {floorCount > 0 ? floorCount : "Not recorded"}
          </dd>
        </div>
        <div className="rounded-xl bg-brand/5 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <MapPin className="h-3.5 w-3.5" />
            Mapped points
          </dt>
          <dd className="mt-1 font-semibold text-ink">{nodeCount}</dd>
        </div>
      </dl>

      {!isPositionVerified && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          Development placeholder position — no surveyed coordinate is recorded for this building
          yet, so it is shown in a temporary layout slot.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          href={`/campus/${building.id}`}
          variant="primary"
          size="sm"
          icon={<ArrowRight className="h-4 w-4" />}
          iconPosition="right"
        >
          View Building
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={<Navigation2 className="h-4 w-4" />}
          disabled
          title="Indoor turn-by-turn navigation is planned for a future phase — this is the reserved integration point for the existing backend navigation engine."
        >
          Get Directions (coming soon)
        </Button>
      </div>
    </Card>
  );
}
