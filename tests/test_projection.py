import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from project_v1 import project

class ProjectionTests(unittest.TestCase):
    def setUp(self):
        self.doc = {
            "formatVersion": "1.0.0",
            "entities": [
                {"id": "a", "labels": {"en": "A", "ro": "Alfa"}, "kind": "algorithm", "module": "algorithms"},
                {"id": "b", "labels": {"en": "B"}, "kind": "algorithm", "module": "algorithms"},
            ],
            "assertions": [
                {"id": "edge-1", "subject": "a", "predicate": "uses", "object": {"id": "b"}, "assertionStatus": "inherited_unreviewed"},
                {"id": "lit-1", "subject": "b", "predicate": "version", "object": {"value": "1"}, "assertionStatus": "curated"},
            ],
            "assertionReviews": [],
        }

    def test_nodes_and_relationships(self):
        d = project(self.doc)
        self.assertEqual([n["label"] for n in d["nodes"]], ["A", "B"])
        self.assertEqual(d["nodes"][0]["labelRo"], "Alfa")
        self.assertEqual(len(d["edges"]), 1)
        self.assertEqual(d["excludedLiteralAssertions"], 1)

    def test_unreviewed_not_default_rdf(self):
        self.assertFalse(project(self.doc)["edges"][0]["inDefaultRdfGraph"])

    def test_reviewed_projection_does_not_claim_certification(self):
        self.doc["assertionReviews"] = [{"assertion": "edge-1", "disposition": "source_supported"}]
        self.assertTrue(project(self.doc)["edges"][0]["inDefaultRdfGraph"])
        self.assertEqual(project(self.doc)["edges"][0]["status"], "inherited_unreviewed")

    def test_dangling_rejected(self):
        self.doc["assertions"][0]["object"]["id"] = "missing"
        with self.assertRaises(ValueError):
            project(self.doc)

if __name__ == "__main__":
    unittest.main()
