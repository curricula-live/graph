# graph

Standalone, **read-only**, interactive ontology explorer for Curricula.live.

## Status

Deployed MVP in [`curricula-live/graph`](https://github.com/curricula-live/graph). The read-only V1 graph projection is **bundled as a pinned static artifact** in `public/graph.json` so Vercel can serve the complete concept graph without database credentials or access to the private ontology repository. This bundle is explicitly for public visualization, not independent scientific certification.

- React + TypeScript + Vite
- Sigma.js 4 (WebGL) + Graphology (multi-directed graph)
- Hierarchical module -> kind -> alphabetical batch -> individual concepts; real clickable clusters and a direct concept inspector
- Global overview aggregates source assertions between module clusters (not new asserted ontology facts)
- Search in English, Romanian, and aliases
- Type/module/predicate filters, recorded review status filter
- 1–3 hop neighborhood exploration with hard UI performance limits of 200 concept nodes / 900 edges
- Source data stays complete, even though WebGL only renders the current cluster, not the full corpus simultaneously
- Immutable V1 adapter; future V2 federation adapter is a separate task

## Source boundaries

The [`curricula-live/ontology`](https://github.com/curricula-live/ontology) repository holds the authoritative archived V1 data and under-construction V2 federation. `graph` does not author or publish ontology relations, does not modify the ontology, and is not part of `admin`.

The V1 dataset is **provisional**: the existence of a recorded assertion does not imply peer review, verified prerequisite status, or scientific certification. The projection preserves original predicates, claim statuses and recorded review dispositions. The `inDefaultRdfGraph` flag reproduces the V1 RDF export inclusion rule; it is **not** a certification flag. In particular, **`uses` is not a prerequisite relationship**.

## Run locally

Requires Node.js >= 22.12, Python 3.10+, and access to the *actual* `ontology-consolidated.json` from the V1 repository.

```bash
# First, create/clone your graph repo.
git clone https://github.com/curricula-live/ontology.git ../ontology

# In this graph directory, build a read-only browser projection from V1:
python3 tools/project_v1.py \
  --input ../ontology/ontology-consolidated.json \
  --output public/graph.json

# Install and serve
npm install
npm run dev
```

The committed `public/graph.json` is the pinned static V1 graph. The app requests it using `GET /graph.json`; Vercel's Vite preset copies `public/` assets into `dist/`. If the file is absent, the app shows an honest no-data state instead of inventing nodes. Running `npm run project:v1` locally regenerates the artifact from the archived V1 checkout; any updates to the pinned public snapshot must be reviewed and committed explicitly.

Run the adapter regression tests:

```bash
python3 -m unittest discover -s tests -v
```

Build frontend:

```bash
npm run build
```

**Data provenance:** input `ontology-consolidated.json` from archived V1, SHA-256 `4e6ff79570b68de6a6d1d1d4136dcb413e26b999af05fa0ea19cb329ab50df58`; 8,759 entity nodes, 31,533 entity-to-entity assertions, 9 literal-valued assertions excluded. The project does not copy the full raw ontology or its RDF structural triples. The published projection contains only labels, modules, statuses, source URIs, and relation identifiers. No pipeline auto-publishes new source material from the ontology repository.

**Release gate:** `npm run build` copies the checked-in `public/graph.json` into `dist/`. The static projection is accessible to anyone who can access the deployed Vercel site, regardless of GitHub repository visibility. Its scientific status remains provisional and unreviewed.

## Files

```text
graph/
├── src/
│   ├── main.tsx          # Search, filters, inspector, language toggle
│   ├── GraphCanvas.tsx   # Sigma WebGL, interactions, camera
│   ├── graph.ts          # Graphology projection, deterministic module layout
│   ├── types.ts          # Explicit read-only data contract
│   └── styles.css        # Responsive graph atlas interface
├── tools/
│   └── project_v1.py    # Explicit V1 -> graph.json transformation
├── tests/
│   └── test_projection.py
├── public/graph.json     # Explicitly reviewed, committed static V1 projection
└── package.json
```

## Limitations / next milestones

1. Global layout clusters by the V1 source `module` field; its second tier uses recorded concept `kind` and its third tier uses alphabetical batches. These are navigational partitions, not discovered scientific communities or learned semantic similarity. Cluster-to-cluster links are aggregated counts of actual V1 assertions, and the 220 most frequent aggregate links are rendered for responsiveness.
2. Only *entity-to-entity assertions* are visualized; literal assertions and RDF reification/formal expression nodes are intentionally excluded from the concept overview. Full RDF drilldown requires a separate mode.
3. 31,542 V1 active assertions is an archival reported metric, not the actual displayable edge count; the adapter reports exact concept-edge counts after projection.
4. Build per-node adjacency indexes and server-side neighborhood endpoints for imported V2 graphs that exceed in-browser practical limits.
5. V2 source snapshots must be admitted with upstream checksums, provenance, licensing and declared review status. V2 is presently EMPTY of admitted upstream snapshots; synthetic fixtures never stand in for real data.
6. Implement actual accessible keyboard navigation and expand UI regression tests; browser interaction has not yet been run in this environment.
7. The bounded hierarchical overview and basic Chromium interaction smoke test work with the complete archived V1 projection. More extensive performance testing on phones, low-end GPUs and accessibility testing is still required.
8. Add read-only graph API (`GET /sources`, `GET /graph/overview`, `GET /nodes/:id`, `GET /nodes/:id/neighbors`) when persistent source data is deployed.

## Proposed deployment

Subdomain: `graph.curricula.live`, separate from `admin.curricula.live`. A static host can serve this first MVP; no database or authentication is needed for an explicitly authorized public dataset.