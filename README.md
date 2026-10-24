# graph

Standalone, **read-only**, interactive ontology explorer for Curricula.live.

## Status

MVP source scaffold in [`curricula-live/graph`](https://github.com/curricula-live/graph). The graph data is **not bundled** because it must be projected explicitly from the owner's local ontology checkout. This also prevents archived V1 information from being accidentally checked into a public repository.

- React + TypeScript + Vite
- Sigma.js 4 (WebGL) + Graphology (multi-directed graph)
- Global concept graph, pan/zoom, node selection and inspector
- Search in English, Romanian, and aliases
- Type/module/predicate filters, recorded review status filter
- 1–3 hop neighborhood exploration
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

If `graph.json` is missing, the application shows an **honest no-data state**, not fictitious ontology nodes. `public/graph.json` is gitignored by design.

Run the adapter regression tests:

```bash
python3 -m unittest discover -s tests -v
```

Build frontend:

```bash
npm run build
```

**Release gate:** `npm run build` copies `public/graph.json` into `dist/` if present. Review repository visibility, data license/rights, dataset provenance, and V1 disclaimers before public deployment. No pipeline auto-publishes from the ontology repository.

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
├── public/               # Generated dataset is NOT checked into git
└── package.json
```

## Limitations / next milestones

1. Global layout currently groups nodes deterministically by `module` rather than optimizing a force-directed layout. It is quick and stable but does not claim to expose discovered communities.
2. Only *entity-to-entity assertions* are visualized; literal assertions and RDF reification/formal expression nodes are intentionally excluded from the concept overview. Full RDF drilldown requires a separate mode.
3. 31,542 V1 active assertions is an archival reported metric, not the actual displayable edge count; the adapter reports exact concept-edge counts after projection.
4. Build per-node adjacency indexes and server-side neighborhood endpoints for imported V2 graphs that exceed in-browser practical limits.
5. V2 source snapshots must be admitted with upstream checksums, provenance, licensing and declared review status. V2 is presently EMPTY of admitted upstream snapshots; synthetic fixtures never stand in for real data.
6. Implement actual accessible keyboard navigation and expand UI regression tests; browser interaction has not yet been run in this environment.
7. Optimize graph overview layout/LOD and validate rendering/performance against the full real V1 export before production.
8. Add read-only graph API (`GET /sources`, `GET /graph/overview`, `GET /nodes/:id`, `GET /nodes/:id/neighbors`) when persistent source data is deployed.

## Proposed deployment

Subdomain: `graph.curricula.live`, separate from `admin.curricula.live`. A static host can serve this first MVP; no database or authentication is needed for an explicitly authorized public dataset.