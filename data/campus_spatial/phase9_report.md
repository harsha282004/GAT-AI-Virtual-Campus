# Phase 9 Report — Scope Revision + Panorama Spatial Knowledge

See the chat response delivered alongside this file for the full 50-item
report required by the operator's instructions. This file is the persisted,
on-disk copy of that same report for future reference.

## Summary

1. Removed the old indoor source-to-destination routing feature (A*
   point-to-point navigation, turn-by-turn generation, "Navigate to Room X")
   from the frontend, the backend REST API, and the AI chat pipeline.
2. Preserved, untouched: the Virtual Tour / 360° panorama viewer, the 3D
   Campus Map, the RAG pipeline (ChromaDB/BM25/reranker/Ollama/supervisor/
   agents), PostgreSQL data, and the underlying `backend/app/navigation/`
   graph/pathfinding library (kept intact because `resolve_location()` and
   `panorama_lookup()` still depend on parts of it — only the routing
   *entry points* were removed, not the shared library).
3. Built `data/campus_spatial/*.json` — a panorama inventory (178 primary
   panoramas, all accounted for with an explicit status), plus spatial and
   semantic/RAG-ready datasets built from real evidence only: existing
   project metadata (`panoramas.json`, `manifest.json`, PostgreSQL) and 18
   `main-building` panoramas actually visually reviewed this session, 6 of
   which yielded legible room/department/lab signage.
4. Confirmed rooms 202, 203 (plus 203A), 302 found with high-confidence
   evidence; rooms 201, 301, 303 are UNCERTAIN (not yet reviewed — most of
   the 156-panorama main-building set remains PENDING), not confirmed
   absent.
5. No routing, A*, coordinates, or navigation graph were created for the
   new spatial dataset, per the explicit "no coordinates / no routing"
   instruction.
6. No RAG re-indexing, no PostgreSQL writes, no Git history rewrite, no
   commit.

See `processing_manifest.json` for exact counts and `panorama_quality_report.md`
for image-quality notes, including one pre-existing (not Phase-9-caused)
data-integrity gap found: 5 `PostgreSQL.panoramas` rows reference image files
that don't exist on disk under that filename.
