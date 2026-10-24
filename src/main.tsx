import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import GraphCanvas from './GraphCanvas';
import { colorForModule, linkedAssertions } from './graph';
import type { ConceptEdge, GraphDataset, ReviewMode, ViewMode } from './types';
import './styles.css';

function App() {
  const [data, setData] = useState<GraphDataset | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [module, setModule] = useState('*');
  const [kind, setKind] = useState('*');
  const [predicate, setPredicate] = useState('*');
  const [review, setReview] = useState<ReviewMode>('all');
  const [mode, setMode] = useState<ViewMode>('overview');
  const [hops, setHops] = useState(1);
  const [language, setLanguage] = useState<'en' | 'ro'>('en');
  const [rendered, setRendered] = useState({ nodes: 0, edges: 0 });

  useEffect(() => {
    const ac = new AbortController();
    fetch('/graph.json', { signal: ac.signal }).then(async response => {
      if (!response.ok) throw new Error('No graph dataset found. Generate public/graph.json from the archived V1 JSON.');
      const doc: GraphDataset = await response.json() as GraphDataset;
      if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) throw new Error('Malformed graph dataset.');
      setData(doc);
    }).catch(e => { if (!ac.signal.aborted) setError(String(e)); });
    return () => ac.abort();
  }, []);

  const byId = useMemo(() => new Map(data?.nodes.map(n => [n.id, n]) ?? []), [data]);
  const edgeById = useMemo(() => new Map(data?.edges.map(e => [e.id, e]) ?? []), [data]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const chosenEdge = edgeId ? edgeById.get(edgeId) ?? null : null;
  const modules = useMemo(() => [...new Set(data?.nodes.map(n => n.module) ?? [])].sort(), [data]);
  const kinds = useMemo(() => [...new Set(data?.nodes.map(n => n.kind) ?? [])].sort(), [data]);
  const predicates = useMemo(() => [...new Set(data?.edges.map(e => e.predicate) ?? [])].sort(), [data]);
  const q = search.toLocaleLowerCase().trim();
  const matches = useMemo(() => {
    if (!data || !q) return [];
    return data.nodes.filter(n => n.label.toLocaleLowerCase().includes(q)
      || n.labelRo?.toLocaleLowerCase().includes(q)
      || n.aliases.some(a => a.toLocaleLowerCase().includes(q)))
      .sort((a, b) => Number(b.label.toLocaleLowerCase().startsWith(q)) - Number(a.label.toLocaleLowerCase().startsWith(q)))
      .slice(0, 12);
  }, [data, q]);
  const related = useMemo(() => linkedAssertions(selected, data?.edges ?? [], 60), [selected, data]);
  const label = (id: string) => {
    const n = byId.get(id);
    return (language === 'ro' && n?.labelRo) || n?.label || id;
  };
  const focus = (id: string) => { setSelectedId(id); setEdgeId(null); setSearch(''); };
  const selectEdge = (edge: ConceptEdge) => { setEdgeId(edge.id); setSelectedId(edge.source); };
  const reset = () => {
    setSelectedId(null); setEdgeId(null); setMode('overview');
    setModule('*'); setKind('*'); setPredicate('*'); setReview('all');
  };

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="logo">◇</div><div><strong>curricula<span>.live</span></strong><small>GRAPH ATLAS</small></div></div>
      <div className="notice">LEGACY V1 · UNREVIEWED</div>
      <section className="group"><h3>FIND A CONCEPT</h3>
        <input className="search" aria-label="Search concepts" value={search}
          onChange={e => setSearch(e.target.value)} placeholder="Search EN / RO / aliases..." />
        {search && <div className="suggestions">{matches.length ? matches.map(n =>
          <button key={n.id} onClick={() => focus(n.id)}>
            <span className="dot" style={{ background: colorForModule(n.module) }}/>
            <span><strong>{language === 'ro' && n.labelRo || n.label}</strong><small>{n.module} · {n.kind}</small></span>
          </button>) : <div className="muted">No matching concepts</div>}</div>}
      </section>
      <section className="group"><h3>GRAPH EXPLORER</h3>
        <div className="tabs">
          <button className={mode === 'overview' ? 'active' : ''} onClick={() => setMode('overview')}>Overview</button>
          <button className={mode === 'neighborhood' ? 'active' : ''} disabled={!selectedId} onClick={() => setMode('neighborhood')}>Neighbors</button>
        </div>
        {mode === 'neighborhood' && <label>Traversal depth<select value={hops} onChange={e => setHops(Number(e.target.value))}>
          <option value={1}>1 hop</option><option value={2}>2 hops</option><option value={3}>3 hops</option></select></label>}
        <label>Module<select value={module} onChange={e => setModule(e.target.value)}>
          <option value="*">All modules</option>{modules.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
        <label>Concept type<select value={kind} onChange={e => setKind(e.target.value)}>
          <option value="*">All types</option>{kinds.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
        <label>Relation type<select value={predicate} onChange={e => setPredicate(e.target.value)}>
          <option value="*">All relations</option>{predicates.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
        <label>Assertion filter<select value={review} onChange={e => setReview(e.target.value as ReviewMode)}>
          <option value="all">All recorded assertions</option>
          <option value="scientific-view">Included in default V1 RDF</option>
        </select></label>
        <button className="secondary" onClick={reset}>Reset filters</button>
      </section>
      <section className="group"><h3>MODULES</h3>
        <div className="module-list">{modules.slice(0, 18).map(x =>
          <button className={module === x ? 'selected' : ''} key={x} onClick={() => setModule(module === x ? '*' : x)}>
            <span className="dot" style={{ background: colorForModule(x) }}/>{x}
          </button>)}</div>
      </section>
      <div className="sidebar-foot">Read-only · No ontology mutations.<br/>Source: curricula-live/ontology V1 archive.</div>
    </aside>

    <main className="main">
      <header className="topbar"><span>Knowledge Atlas <b>/</b> <strong>Explore graph</strong></span>
        <div><span className="pill">V1 · PROVISIONAL</span>
          <button className="lang" onClick={() => setLanguage(language === 'en' ? 'ro' : 'en')}>{language.toUpperCase()} ↔</button></div>
      </header>
      <div className="graph-body">
        <div className="heading"><div><small>ONTOLOGY EXPLORATION</small><h1>{mode === 'overview' ? 'Knowledge landscape' : 'Concept neighborhood'}</h1>
          <p>Drag to pan · scroll to zoom · select any concept to inspect relationships.</p></div>
          <div className="counts"><div><strong>{rendered.nodes.toLocaleString()}</strong><small>VISIBLE NODES</small></div>
            <div><strong>{rendered.edges.toLocaleString()}</strong><small>VISIBLE EDGES</small></div></div>
        </div>
        {data ?
          <GraphCanvas dataset={data} selectedId={selectedId} hoveredId={hoveredId}
            predicate={predicate} module={module} kind={kind} review={review}
            mode={mode} hops={hops}
            onSelect={id => { setSelectedId(id); setEdgeId(null); if (!id) setMode('overview'); }}
            onHover={setHoveredId}
            onEdge={id => { const e = edgeById.get(id); if (e) selectEdge(e); }}
            onCount={(nodes, edges) => setRendered({ nodes, edges })}/> :
          <div className="empty"><div className="empty-icon">◇</div><h2>{error ? 'Dataset not loaded' : 'Loading ontology'}</h2>
            <p>{error || 'Opening the graph snapshot...'}</p>
            <code>npm run project:v1</code>
            <small>Nothing is fabricated when data is absent.</small>
          </div>}
        <div className="overlay"><span>SCROLL · ZOOM &nbsp; / &nbsp; DRAG · PAN &nbsp; / &nbsp; CLICK · INSPECT</span><button onClick={reset}>Reset view</button></div>
      </div>
    </main>

    <aside className="inspector">
      <div className="inspector-head"><strong>INSPECTOR</strong><button aria-label="Clear selection" onClick={reset}>×</button></div>
      {selected ? <>
        <div className="kind"><span className="dot" style={{ background: colorForModule(selected.module) }}/>{selected.kind}</div>
        <h2>{label(selected.id)}</h2>
        {selected.labelRo && <p className="muted">{language === 'ro' ? selected.label : selected.labelRo}</p>}
        <div className="key"><span>Module</span><strong>{selected.module}</strong></div>
        <div className="key"><span>Definition</span><strong>{selected.definitionStatus}</strong></div>
        <div className="key"><span>Identity</span><strong>{selected.identityStatus}</strong></div>
        <div className="key"><span>Recorded edges</span><strong>{(data?.edges.filter(e => e.source === selected.id || e.target === selected.id).length ?? 0).toLocaleString()}</strong></div>
        <div className="detail-title">CONNECTED ASSERTIONS <small>FIRST 60</small></div>
        <div className="relationships">{related.length ? related.map(e => <button key={e.id} onClick={() => selectEdge(e)}
          className={edgeId === e.id ? 'chosen' : ''}>
          <span className="arrow">{e.source === selected.id ? '↗' : '↙'}</span>
          <span><small>{e.predicate}</small><strong>{label(e.source === selected.id ? e.target : e.source)}</strong><em>{e.status}</em></span>
        </button>) : <p className="muted">No recorded entity-to-entity assertions.</p>}</div>
        {chosenEdge && <div className="edgeinfo"><div className="detail-title">ASSERTION</div>
          <p>{label(chosenEdge.source)} <b>—{chosenEdge.predicate}→</b> {label(chosenEdge.target)}</p>
          <div className="key"><span>Status</span><strong>{chosenEdge.status}</strong></div>
          <div className="key"><span>Review</span><strong>{chosenEdge.reviewDisposition || 'Not recorded'}</strong></div>
          <div className="key"><span>Default V1 RDF</span><strong>{chosenEdge.inDefaultRdfGraph ? 'Included' : 'Excluded'}</strong></div>
          <button className="secondary" onClick={() => focus(chosenEdge.target)}>Explore target →</button>
        </div>}
        <div className="uri"><small>ENTITY ID</small>{selected.id}</div>
      </> : <div className="inspector-empty"><div>◎</div><h2>Nothing selected</h2><p>Click a node, or search for a concept, to inspect its recorded relationships.</p></div>}
      <div className="disclaimer"><strong>Scientific status</strong><p>Archived V1 data has not received independent scientific certification. RDF inclusion is not proof; `uses` is not a prerequisite.</p></div>
    </aside>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
