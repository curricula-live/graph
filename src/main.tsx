import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import GraphCanvas from './GraphCanvas';
import { colorForModule } from './graph';
import type { ConceptEdge, GraphDataset, ReviewMode, ViewMode } from './types';
import './styles.css';

function App() {
  const [data, setData] = useState<GraphDataset | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [module, setModule] = useState('*');
  const [kind, setKind] = useState('*');
  const [predicate, setPredicate] = useState('*');
  const [review, setReview] = useState<ReviewMode>('all');
  const [mode, setMode] = useState<ViewMode>('overview');
  const [clusterPath, setClusterPath] = useState<string[]>([]);
  const [hops, setHops] = useState(1);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [language, setLanguage] = useState<'en' | 'ro'>('en');
  const [rendered, setRendered] = useState({ nodes: 0, edges: 0, represented: 0, truncated: false });

  useEffect(() => {
    const ac = new AbortController();
    fetch('/graph.json', { signal: ac.signal }).then(async response => {
      if (!response.ok) throw new Error('No graph dataset found. Generate public/graph.json from the archived V1 JSON.');
      const doc: GraphDataset = await response.json() as GraphDataset;
      if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) throw new Error('Malformed graph dataset.');
      setData(doc);
      const conceptId = new URLSearchParams(window.location.search).get('concept');
      if (conceptId && doc.nodes.some(node => node.id === conceptId)) {
        setSelectedId(conceptId);
        setEdgeId(null);
        setModule('*');
        setKind('*');
        setMode('neighborhood');
      }
    }).catch(e => { if (!ac.signal.aborted) setError(String(e)); });
    return () => ac.abort();
  }, []);

  const byId = useMemo(() => new Map(data?.nodes.map(n => [n.id, n]) ?? []), [data]);
  const edgeById = useMemo(() => new Map(data?.edges.map(e => [e.id, e]) ?? []), [data]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const chosenEdge = edgeId ? edgeById.get(edgeId) ?? null : null;
  const modules = useMemo(() => [...new Set(data?.nodes.map(n => n.module) ?? [])].sort(), [data]);
  const outline = useMemo(() => {
    const groups = new Map<string, Map<string, number>>();
    for (const node of data?.nodes ?? []) {
      if (!groups.has(node.module)) groups.set(node.module, new Map());
      const types = groups.get(node.module)!;
      types.set(node.kind, (types.get(node.kind) ?? 0) + 1);
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([name, types]) => ({
      name, count: [...types.values()].reduce((a,b) => a+b, 0),
      types: [...types].sort(([a],[b]) => a.localeCompare(b)).map(([name,count]) => ({name,count}))
    }));
  }, [data]);
  const kinds = useMemo(() => [...new Set(data?.nodes.map(n => n.kind) ?? [])].sort(), [data]);
  const predicates = useMemo(() => [...new Set(data?.edges.map(e => e.predicate) ?? [])].sort(), [data]);
  const q = search.toLocaleLowerCase().trim();
  const matches = useMemo(() => {
    if (!data || !q) return [];
    return data.nodes.filter(n => n.label.toLocaleLowerCase().includes(q)
      || n.labelRo?.toLocaleLowerCase().includes(q)
      || n.aliases.some(a => a.toLocaleLowerCase().includes(q)))
      .sort((a, b) => {
        const rank = (n: typeof a) => n.label.toLocaleLowerCase() === q ? 3
          : n.labelRo?.toLocaleLowerCase() === q ? 3
          : n.label.toLocaleLowerCase().startsWith(q) ? 2 : 1;
        return rank(b) - rank(a) || a.label.localeCompare(b.label);
      })
      .slice(0, 12);
  }, [data, q]);
  const edgesByNode = useMemo(() => {
    const index = new Map<string, ConceptEdge[]>();
    for (const edge of data?.edges ?? []) {
      if (!index.has(edge.source)) index.set(edge.source, []);
      index.get(edge.source)!.push(edge);
      if (edge.source !== edge.target) {
        if (!index.has(edge.target)) index.set(edge.target, []);
        index.get(edge.target)!.push(edge);
      }
    }
    return index;
  }, [data]);
  const related = selectedId ? (edgesByNode.get(selectedId) ?? []).slice(0, 60) : [];
  const label = (id: string) => {
    const n = byId.get(id);
    return (language === 'ro' && n?.labelRo) || n?.label || id;
  };
  const focus = (id: string) => {
    setSelectedId(id);
    setEdgeId(null);
    setSearch('');
    setModule('*');
    setKind('*');
    setMode('neighborhood');
    setInspectorOpen(true);
  };
  const enterCluster = (path: string[]) => {
    setClusterPath(path);
    setSelectedId(null);
    setEdgeId(null);
    setModule('*');
    setKind('*');
    setMode('cluster');
  };
  const goToLevel = (level: number) => {
    setSelectedId(null);
    setEdgeId(null);
    if (level === 0) { setMode('overview'); setClusterPath([]); }
    else { setClusterPath(clusterPath.slice(0, level)); setMode('cluster'); }
  };
  const selectEdge = (edge: ConceptEdge) => { setEdgeId(edge.id); setSelectedId(edge.source); };
  const reset = () => {
    setSelectedId(null); setEdgeId(null); setMode('overview'); setClusterPath([]);
    setModule('*'); setKind('*'); setPredicate('*'); setReview('all');
  };

  return <div className="app">
    <aside className={`sidebar ${outlineOpen ? '' : 'sidebar-closed'}`}>
      <a className="brand" href="https://curricula.live" title="curricula.live home">
        <img className="brand-mark" src="/brand-mark.svg" alt="" />
        <strong>curricula.live</strong>
      </a>
      <div className="pane-heading"><div><span className="eyebrow">KNOWLEDGE EXPLORER</span><h2>Outline</h2></div>
        <button className="icon-button" aria-label="Collapse outline" onClick={() => setOutlineOpen(false)}>‹</button>
      </div>
      <div className="outline-help">Browse modules and concept types. Select a branch to explore its relationships.</div>
      <div className="outline-tree" role="tree" aria-label="Ontology outline">
        <button role="treeitem" aria-selected={mode === 'overview'} className={`tree-row root-row ${mode === 'overview' ? 'selected' : ''}`} onClick={() => goToLevel(0)}>
          <span className="tree-icon">◈</span><span className="tree-name">All knowledge</span><span className="tree-count">{data?.nodes.length.toLocaleString() ?? '—'}</span>
        </button>
        {outline.map(group => {
          const opened = expandedModules.includes(group.name);
          return <div key={group.name} role="group">
            <div className={`tree-row module-row ${clusterPath[0] === group.name && mode === 'cluster' ? 'selected' : ''}`}>
              <button className="tree-toggle" aria-label={`${opened ? 'Collapse' : 'Expand'} ${group.name}`} aria-expanded={opened}
                onClick={() => setExpandedModules(items => opened ? items.filter(x => x !== group.name) : [...items, group.name])}>{opened ? '⌄' : '›'}</button>
              <button className="tree-entry" role="treeitem" onClick={() => { enterCluster([group.name]); if (!opened) setExpandedModules(items => [...items, group.name]); }}>
                <span className="tree-icon">▦</span><span className="tree-name" title={group.name}>{group.name}</span><span className="tree-count">{group.count.toLocaleString()}</span>
              </button>
            </div>
            {opened && group.types.map(item => <div key={item.name} className="tree-child">
              <button role="treeitem" aria-selected={mode === 'cluster' && clusterPath[0] === group.name && clusterPath[1] === item.name}
                className={`tree-row type-row ${mode === 'cluster' && clusterPath[0] === group.name && clusterPath[1] === item.name ? 'selected' : ''}`}
                onClick={() => enterCluster([group.name, item.name])}>
                <span className="tree-icon">·</span><span className="tree-name" title={item.name}>{item.name}</span><span className="tree-count">{item.count.toLocaleString()}</span>
              </button>
              {mode === 'cluster' && clusterPath[0] === group.name && clusterPath[1] === item.name && item.count > 200 &&
                <div className="tree-batches">{Array.from({length: Math.ceil(item.count/180)}, (_,i) =>
                  <button key={i} className={clusterPath[2] === String(i) ? 'selected' : ''}
                    onClick={() => enterCluster([group.name,item.name,String(i)])}>Concepts {i*180+1}–{Math.min((i+1)*180,item.count)}</button>)}</div>}
            </div>)}
          </div>;
        })}
      </div>
      <details className="filter-details"><summary>Display filters</summary>
        <label>Module<select value={module} onChange={e => setModule(e.target.value)}>
          <option value="*">All modules</option>{modules.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Concept type<select value={kind} onChange={e => setKind(e.target.value)}>
          <option value="*">All types</option>{kinds.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Relationship<select value={predicate} onChange={e => setPredicate(e.target.value)}>
          <option value="*">All relationships</option>{predicates.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>Evidence<select value={review} onChange={e => setReview(e.target.value as ReviewMode)}>
          <option value="all">All recorded assertions</option><option value="scientific-view">Default V1 RDF only</option></select></label>
        <button className="secondary" onClick={() => {setModule('*');setKind('*');setPredicate('*');setReview('all');}}>Clear filters</button>
      </details>
      <div className="sidebar-foot">Read-only atlas · Archived V1 ontology</div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="topbar-leading">
          {!outlineOpen && <button className="icon-button" aria-label="Open outline" onClick={() => setOutlineOpen(true)}>☰</button>}
          <div className="global-search">
            <span className="search-symbol">⌕</span>
            <input aria-label="Search concepts" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search concepts, topics or specifications…" />
            {search && <div className="suggestions">{matches.length ? matches.map(n =>
              <button key={n.id} onClick={() => focus(n.id)}>
                <span className="dot" style={{background: colorForModule(n.module)}}/>
                <span><strong>{(language === 'ro' && n.labelRo) || n.label}</strong><small>{n.module} · {n.kind}</small></span>
              </button>) : <p className="muted">No matching concepts</p>}</div>}
          </div>
        </div>
        <div className="toolbar-actions">
          <button className={`view-button ${mode === 'overview' ? 'active' : ''}`} onClick={() => goToLevel(0)}>Overview</button>
          <button className={`view-button ${mode === 'cluster' ? 'active' : ''}`} onClick={() => clusterPath.length ? goToLevel(clusterPath.length) : goToLevel(0)}>Graph</button>
          <button className={`view-button ${mode === 'neighborhood' ? 'active' : ''}`} disabled={!selectedId} onClick={() => setMode('neighborhood')}>Focus</button>
          <button className="icon-button" aria-label="Toggle concept inspector" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen(v=>!v)}>▤</button>
          <button className="lang" onClick={() => setLanguage(language === 'en' ? 'ro' : 'en')}>{language.toUpperCase()}</button>
        </div>
      </header>
      <div className="graph-body">
        <div className="heading"><div><small>ONTOLOGY EXPLORATION</small>
          <h1>{mode === 'overview' ? 'Knowledge landscape' : mode === 'cluster' ? 'Explore clusters' : 'Concept neighborhood'}</h1>
          <p>{mode === 'neighborhood' ? 'Selected concept and its bounded neighborhood.' : 'Click a cluster to drill down; click a concept to inspect its connections.'}</p>
          <nav className="breadcrumbs" aria-label="Graph navigation">
            <button onClick={() => goToLevel(0)}>All modules</button>
            {clusterPath.map((part, i) => <React.Fragment key={i}><span>›</span>
              <button onClick={() => goToLevel(i + 1)}>{i === 2 ? 'Group ' + (Number(part) + 1) : part}</button>
            </React.Fragment>)}
            {mode === 'neighborhood' && selected && <><span>›</span><span>{label(selected.id)}</span></>}
          </nav>
        </div>
          <div className="counts"><div><strong>{rendered.nodes.toLocaleString()}</strong><small>VISIBLE NODES</small></div>
            <div><strong>{rendered.edges.toLocaleString()}</strong><small>{mode === 'overview' || mode === 'cluster' && clusterPath.length < 3 ? 'AGGREGATED / VISIBLE LINKS' : 'VISIBLE EDGES'}</small></div></div>
        </div>
        {mode === 'neighborhood' && <div className="depth-control"><label htmlFor="depth">Relationship depth</label><select id="depth" value={hops} onChange={e => setHops(Number(e.target.value))}><option value={1}>1 hop</option><option value={2}>2 hops</option><option value={3}>3 hops</option></select></div>}
        {data ?
          <GraphCanvas dataset={data} selectedId={selectedId} clusterPath={clusterPath}
            predicate={predicate} module={module} kind={kind} review={review}
            mode={mode} hops={hops}
            onSelect={focus}
            onCluster={enterCluster}
            onEdge={id => { const e = edgeById.get(id); if (e) selectEdge(e); }}
            onCount={(nodes, edges, represented, truncated) => setRendered(old => old.nodes === nodes && old.edges === edges && old.represented === represented && old.truncated === truncated ? old : { nodes, edges, represented, truncated })}/> :
          <div className="empty"><div className="empty-icon">◇</div><h2>{error ? 'Dataset not loaded' : 'Loading ontology'}</h2>
            <p>{error || 'Opening the graph snapshot...'}</p>
            <code>npm run project:v1</code>
            <small>Nothing is fabricated when data is absent.</small>
          </div>}
        {data && <div className="graph-info">
          {mode === 'overview' || mode === 'cluster' && clusterPath.length < 3
            ? 'Clusters represent ' + rendered.represented.toLocaleString() + ' concepts. Aggregated links summarize recorded relationships.'
            : 'Showing ' + rendered.nodes.toLocaleString() + ' concepts.'}
          {rendered.truncated && <strong> View limited for performance; narrow filters or search for an exact concept.</strong>}
        </div>}
        <div className="overlay"><span>SCROLL · ZOOM &nbsp; / &nbsp; DRAG · PAN &nbsp; / &nbsp; CLICK · INSPECT</span><button onClick={reset}>Reset view</button></div>
      </div>
    </main>

    <aside className={`inspector ${inspectorOpen ? "" : "inspector-closed"}`}>
      <div className="inspector-head"><strong>CONCEPT INSPECTOR</strong><button aria-label="Close inspector" onClick={() => setInspectorOpen(false)}>×</button></div>
      {selected ? <>
        <div className="kind"><span className="dot" style={{ background: colorForModule(selected.module) }}/>{selected.kind}</div>
        <h2>{label(selected.id)}</h2>
        {selected.labelRo && <p className="muted">{language === 'ro' ? selected.label : selected.labelRo}</p>}
        <div className="key"><span>Module</span><strong>{selected.module}</strong></div>
        <div className="key"><span>Definition</span><strong>{selected.definitionStatus}</strong></div>
        <div className="key"><span>Identity</span><strong>{selected.identityStatus}</strong></div>
        <div className="key"><span>Recorded edges</span><strong>{(edgesByNode.get(selected.id)?.length ?? 0).toLocaleString()}</strong></div>
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
      </> : <div className="inspector-empty"><div>◎</div>
        <h2>{mode === 'overview' ? 'Explore the ontology' : mode === 'cluster' ? 'Inside a cluster' : 'Nothing selected'}</h2>
        <p>{mode === 'overview' ? 'Each circle represents one source module. Click one to see concept types.' :
          mode === 'cluster' ? 'Click a smaller cluster to discover its concepts. Click an individual concept to open its connected assertions.' :
          'Search for a concept to inspect its recorded relationships.'}</p>
        {clusterPath.length > 0 && <button className="secondary" onClick={() => goToLevel(Math.max(0, clusterPath.length - 1))}>← Back one level</button>}
      </div>}
      <div className="disclaimer"><strong>Scientific status</strong><p>Archived V1 data has not received independent scientific certification. RDF inclusion is not proof; `uses` is not a prerequisite.</p></div>
    </aside>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
