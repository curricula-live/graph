import { useEffect, useMemo, useRef } from 'react';
import Sigma, { DEFAULT_STYLES } from 'sigma';
import { extremityArrow, pathLine } from 'sigma/rendering';
import type Graph from 'graphology';
import { makeGraph } from './graph';
import type { GraphDataset, ReviewMode, ViewMode } from './types';

type Props = {
  dataset: GraphDataset; selectedId: string | null; hoveredId: string | null;
  predicate: string; module: string; kind: string; review: ReviewMode;
  mode: ViewMode; hops: number;
  onSelect: (node: string | null) => void;
  onHover: (node: string | null) => void;
  onEdge: (edge: string) => void;
  onCount: (nodes: number, edges: number) => void;
};

export default function GraphCanvas(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const onSelectRef = useRef(props.onSelect);
  const onHoverRef = useRef(props.onHover);
  const onEdgeRef = useRef(props.onEdge);
  const onCountRef = useRef(props.onCount);
  const focusRef = useRef<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  onSelectRef.current = props.onSelect;
  onHoverRef.current = props.onHover;
  onEdgeRef.current = props.onEdge;
  onCountRef.current = props.onCount;
  focusRef.current = props.selectedId;
  hoverRef.current = props.hoveredId;

  const built = useMemo(() => makeGraph(props.dataset, {
    predicate: props.predicate, module: props.module, kind: props.kind,
    review: props.review, mode: props.mode, selectedId: props.selectedId, hops: props.hops
  }), [props.dataset, props.predicate, props.module, props.kind, props.review, props.mode, props.hops,
    props.mode === 'neighborhood' ? props.selectedId : null]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    graphRef.current = built.graph;
    onCountRef.current(built.nodeCount, built.edgeCount);
    if (built.nodeCount === 0) return;
    const graph = built.graph;
    const renderer = new Sigma(graph, container, {
      settings: { enableEdgeEvents: true, itemSizesReference: 'screen' },
      primitives: { edges: { paths: [pathLine()], extremities: [extremityArrow()] } },
      styles: { edges: [DEFAULT_STYLES.edges, { head: 'arrow' }] },
      nodeReducer: (id, attrs) => {
        const focus = focusRef.current || hoverRef.current;
        if (!focus || !graph.hasNode(focus)) return attrs;
        if (id === focus) return { ...attrs, size: attrs.size + 4, color: '#ffffff', label: attrs.label };
        if (graph.areNeighbors(focus, id)) return { ...attrs, size: attrs.size + 1, label: attrs.label };
        return { ...attrs, color: '#273143', label: '' };
      },
      edgeReducer: (id, attrs) => {
        const focus = focusRef.current || hoverRef.current;
        if (!focus || !graph.hasNode(focus)) return attrs;
        const [s, t] = graph.extremities(id);
        return s === focus || t === focus
          ? { ...attrs, color: '#7aa6ff', size: 1.4 }
          : { ...attrs, color: '#17212f', size: 0.25 };
      }
    });
    rendererRef.current = renderer;
    renderer.on('clickNode', ({ node }) => onSelectRef.current(node));
    renderer.on('clickStage', () => onSelectRef.current(null));
    renderer.on('clickEdge', ({ edge }) => onEdgeRef.current(edge));
    renderer.on('enterNode', ({ node }) => {
      hoverRef.current = node; onHoverRef.current(node);
      container.style.cursor = 'pointer'; renderer.refresh();
    });
    renderer.on('leaveNode', () => {
      hoverRef.current = null; onHoverRef.current(null);
      container.style.cursor = 'grab'; renderer.refresh();
    });
    return () => { renderer.kill(); rendererRef.current = null; graphRef.current = null; };
  }, [built]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.refresh();
    const graph = graphRef.current;
    if (props.selectedId && graph?.hasNode(props.selectedId)) {
      const { x, y } = graph.getNodeAttributes(props.selectedId);
      void renderer.getCamera().animate(
        { x, y, ratio: props.mode === 'overview' ? 0.14 : 0.8 }, { duration: 430 });
    }
  }, [props.selectedId, props.mode, built]);

  return <div ref={containerRef} className="graph-canvas" role="img" aria-label="Interactive ontology graph: pan, zoom, and select nodes" />;
}
