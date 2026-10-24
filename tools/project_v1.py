#!/usr/bin/env python3
"""Read-only V1 -> browser concept graph projection. No invented edges."""
import argparse
import json
from pathlib import Path

REVIEW_ALLOW = {"source_supported", "adopted_scope"}

def project(data):
    if not isinstance(data.get("entities"), list) or not isinstance(data.get("assertions"), list):
        raise ValueError("Expected V1 ontology-consolidated.json (entities and assertions)")
    nodes = []
    for e in data["entities"]:
        nodes.append({
            "id": e["id"],
            "label": e.get("labels", {}).get("en", e["id"]),
            "labelRo": e.get("labels", {}).get("ro"),
            "kind": e.get("kind", "unknown"),
            "module": e.get("module", "unclassified"),
            "definitionStatus": e.get("definitionStatus", "unknown"),
            "identityStatus": e.get("identityStatus", "unknown"),
            "aliases": [alias["value"] for alias in e.get("aliases", []) if isinstance(alias, dict) and isinstance(alias.get("value"), str)],
        })
    known = {n["id"] for n in nodes}
    reviews = {r["assertion"]: r for r in data.get("assertionReviews", [])}
    classlike = {
        "class", "abstractConcept", "datatype", "property", "operation", "algorithm",
        "mathematicalStructure", "protocol", "standard", "softwareArtifact",
        "hardwareArtifact"
    }
    kinds = {e["id"]: e.get("kind") for e in data["entities"]}
    edges = []
    literal_count = 0
    for a in data["assertions"]:
        target = a.get("object", {}).get("id")
        if not target:
            literal_count += 1
            continue
        if a["subject"] not in known or target not in known:
            raise ValueError("Dangling entity reference in assertion " + a["id"])
        r = reviews.get(a["id"], {})
        status = a.get("assertionStatus", "unknown")
        # This faithfully mirrors the V1 RDF projection rule. It is NOT peer-review verification.
        included = not (status == "inherited_unreviewed" and kinds[a["subject"]] in classlike) or r.get("disposition") in REVIEW_ALLOW
        edges.append({
            "id": a["id"], "source": a["subject"], "target": target,
            "predicate": a["predicate"], "status": status,
            "reviewDisposition": r.get("disposition"),
            "inDefaultRdfGraph": bool(included),
        })
    return {
        "source": "curricula-live/ontology archived V1 (provisional, not peer-reviewed)",
        "version": str(data.get("formatVersion", "1.0.0")),
        "nodes": nodes,
        "edges": edges,
        "excludedLiteralAssertions": literal_count,
    }

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    doc = json.loads(args.input.read_text(encoding="utf-8"))
    projected = project(doc)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(projected, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"V1 browser projection: {len(projected['nodes'])} nodes, {len(projected['edges'])} entity edges, {projected['excludedLiteralAssertions']} literal assertions excluded")

if __name__ == "__main__":
    main()
