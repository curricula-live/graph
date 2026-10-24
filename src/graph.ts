import Graph from 'graphology';
import type { ConceptEdge, ConceptNode, GraphDataset, ReviewMode, ViewMode } from './types';

const PALETTE = ['#7aa6ff', '#9a88ff', '#68d7b5', '#f8b96a', '#e98da9', '#9abf77', '#72bfd4', '#d1a1f3', '#f5d56e', '#9dabcb', '#ef9973', '#67beb4'];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function colorForModule(module: string): string {
  return PALETTE[hash(module) % PALETTE.length];
}

export function positionsForNodes(nodes: ConceptNode[]): Map<string, { x: number; y: number }> {
  const modules = [...new Set(nodes.map(n => n.module))].sort();
  const grouped = new Map<string, ConceptNode[]>();
  for (const mod of modules) grouped.set(mod, []);
  for (const node of nodes) grouped.get(node.module)!.push(node);
  const positions = new Map<string, { x: number; y: number }>();
  const radius = Math.max(400, modules.length * 25);
  modules.forEach((mod, clusterIndex) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * clusterIndex) / Math.max(1, modules.length);
    const cx = radius * Math.cos(angle), cy = radius * Math.sin(angle);
    grouped.get(mod)!.sort((a, b) => a.id.localeCompare(b.id)).forEach((node, i) => {
      const a = i * 2.399963229728653 + (hash(mod) / 4294967295) * 2 * Math.PI;
      const r = Math.sqrt(i) * 13;
      positions.set(node.id, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    });
  });
  return positions;
}

export interface BuildOptions {
  predicate: string; module: string; kind: string; review: ReviewMode;
  mode: ViewMode; selectedId: string | null; hops: number;
}
export interface BuiltGraph { graph: Graph; nodeCount: number; edgeCount: number; }

export function makeGraph(dataset: GraphDataset, options: BuildOptions): BuiltGraph {
  const graph = new Graph({ type: 'directed', multi: true, allowSelfLoops: true });
  const allNodes = new Map(dataset.nodes.map(node => [node.id, node]));
  const allowed = new Set(dataset.nodes.filter(node =>
    (options.module === '*' || node.module === options.module) &&
    (options.kind === '*' || node.kind === options.kind)
  ).map(node => node.id));
  const eligible = dataset.edges.filter(edge =>
    allowed.has(edge.source) && allowed.has(edge.target) &&
    (options.predicate === '*' || edge.predicate === options.predicate) &&
    (options.review === 'all' || edge.inDefaultRdfGraph)
  );
  let visible = allowed;
  if (options.mode === 'neighborhood' && options.selectedId && allowed.has(options.selectedId)) {
    const adj = new Map<string, Set<string>>();
    for (const edge of eligible) {
      if (!adj.has(edge.source)) adj.set(edge.source, new Set());
      if (!adj.has(edge.target)) adj.set(edge.target, new Set());
      adj.get(edge.source)!.add(edge.target);
      adj.get(edge.target)!.add(edge.source);
    }
    visible = new Set([options.selectedId]);
    let frontier = [options.selectedId];
    for (let i = 0; i < options.hops; i++) {
      const next = new Set<string>();
      for (const id of frontier) for (const target of adj.get(id) ?? []) {
        if (!visible.has(target)) { visible.add(target); next.add(target); }
      }
      frontier = [...next];
    }
  }
  const pos = positionsForNodes(dataset.nodes);
  const degree = new Map<string, number>();
  for (const edge of eligible) {
    if (!visible.has(edge.source) || !visible.has(edge.target)) continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  for (const id of visible) {
    const n = allNodes.get(id);
    if (!n) continue;
    const point = pos.get(id)!;
    graph.addNode(id, { ...point, label: n.label, module: n.module, kind: n.kind,
      color: colorForModule(n.module),
      size: 2.6 + Math.min(8, Math.log2((degree.get(id) ?? 0) + 1) * 1.1) });
  }
  for (const edge of eligible) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, {
      label: edge.predicate,
      color: edge.status === 'inherited_unreviewed' ? '#273348' : '#4d678d',
      size: edge.inDefaultRdfGraph ? 0.9 : 0.35,
      status: edge.status, predicate: edge.predicate
    });
  }
  return { graph, nodeCount: graph.order, edgeCount: graph.size };
}

export function linkedAssertions(node: ConceptNode | null, edges: ConceptEdge[], limit = 50): ConceptEdge[] {
  if (!node) return [];
  return edges.filter(edge => edge.source === node.id || edge.target === node.id).slice(0, limit);
}
