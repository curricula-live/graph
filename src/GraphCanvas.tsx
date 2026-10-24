import { useEffect, useMemo, useRef } from 'react';
import Sigma, { DEFAULT_STYLES } from 'sigma';
import { extremityArrow, pathLine } from 'sigma/rendering';
import type Graph from 'graphology';
import { makeGraph } from './graph';
import type { GraphDataset, ReviewMode, ViewMode } from './types';

type Props = {
  dataset: GraphDataset;
  selectedId: string | null;
  predicate: string;
  module: string;
  kind: string;
  review: ReviewMode;
  mode: ViewMode;
  clusterPath: string[];
  hops: number;
  onSelect: (node: string) => void;
  onCluster: (path: string[]) => void;
  onEdge: (edge: string) => void;
  onCount: (nodes: number, edges: number, represented: number, truncated: boolean) => void;
};

export default function GraphCanvas(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const onSelectRef = useRef(props.onSelect);
  const onClusterRef = useRef(props.onCluster);
  const onEdgeRef = useRef(props.onEdge);
  const onCountRef = useRef(props.onCount);
  const selectedRef = useRef<string | null>(props.selectedId);
  const hoverRef = useRef<string | null>(null);
  onSelectRef.current = props.onSelect;
  onClusterRef.current = props.onCluster;
  onEdgeRef.current = props.onEdge;
  onCountRef.current = props.onCount;
  selectedRef.current = props.selectedId;

  const built = useMemo(() => makeGraph(props.dataset, {
    predicate: props.predicate, module: props.module, kind: props.kind,
    review: props.review, mode: props.mode, clusterPath: props.clusterPath,
    selectedId: props.selectedId, hops: props.hops,
  }), [props.dataset, props.predicate, props.module, props.kind, props.review,
    props.mode, props.hops, props.clusterPath, props.mode === 'neighborhood' ? props.selectedId : null]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    graphRef.current = built.graph;
    onCountRef.current(built.nodeCount, built.edgeCount, built.representedConcepts, built.truncated);
    if (built.nodeCount === 0) return;
    const graph = built.graph;
    const renderer = new Sigma(graph, container, {
      settings: { enableEdgeEvents: built.clusters.size === 0, itemSizesReference: 'screen' },
      primitives: { edges: { paths: [pathLine()], extremities: [extremityArrow()] } },
      styles: { edges: [DEFAULT_STYLES.edges, { head: 'arrow' }] },
      nodeReducer: (id, attrs) => {
        const focus = selectedRef.current || hoverRef.current;
        if (!focus || !graph.hasNode(focus)) return attrs;
        if (id === focus) return { ...attrs, size: attrs.size + 3, color: '#ffffff' };
        if (graph.areNeighbors(focus, id)) return { ...attrs, size: attrs.size + 1 };
        return { ...attrs, color: '#344154', label: '' };
      },
      edgeReducer: (id, attrs) => {
        const focus = selectedRef.current || hoverRef.current;
        if (!focus || !graph.hasNode(focus)) return attrs;
        const [s, t] = graph.extremities(id);
        return s === focus || t === focus
          ? { ...attrs, color: '#93b6ff', size: 1.2 }
          : { ...attrs, color: '#243145', size: 0.25 };
      },
    });
    rendererRef.current = renderer;
    renderer.on('clickNode', ({ node }) => {
      const cluster = built.clusters.get(node);
      if (cluster) onClusterRef.current(cluster.path);
      else onSelectRef.current(node);
    });
    // Do not clear the inspector on clickStage: small nodes and overlapping
    // edges previously made a seemingly successful click lose the selection.
    renderer.on('clickEdge', ({ edge }) => {
      if (!built.clusters.size) onEdgeRef.current(edge);
    });
    renderer.on('enterNode', ({ node }) => {
      hoverRef.current = node;
      container.style.cursor = 'pointer';
      renderer.refresh();
    });
    renderer.on('leaveNode', () => {
      hoverRef.current = null;
      container.style.cursor = 'grab';
      renderer.refresh();
    });
    return () => {
      renderer.kill();
      if (rendererRef.current === renderer) rendererRef.current = null;
      graphRef.current = null;
    };
  }, [built]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const graph = graphRef.current;
    if (!renderer || !graph) return;
    renderer.refresh();
    if (!props.selectedId || !graph.hasNode(props.selectedId)) return;
    // Camera coordinates are *normalized framed* coordinates, not source graph x/y.
    // Using graph.getNodeAttributes(id).x/y here panned the camera off-screen.
    const display = renderer.getNodeDisplayData(props.selectedId);
    if (display) void renderer.getCamera().animate({
      x: display.x,
      y: display.y,
      ratio: props.mode === 'neighborhood' ? 0.78 : 0.55,
    }, {duration: 300});
  }, [props.selectedId, props.mode, built]);

  return <div ref={containerRef} className="graph-canvas" role="application"
    aria-label="Interactive ontology explorer. Click a cluster to drill down or a concept to inspect its neighbors." />;
}
