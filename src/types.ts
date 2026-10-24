export type ReviewMode = "all" | "scientific-view";
export type ViewMode = "overview" | "neighborhood";
export interface ConceptNode {
  id: string; label: string; labelRo: string | null; kind: string; module: string;
  definitionStatus: string; identityStatus: string; aliases: string[];
}
export interface ConceptEdge {
  id: string; source: string; target: string; predicate: string;
  status: string; reviewDisposition: string | null; inDefaultRdfGraph: boolean;
}
export interface GraphDataset {
  source: string; version: string;
  nodes: ConceptNode[]; edges: ConceptEdge[];
  excludedLiteralAssertions: number;
}
