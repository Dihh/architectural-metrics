import { state } from './state.js';

// ─────────────────────────────────────────
// Module-private D3 references
// ─────────────────────────────────────────
let svgSel  = null;
let zoomBeh = null;
let simRef  = null;

// ─────────────────────────────────────────
// Node colour helpers  (smell-aware)
// Priority for cross-smell overlap: cycle > hub > god > chatty
// ─────────────────────────────────────────
function nodeColor(d) {
  const isCycle     = state.cycleNodes.has(d.id);
  const isHub       = state.hubNodePaths.has(d.id);
  const isGod       = state.godNodePaths.has(d.id);
  const isChatty    = state.chattyNodePaths.has(d.id);
  const isHotspot   = state.hotspotNodePaths.has(d.id);
  const isArch      = state.archHotspotNodePaths.has(d.id);

  if (state.currentSmell === 'cyclic') {
    return isCycle ? 'rgba(248,81,73,.18)' : 'rgba(88,166,255,.1)';
  }
  if (state.currentSmell === 'hub') {
    if (isHub && isCycle) return 'rgba(188,140,255,.18)';
    if (isHub)            return 'rgba(210,153,34,.2)';
    return 'rgba(88,166,255,.08)';
  }
  if (state.currentSmell === 'god') {
    if (isGod && isCycle && isHub) return 'rgba(188,140,255,.18)';
    if (isGod && isCycle)          return 'rgba(248,81,73,.18)';
    if (isGod && isHub)            return 'rgba(210,153,34,.2)';
    if (isGod)                     return 'rgba(61,201,176,.18)';
    return 'rgba(88,166,255,.06)';
  }
  if (state.currentSmell === 'chatty') {
    if (isChatty && isCycle && isHub) return 'rgba(188,140,255,.18)';
    if (isChatty && isCycle)          return 'rgba(248,81,73,.18)';
    if (isChatty && isHub)            return 'rgba(210,153,34,.2)';
    if (isChatty && isGod)            return 'rgba(61,201,176,.18)';
    if (isChatty)                     return 'rgba(232,212,77,.18)';
    return 'rgba(88,166,255,.06)';
  }
  if (state.currentSmell === 'hotspot') {
    if (isHotspot) return 'rgba(253,150,68,.22)';
    return 'rgba(88,166,255,.06)';
  }
  // arch smell
  if (isArch && isHotspot) return 'rgba(253,150,68,.22)';
  if (isArch)              return 'rgba(224,86,253,.2)';
  return 'rgba(88,166,255,.06)';
}

function nodeStroke(d) {
  const isCycle   = state.cycleNodes.has(d.id);
  const isHub     = state.hubNodePaths.has(d.id);
  const isGod     = state.godNodePaths.has(d.id);
  const isChatty  = state.chattyNodePaths.has(d.id);
  const isHotspot = state.hotspotNodePaths.has(d.id);
  const isArch    = state.archHotspotNodePaths.has(d.id);

  if (state.currentSmell === 'cyclic') return isCycle ? '#f85149' : '#58a6ff';
  if (state.currentSmell === 'hub') {
    if (isHub && isCycle) return '#bc8cff';
    if (isHub)            return '#d29922';
    return '#58a6ff';
  }
  if (state.currentSmell === 'god') {
    if (isGod && isCycle && isHub) return '#bc8cff';
    if (isGod && isCycle)          return '#f85149';
    if (isGod && isHub)            return '#d29922';
    if (isGod)                     return '#3dc9b0';
    return '#58a6ff';
  }
  if (state.currentSmell === 'chatty') {
    if (isChatty && isCycle && isHub) return '#bc8cff';
    if (isChatty && isCycle)          return '#f85149';
    if (isChatty && isHub)            return '#d29922';
    if (isChatty && isGod)            return '#3dc9b0';
    if (isChatty)                     return '#e8d44d';
    return '#58a6ff';
  }
  if (state.currentSmell === 'hotspot') {
    return isHotspot ? '#fd9644' : '#58a6ff';
  }
  // arch smell
  if (isArch && isHotspot) return '#fd9644';
  if (isArch)              return '#e056fd';
  return '#58a6ff';
}

function nodeLabelColor(d) {
  const isCycle   = state.cycleNodes.has(d.id);
  const isHub     = state.hubNodePaths.has(d.id);
  const isGod     = state.godNodePaths.has(d.id);
  const isChatty  = state.chattyNodePaths.has(d.id);
  const isHotspot = state.hotspotNodePaths.has(d.id);
  const isArch    = state.archHotspotNodePaths.has(d.id);

  if (state.currentSmell === 'cyclic') return isCycle   ? '#f85149' : '#8b949e';
  if (state.currentSmell === 'hub')    return isHub     ? '#d29922' : '#8b949e';
  if (state.currentSmell === 'god') {
    if (isGod && isCycle) return '#f85149';
    if (isGod && isHub)   return '#d29922';
    if (isGod)            return '#3dc9b0';
    return '#8b949e';
  }
  if (state.currentSmell === 'chatty') {
    if (isChatty && isCycle) return '#f85149';
    if (isChatty && isHub)   return '#d29922';
    if (isChatty && isGod)   return '#3dc9b0';
    if (isChatty)            return '#e8d44d';
    return '#8b949e';
  }
  if (state.currentSmell === 'hotspot') return isHotspot ? '#fd9644' : '#8b949e';
  // arch smell
  if (isArch && isHotspot) return '#fd9644';
  if (isArch)              return '#e056fd';
  return '#8b949e';
}

// ─────────────────────────────────────────
// Edge colour helpers
// ─────────────────────────────────────────
function edgeStroke(d) {
  const sid = typeof d.source === 'object' ? d.source.id : d.source;
  const tid = typeof d.target === 'object' ? d.target.id : d.target;

  if (state.currentSmell === 'cyclic') return d.inCycle ? '#f85149' : '#30363d';
  if (state.currentSmell === 'hub') {
    const sh = state.hubNodePaths.has(sid), th = state.hubNodePaths.has(tid);
    if (sh && th) return '#bc8cff';
    if (sh || th) return '#d29922';
    return '#2d333b';
  }
  if (state.currentSmell === 'god') {
    const sg = state.godNodePaths.has(sid), tg = state.godNodePaths.has(tid);
    if (sg || tg) return '#3dc9b0';
    return '#2d333b';
  }
  if (state.currentSmell === 'chatty') {
    const sc = state.chattyNodePaths.has(sid), tc = state.chattyNodePaths.has(tid);
    if (sc || tc) return '#e8d44d';
    return '#2d333b';
  }
  if (state.currentSmell === 'hotspot') {
    const sh = state.hotspotNodePaths.has(sid), th = state.hotspotNodePaths.has(tid);
    if (sh || th) return '#fd9644';
    return '#2d333b';
  }
  // arch smell
  const sa = state.archHotspotNodePaths.has(sid), ta = state.archHotspotNodePaths.has(tid);
  if (sa || ta) return '#e056fd';
  return '#2d333b';
}

function edgeOpacity(d) {
  const sid = typeof d.source === 'object' ? d.source.id : d.source;
  const tid = typeof d.target === 'object' ? d.target.id : d.target;

  if (state.currentSmell === 'cyclic')  return d.inCycle ? 0.85 : 0.5;
  if (state.currentSmell === 'hub')     return (state.hubNodePaths.has(sid)     || state.hubNodePaths.has(tid))     ? 0.75 : 0.2;
  if (state.currentSmell === 'god')     return (state.godNodePaths.has(sid)     || state.godNodePaths.has(tid))     ? 0.65 : 0.18;
  if (state.currentSmell === 'chatty')  return (state.chattyNodePaths.has(sid)  || state.chattyNodePaths.has(tid))  ? 0.65 : 0.18;
  if (state.currentSmell === 'hotspot') return (state.hotspotNodePaths.has(sid) || state.hotspotNodePaths.has(tid)) ? 0.7  : 0.15;
  // arch
  return (state.archHotspotNodePaths.has(sid) || state.archHotspotNodePaths.has(tid)) ? 0.7 : 0.15;
}

function edgeMarker(d) {
  const sid = typeof d.source === 'object' ? d.source.id : d.source;
  const tid = typeof d.target === 'object' ? d.target.id : d.target;

  if (state.currentSmell === 'cyclic') return d.inCycle ? 'url(#arr-cyc)' : 'url(#arr-def)';
  if (state.currentSmell === 'hub') {
    const sh = state.hubNodePaths.has(sid), th = state.hubNodePaths.has(tid);
    if (sh && th) return 'url(#arr-pur)';
    if (sh || th) return 'url(#arr-hub)';
    return 'url(#arr-def)';
  }
  if (state.currentSmell === 'god') {
    return (state.godNodePaths.has(sid) || state.godNodePaths.has(tid)) ? 'url(#arr-teal)' : 'url(#arr-def)';
  }
  if (state.currentSmell === 'chatty') {
    return (state.chattyNodePaths.has(sid) || state.chattyNodePaths.has(tid)) ? 'url(#arr-yell)' : 'url(#arr-def)';
  }
  if (state.currentSmell === 'hotspot') {
    return (state.hotspotNodePaths.has(sid) || state.hotspotNodePaths.has(tid)) ? 'url(#arr-coral)' : 'url(#arr-def)';
  }
  // arch
  return (state.archHotspotNodePaths.has(sid) || state.archHotspotNodePaths.has(tid)) ? 'url(#arr-mag)' : 'url(#arr-def)';
}

// ─────────────────────────────────────────
// Graph legend  (private — always called via renderGraph)
// ─────────────────────────────────────────
function updateLegend() {
  const legends = {
    cyclic:
      `<div class="legend-item"><div class="legend-dot" style="border-color:#f85149;background:rgba(248,81,73,.2)"></div>Módulo em ciclo</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#58a6ff;background:rgba(88,166,255,.1)"></div>Módulo normal</div>
       <div class="legend-item"><div class="legend-line" style="background:#f85149"></div>Dependência cíclica</div>
       <div class="legend-item"><div class="legend-line" style="background:#30363d"></div>Dependência normal</div>`,
    hub:
      `<div class="legend-item"><div class="legend-dot" style="border-color:#d29922;background:rgba(210,153,34,.2)"></div>Hub</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#bc8cff;background:rgba(188,140,255,.15)"></div>Hub + ciclo</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#58a6ff;background:rgba(88,166,255,.1)"></div>Normal</div>
       <div class="legend-item"><div class="legend-line" style="background:#d29922;opacity:.7"></div>Dep. tocando hub</div>`,
    god:
      `<div class="legend-item"><div class="legend-dot" style="border-color:#3dc9b0;background:rgba(61,201,176,.18)"></div>God Component</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#f85149;background:rgba(248,81,73,.18)"></div>God + ciclo</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#d29922;background:rgba(210,153,34,.2)"></div>God + hub</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#58a6ff;background:rgba(88,166,255,.06)"></div>Normal</div>
       <div class="legend-item"><div class="legend-line" style="background:#3dc9b0;opacity:.7"></div>Dep. tocando god</div>`,
    chatty:
      `<div class="legend-item"><div class="legend-dot" style="border-color:#e8d44d;background:rgba(232,212,77,.18)"></div>Chatty Component</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#f85149;background:rgba(248,81,73,.18)"></div>Chatty + ciclo</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#d29922;background:rgba(210,153,34,.2)"></div>Chatty + hub</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#58a6ff;background:rgba(88,166,255,.06)"></div>Normal</div>
       <div class="legend-item"><div class="legend-line" style="background:#e8d44d;opacity:.7"></div>Dep. tocando chatty</div>`,
    hotspot:
      `<div class="legend-item"><div class="legend-dot" style="border-color:#fd9644;background:rgba(253,150,68,.22)"></div>Hotspot</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#58a6ff;background:rgba(88,166,255,.06)"></div>Normal</div>
       <div class="legend-item"><div class="legend-line" style="background:#fd9644;opacity:.7"></div>Dep. tocando hotspot</div>`,
    arch:
      `<div class="legend-item"><div class="legend-dot" style="border-color:#e056fd;background:rgba(224,86,253,.2)"></div>Arch Hotspot</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#fd9644;background:rgba(253,150,68,.22)"></div>Arch + Hotspot</div>
       <div class="legend-item"><div class="legend-dot" style="border-color:#58a6ff;background:rgba(88,166,255,.06)"></div>Normal</div>
       <div class="legend-item"><div class="legend-line" style="background:#e056fd;opacity:.7"></div>Dep. tocando arch</div>`,
  };
  document.getElementById('graphLegend').innerHTML = legends[state.currentSmell] || '';
}

// ─────────────────────────────────────────
// D3 Graph Rendering
// ─────────────────────────────────────────
export function renderGraph() {
  const el = document.getElementById('graphSvg');
  const W  = el.clientWidth  || 700;
  const H  = el.clientHeight || 500;

  svgSel = d3.select('#graphSvg');
  svgSel.selectAll('*').remove();

  let nodeIds;
  if      (state.currentView === 'cycles')   nodeIds = [...state.cycleNodes];
  else if (state.currentView === 'hubs')     nodeIds = [...state.hubNodePaths];
  else if (state.currentView === 'gods')     nodeIds = [...state.godNodePaths];
  else if (state.currentView === 'chatty')   nodeIds = [...state.chattyNodePaths];
  else if (state.currentView === 'hotspots') nodeIds = [...state.hotspotNodePaths];
  else if (state.currentView === 'archs')    nodeIds = [...state.archHotspotNodePaths];
  else nodeIds = [...state.fileMap.keys()].filter(p =>
    (state.depGraph.get(p)?.size ?? 0) > 0 || (state.revGraph.get(p)?.size ?? 0) > 0
  );

  if (nodeIds.length === 0) {
    svgSel.append('text')
      .attr('x', W / 2).attr('y', H / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#8b949e').attr('font-size', '13px')
      .text('Nenhum módulo encontrado para esta visão.');
    updateLegend();
    return;
  }

  const nodeSet = new Set(nodeIds);
  const nodes   = nodeIds.map(id => ({
    id,
    label:      id.split('/').pop(),
    inCycle:    state.cycleNodes.has(id),
    isHub:      state.hubNodePaths.has(id),
    isGod:      state.godNodePaths.has(id),
    isChatty:   state.chattyNodePaths.has(id),
    isHotspot:  state.hotspotNodePaths.has(id),
    isArch:     state.archHotspotNodePaths.has(id),
    out:        state.depGraph.get(id)?.size ?? 0,
    inp:        state.revGraph.get(id)?.size ?? 0,
  }));

  const links = [];
  for (const { id } of nodes) {
    for (const dep of (state.depGraph.get(id) || new Set())) {
      if (nodeSet.has(dep)) {
        links.push({ source: id, target: dep, inCycle: state.cycleEdges.has(`${id}::${dep}`) });
      }
    }
  }

  // Arrow markers
  const defs = svgSel.append('defs');
  for (const [mid, color] of [
    ['def',  '#3d444d'],
    ['cyc',  '#f85149'],
    ['hub',  '#d29922'],
    ['pur',  '#bc8cff'],
    ['teal', '#3dc9b0'],
    ['yell', '#e8d44d'],
    ['coral','#fd9644'],
    ['mag',  '#e056fd'],
  ]) {
    defs.append('marker')
      .attr('id', 'arr-' + mid)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('fill', color).attr('d', 'M0,-5L10,0L0,5');
  }

  const g = svgSel.append('g').attr('class', 'root-g');
  zoomBeh = d3.zoom().scaleExtent([0.05, 6]).on('zoom', ev => g.attr('transform', ev.transform));
  svgSel.call(zoomBeh);

  const link = g.append('g').selectAll('line').data(links).join('line')
    .attr('stroke',         edgeStroke)
    .attr('stroke-width',   d => (d.inCycle && state.currentSmell === 'cyclic') ? 2 : 1)
    .attr('stroke-opacity', edgeOpacity)
    .attr('marker-end',     edgeMarker);

  // Node radius: scales with score/connections/degree
  const r = d => {
    if (state.currentSmell === 'god' && d.isGod) {
      const gm = state.godModules.find(m => m.path === d.id);
      return gm ? Math.max(10, Math.min(20, 8 + gm.score * 1.5)) : 10;
    }
    if (state.currentSmell === 'hub' && d.isHub) {
      return Math.max(10, Math.min(20, 8 + (d.inp + d.out) * 0.5));
    }
    if (state.currentSmell === 'chatty' && d.isChatty) {
      const cm = state.chattyModules.find(m => m.path === d.id);
      return cm ? Math.max(10, Math.min(20, 8 + cm.score * 1.5)) : 10;
    }
    if (state.currentSmell === 'hotspot' && d.isHotspot) {
      const hm = state.hotspotModules.find(m => m.path === d.id);
      return hm ? Math.max(10, Math.min(22, 8 + hm.commitCount * 0.4)) : 10;
    }
    if (state.currentSmell === 'arch' && d.isArch) {
      const am = state.archHotspotModules.find(m => m.path === d.id);
      return am ? Math.max(10, Math.min(22, 8 + am.score * 2)) : 10;
    }
    return Math.max(8, Math.min(16, 8 + (d.out + d.inp) * 0.6));
  };

  const node = g.append('g').selectAll('g').data(nodes).join('g')
    .attr('cursor', 'grab')
    .call(
      d3.drag()
        .on('start', (ev, d) => { if (!ev.active) simRef.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end',   (ev, d) => { if (!ev.active) simRef.alphaTarget(0); d.fx = null; d.fy = null; })
    )
    .on('mouseover', showTip)
    .on('mousemove', moveTip)
    .on('mouseout',  hideTip)
    .on('touchstart', (ev, d) => { ev.preventDefault(); showTipTouch(ev, d); }, { passive: false });

  node.append('circle')
    .attr('r',            r)
    .attr('fill',         nodeColor)
    .attr('stroke',       nodeStroke)
    .attr('stroke-width', d => (d.inCycle || d.isHub || d.isGod || d.isChatty || d.isHotspot || d.isArch) ? 2 : 1.5);

  node.append('text')
    .text(d => d.label.length > 20 ? d.label.slice(0, 18) + '…' : d.label)
    .attr('text-anchor', 'middle')
    .attr('y', d => r(d) + 11)
    .attr('font-size', '9px')
    .attr('fill', nodeLabelColor)
    .attr('pointer-events', 'none');

  simRef = d3.forceSimulation(nodes)
    .force('link',      d3.forceLink(links).id(d => d.id).distance(90).strength(0.4))
    .force('charge',    d3.forceManyBody().strength(-180))
    .force('center',    d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide().radius(d => r(d) + 10))
    .on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

  updateLegend();
}

// ─────────────────────────────────────────
// Highlight helpers
// ─────────────────────────────────────────
export function resetGraphOpacity() {
  if (!svgSel) return;
  svgSel.selectAll('.root-g g circle')
    .attr('opacity', 1)
    .attr('stroke-width', d => (d.inCycle || d.isHub || d.isGod || d.isChatty || d.isHotspot || d.isArch) ? 2 : 1.5);
  svgSel.selectAll('.root-g g text').attr('opacity', 1);
  svgSel.selectAll('.root-g line').attr('opacity', edgeOpacity);
}

export function highlightChatty(idx) {
  state.selectedChattyIdx = idx;
  document.querySelectorAll('.chatty-card').forEach((c, i) => c.classList.toggle('selected', i === idx));
  if (idx < 0) { resetGraphOpacity(); return; }

  const chattyPath = state.chattyModules[idx].path;
  const neighbors  = new Set([
    ...(state.depGraph.get(chattyPath) || []),
    ...(state.revGraph.get(chattyPath) || []),
  ]);
  focusOnNodes(new Set([chattyPath]), neighbors);
}

export function highlightHotspot(idx) {
  state.selectedHotspotIdx = idx;
  document.querySelectorAll('.hotspot-card').forEach((c, i) => c.classList.toggle('selected', i === idx));
  if (idx < 0) { resetGraphOpacity(); return; }

  const hotPath   = state.hotspotModules[idx].path;
  const neighbors = new Set([
    ...(state.depGraph.get(hotPath) || []),
    ...(state.revGraph.get(hotPath) || []),
  ]);
  focusOnNodes(new Set([hotPath]), neighbors);
}

export function highlightArch(idx) {
  state.selectedArchIdx = idx;
  document.querySelectorAll('.arch-card').forEach((c, i) => c.classList.toggle('selected', i === idx));
  if (idx < 0) { resetGraphOpacity(); return; }

  const archPath  = state.archHotspotModules[idx].path;
  const neighbors = new Set([
    ...(state.depGraph.get(archPath) || []),
    ...(state.revGraph.get(archPath) || []),
  ]);
  focusOnNodes(new Set([archPath]), neighbors);
}

function focusOnNodes(centerPaths, neighborPaths) {
  if (!svgSel) return;
  const all = new Set([...centerPaths, ...neighborPaths]);

  svgSel.selectAll('.root-g g circle')
    .attr('opacity',      d => all.has(d.id) ? 1 : 0.08)
    .attr('stroke-width', d => centerPaths.has(d.id) ? 3.5 : all.has(d.id) ? 2 : 1);
  svgSel.selectAll('.root-g g text')
    .attr('opacity', d => all.has(d.id) ? 1 : 0.06);
  svgSel.selectAll('.root-g line')
    .attr('opacity', d => {
      const s = typeof d.source === 'object' ? d.source.id : d.source;
      const t = typeof d.target === 'object' ? d.target.id : d.target;
      return centerPaths.has(s) || centerPaths.has(t) ? 0.9 : 0.03;
    });
}

export function highlightCycle(idx) {
  state.selectedIdx = idx;
  document.querySelectorAll('.cycle-card').forEach((c, i) => c.classList.toggle('selected', i === idx));
  if (idx < 0) { resetGraphOpacity(); return; }

  const set = new Set(state.cyclicSCCs[idx]);
  svgSel?.selectAll('.root-g g circle')
    .attr('opacity',      d => set.has(d.id) ? 1 : 0.1)
    .attr('stroke-width', d => set.has(d.id) ? 3 : 1);
  svgSel?.selectAll('.root-g g text').attr('opacity', d => set.has(d.id) ? 1 : 0.08);
  svgSel?.selectAll('.root-g line').attr('opacity', d => {
    const s = typeof d.source === 'object' ? d.source.id : d.source;
    const t = typeof d.target === 'object' ? d.target.id : d.target;
    return set.has(s) && set.has(t) ? 1 : 0.04;
  });
}

export function highlightHub(idx) {
  state.selectedHubIdx = idx;
  document.querySelectorAll('.hub-card').forEach((c, i) => c.classList.toggle('selected', i === idx));
  if (idx < 0) { resetGraphOpacity(); return; }

  const hubPath   = state.hubModules[idx].path;
  const neighbors = new Set([
    ...(state.depGraph.get(hubPath) || []),
    ...(state.revGraph.get(hubPath) || []),
  ]);
  focusOnNodes(new Set([hubPath]), neighbors);
}

export function highlightGod(idx) {
  state.selectedGodIdx = idx;
  document.querySelectorAll('.god-card').forEach((c, i) => c.classList.toggle('selected', i === idx));
  if (idx < 0) { resetGraphOpacity(); return; }

  const godPath   = state.godModules[idx].path;
  const neighbors = new Set([
    ...(state.depGraph.get(godPath) || []),
    ...(state.revGraph.get(godPath) || []),
  ]);
  focusOnNodes(new Set([godPath]), neighbors);
}

// ─────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────
const tipEl = document.getElementById('tooltip');

function showTip(event, d) {
  const parts  = d.id.split('/');
  const name   = parts.pop();
  const dir    = parts.join('/') || '/';

  const inCycles = state.cyclicSCCs
    .map((scc, i) => scc.includes(d.id) ? `Ciclo #${i + 1}` : null)
    .filter(Boolean).join(', ');

  const hubInfo = state.hubNodePaths.has(d.id)
    ? `<div class="tt-hub">◎ Hub: ${d.inp} entradas · ${d.out} saídas</div>` : '';

  const godInfo = (() => {
    const gm = state.godModules.find(g => g.path === d.id);
    return gm ? `<div class="tt-god">⊕ God Component: ${gm.loc} LOC · score ${gm.score}</div>` : '';
  })();

  const chattyInfo = (() => {
    const cm = state.chattyModules.find(c => c.path === d.id);
    return cm ? `<div class="tt-chatty">⇄ Chatty: ${cm.namedImports} símbolos · score ${cm.score}</div>` : '';
  })();

  const hotspotInfo = (() => {
    const hm = state.hotspotModules.find(h => h.path === d.id);
    return hm ? `<div class="tt-hotspot">🔥 Hotspot: ${hm.commitCount} commits · ${hm.loc} LOC</div>` : '';
  })();

  const archInfo = (() => {
    const am = state.archHotspotModules.find(a => a.path === d.id);
    return am ? `<div class="tt-arch">⬡ Arch Hotspot: score ${am.score} · centralidade ${am.centrality}</div>` : '';
  })();

  tipEl.innerHTML =
    `<div class="tt-name">${name}</div>
     <div class="tt-info">
       Pasta: ${dir}<br>
       Fan-out (importa): ${d.out}<br>
       Fan-in (importado por): ${d.inp}
     </div>
     ${inCycles ? `<div class="tt-cycle">⟳ ${inCycles}</div>` : ''}
     ${hubInfo}${godInfo}${chattyInfo}${hotspotInfo}${archInfo}`;

  tipEl.classList.add('vis');
  moveTip(event);
}

function moveTip(ev) {
  let x = ev.clientX + 14, y = ev.clientY - 14;
  if (x + 220 > window.innerWidth) x = ev.clientX - 230;
  if (y < 10) y = ev.clientY + 14;
  tipEl.style.left = x + 'px';
  tipEl.style.top  = y + 'px';
}

function showTipTouch(ev, d) {
  showTip(ev.touches[0], d);
  const t = ev.touches[0];
  let x = t.clientX - 135, y = t.clientY - 120;
  if (x < 8) x = 8;
  if (x + 270 > window.innerWidth) x = window.innerWidth - 278;
  if (y < 8) y = t.clientY + 14;
  tipEl.style.left = x + 'px';
  tipEl.style.top  = y + 'px';
  // dismiss on next touch outside the tooltip
  const dismiss = (e) => {
    if (!tipEl.contains(e.target)) hideTip();
    document.removeEventListener('touchstart', dismiss);
  };
  setTimeout(() => document.addEventListener('touchstart', dismiss), 50);
}

function hideTip() { tipEl.classList.remove('vis'); }

// ─────────────────────────────────────────
// Zoom helpers
// ─────────────────────────────────────────
export function zoomBy(f)   { if (svgSel && zoomBeh) svgSel.transition().duration(280).call(zoomBeh.scaleBy, f); }
export function zoomReset() { if (svgSel && zoomBeh) svgSel.transition().duration(450).call(zoomBeh.transform, d3.zoomIdentity); }
