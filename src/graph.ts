import Graph from 'graphology';
import type { ConceptEdge, ConceptNode, GraphDataset, ReviewMode, ViewMode } from './types';

const PALETTE = ['#7aa6ff', '#9a88ff', '#68d7b5', '#f8b96a', '#e98da9', '#9abf77', '#72bfd4', '#d1a1f3', '#f5d56e', '#9dabcb', '#ef9973', '#67beb4'];
export const MAX_VISIBLE_CONCEPTS = 200;
export const MAX_VISIBLE_EDGES = 900;
const MAX_AGGREGATED_EDGES = 220;
const BATCH_SIZE = 180;

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

export interface ClusterInfo {
  id: string;
  label: string;
  count: number;
  path: string[];
  module: string;
  kind: 'module' | 'kind' | 'batch';
}

export interface BuildOptions {
  predicate: string;
  module: string;
  kind: string;
  review: ReviewMode;
  mode: ViewMode;
  clusterPath: string[];
  selectedId: string | null;
  hops: number;
}
export interface BuiltGraph {
  graph: Graph;
  nodeCount: number;
  edgeCount: number;
  clusters: Map<string, ClusterInfo>;
  truncated: boolean;
  representedConcepts: number;
}

function addClusterGraph(graph: Graph, nodes: ConceptNode[], edges: ConceptEdge[], phase: 'module' | 'kind' | 'batch', path: string[]): Map<string, ClusterInfo> {
  const grouped = new Map<string, ConceptNode[]>();
  const membership = new Map<string, string>();
  const batchSorted = phase === 'batch' ? [...nodes].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id)) : [];
  const batchById = new Map(batchSorted.map((n, index) => [n.id, Math.floor(index / BATCH_SIZE)]));
  for (const n of nodes) {
    const key = phase === 'module' ? n.module : phase === 'kind' ? n.kind : String(batchById.get(n.id));
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(n);
    membership.set(n.id, key);
  }
  const keys = [...grouped.keys()].sort((a, b) => phase === 'batch' ? Number(a) - Number(b) : a.localeCompare(b));
  const clusters = new Map<string, ClusterInfo>();
  const radius = 55 + keys.length * 4.8;
  keys.forEach((key, index) => {
    const members = grouped.get(key)!;
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(1, keys.length);
    const displayLabel = phase === 'batch'
      ? members.map(n => n.label).sort((a, b) => a.localeCompare(b))[0].slice(0, 18) + ' — ' + members.map(n => n.label).sort((a, b) => a.localeCompare(b)).at(-1)!.slice(0, 18)
      : key;
    const info: ClusterInfo = {
      id: 'cluster:' + phase + ':' + key,
      label: displayLabel,
      count: members.length,
      path: [...path, key],
      module: phase === 'module' ? key : path[0],
      kind: phase,
    };
    clusters.set(info.id, info);
    graph.addNode(info.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      label: displayLabel + ' (' + members.length.toLocaleString() + ')',
      color: colorForModule(info.module),
      size: 10 + Math.min(24, Math.sqrt(members.length) * 0.9),
      isCluster: true,
      count: members.length,
    });
  });

  // Aggregate actual source relationships, without inventing any new semantic predicate.
  // Cluster edges are counts of recorded relationships, not asserted ontology facts.
  const aggregate = new Map<string, {from: string; to: string; count: number}>();
  for (const edge of edges) {
    const source = membership.get(edge.source);
    const target = membership.get(edge.target);
    if (source === undefined || target === undefined || source === target) continue;
    const key = source + '\u0000' + target;
    const existing = aggregate.get(key);
    if (existing) existing.count++;
    else aggregate.set(key, { from: source, to: target, count: 1 });
  }
  [...aggregate.values()].sort((a, b) => b.count - a.count)
    .slice(0, MAX_AGGREGATED_EDGES).forEach((row, i) => {
      graph.addDirectedEdgeWithKey('aggregate:' + i,
        'cluster:' + phase + ':' + row.from,
        'cluster:' + phase + ':' + row.to, {
          label: row.count.toLocaleString() + ' recorded assertions',
          color: '#344c69',
          size: 0.55 + Math.min(2, Math.log2(row.count + 1) * 0.22),
        });
    });
  return clusters;
}

function addConceptGraph(graph: Graph, nodes: ConceptNode[], edges: ConceptEdge[], selected: string | null) {
  const byId = new Set(nodes.map(n => n.id));
  const degree = new Map<string, number>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const sorted = [...nodes].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  sorted.forEach((n, index) => {
    const angle = index * 2.399963229728653;
    const distance = Math.sqrt(index) * 12;
    graph.addNode(n.id, {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      label: n.label,
      module: n.module,
      kind: n.kind,
      color: colorForModule(n.module),
      size: (n.id === selected ? 7 : 3) + Math.min(6, Math.log2((degree.get(n.id) ?? 0) + 1) * 0.85),
    });
  });
  const included = edges.filter(e => byId.has(e.source) && byId.has(e.target))
    .sort((a, b) => Number(b.source === selected || b.target === selected) - Number(a.source === selected || a.target === selected))
    .slice(0, MAX_VISIBLE_EDGES);
  for (const e of included) {
    graph.addDirectedEdgeWithKey(e.id, e.source, e.target, {
      label: e.predicate,
      color: e.status === 'inherited_unreviewed' ? '#273348' : '#526b8a',
      size: e.inDefaultRdfGraph ? 0.7 : 0.35,
    });
  }
  return included.length;
}

export function makeGraph(dataset: GraphDataset, opts: BuildOptions): BuiltGraph {
  const graph = new Graph({ type: 'directed', multi: true, allowSelfLoops: true });
  const clusters = new Map<string, ClusterInfo>();
  const allowedNodes = dataset.nodes.filter(n =>
    (opts.module === '*' || n.module === opts.module) &&
    (opts.kind === '*' || n.kind === opts.kind));
  const permitted = new Set(allowedNodes.map(n => n.id));
  const edges = dataset.edges.filter(e =>
    permitted.has(e.source) && permitted.has(e.target) &&
    (opts.predicate === '*' || e.predicate === opts.predicate) &&
    (opts.review === 'all' || e.inDefaultRdfGraph)
  );
  let truncated = false;
  let representedConcepts = allowedNodes.length;
  const path = opts.clusterPath;
  if (opts.mode === 'overview') {
    const entries = addClusterGraph(graph, allowedNodes, edges, 'module', []);
    entries.forEach((v, k) => clusters.set(k, v));
  } else if (opts.mode === 'cluster') {
    let members: ConceptNode[] = [];
    if (path.length >= 1) members = allowedNodes.filter(n => n.module === path[0]);
    if (path.length >= 2) members = members.filter(n => n.kind === path[1]);
    if (path.length >= 3) {
      const sorted = [...members].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
      members = sorted.slice(Number(path[2]) * BATCH_SIZE, (Number(path[2]) + 1) * BATCH_SIZE);
    }
    representedConcepts = members.length;
    if (path.length === 1) {
      const entries = addClusterGraph(graph, members, edges, 'kind', path);
      entries.forEach((v, k) => clusters.set(k, v));
    } else if (path.length === 2 && members.length > MAX_VISIBLE_CONCEPTS) {
      const entries = addClusterGraph(graph, members, edges, 'batch', path);
      entries.forEach((v, k) => clusters.set(k, v));
    } else {
      addConceptGraph(graph, members, edges, null);
    }
  } else if (opts.selectedId && permitted.has(opts.selectedId)) {
    const adj = new Map<string, Set<string>>();
    const lookup = new Map(allowedNodes.map(n => [n.id, n]));
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, new Set());
      if (!adj.has(e.target)) adj.set(e.target, new Set());
      adj.get(e.source)!.add(e.target);
      adj.get(e.target)!.add(e.source);
    }
    const ids = new Set<string>([opts.selectedId]);
    let frontier = [opts.selectedId];
    for (let depth = 0; depth < opts.hops; depth++) {
      const next = new Set<string>();
      for (const id of frontier) {
        const neighbors = [...(adj.get(id) ?? [])].sort((a, b) => (lookup.get(a)?.label || a).localeCompare(lookup.get(b)?.label || b));
        for (const neighbor of neighbors) {
          if (ids.has(neighbor)) continue;
          if (ids.size >= MAX_VISIBLE_CONCEPTS) { truncated = true; break; }
          ids.add(neighbor);
          next.add(neighbor);
        }
        if (truncated) break;
      }
      frontier = [...next];
      if (truncated || frontier.length === 0) break;
    }
    const nodes = [...ids].map(id => lookup.get(id)!).filter(Boolean);
    representedConcepts = nodes.length;
    const displayedEdges = addConceptGraph(graph, nodes, edges, opts.selectedId);
    truncated = truncated || displayedEdges === MAX_VISIBLE_EDGES;
  }
  return {graph, clusters, nodeCount: graph.order, edgeCount: graph.size, truncated, representedConcepts};
}

export function linkedAssertions(node: ConceptNode | null, edges: ConceptEdge[], limit = 60): ConceptEdge[] {
  if (!node) return [];
  return edges.filter(e => e.source === node.id || e.target === node.id).slice(0, limit);
}
