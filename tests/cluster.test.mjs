import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeGraph, MAX_VISIBLE_CONCEPTS, MAX_VISIBLE_EDGES } from '../.graph-test.mjs';

const dataset = JSON.parse(readFileSync(new URL('../public/graph.json', import.meta.url), 'utf8'));
const base = {module:'*', kind:'*', predicate:'*', review:'all', mode:'overview', clusterPath:[], selectedId:null, hops:1};

test('overview summarizes every concept as 30 source modules without rendering 8k nodes', () => {
  const result = makeGraph(dataset, base);
  assert.equal(result.representedConcepts, dataset.nodes.length);
  assert.equal(result.nodeCount, new Set(dataset.nodes.map(n=>n.module)).size);
  assert.ok(result.edgeCount <= 220);
  assert.equal(result.clusters.size, result.nodeCount);
  assert.ok([...result.clusters.values()].every(c => c.kind === 'module' && c.path.length === 1));
});

test('opening a large module expands to kind clusters', () => {
  const result = makeGraph(dataset, {...base, mode:'cluster', clusterPath:['outcomes']});
  assert.ok(result.nodeCount > 1 && result.nodeCount <= 20);
  assert.ok([...result.clusters.values()].some(c => c.path[1] === 'learningOutcome'));
  assert.equal(result.representedConcepts, 4017);
});

test('large concept kinds expand into bounded alphabetically ordered batches', () => {
  const result = makeGraph(dataset, {...base, mode:'cluster', clusterPath:['outcomes','learningOutcome']});
  assert.ok(result.nodeCount >= 20 && result.nodeCount <= 22);
  assert.ok([...result.clusters.values()].every(c => c.kind === 'batch'));
  const leaf = makeGraph(dataset, {...base, mode:'cluster', clusterPath:['outcomes','learningOutcome','0']});
  assert.ok(leaf.nodeCount > 0 && leaf.nodeCount <= MAX_VISIBLE_CONCEPTS);
  assert.equal(leaf.clusters.size, 0);
  assert.ok(leaf.edgeCount <= MAX_VISIBLE_EDGES);
  const ids = new Set(dataset.nodes.map(n => n.id));
  leaf.graph.forEachNode(n => assert.ok(ids.has(n), 'leaf nodes come from source dataset only'));
});

test('concept neighborhoods stay bounded even for high-degree root concepts', () => {
  // The fixed known central concept has >800 outgoing edges in V1.
  const counts = new Map();
  for (const e of dataset.edges) counts.set(e.source, (counts.get(e.source) || 0) + 1);
  const hub = [...counts].sort((a,b)=>b[1]-a[1])[0][0];
  const result = makeGraph(dataset, {...base, mode:'neighborhood', selectedId:hub, clusterPath:[], hops:3});
  assert.ok(result.nodeCount <= MAX_VISIBLE_CONCEPTS);
  assert.ok(result.edgeCount <= MAX_VISIBLE_EDGES);
  assert.ok(result.graph.hasNode(hub));
  assert.equal(result.truncated, true);
  assert.equal(result.clusters.size, 0);
});

test('searching for Binary search can open a real bounded neighborhood', () => {
  const found = dataset.nodes.find(n => n.label.toLowerCase() === 'binary search');
  assert.ok(found);
  const result = makeGraph(dataset, {...base, mode:'neighborhood', selectedId:found.id, hops:1});
  assert.ok(result.graph.hasNode(found.id));
  assert.ok(result.nodeCount <= MAX_VISIBLE_CONCEPTS);
  assert.ok(result.edgeCount <= MAX_VISIBLE_EDGES);
});

test('module filtering and claim filtering do not invent nodes or predicate semantics', () => {
  const result = makeGraph(dataset, {...base, mode:'overview', module:'ai', review:'scientific-view'});
  assert.equal(result.nodeCount, 1);
  assert.equal(result.representedConcepts, dataset.nodes.filter(n => n.module === 'ai').length);
});
