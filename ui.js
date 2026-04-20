// Current list presentation mode — module-level, persists across smell switches
let listView = 'cards'; // 'cards' | 'table'

// ─────────────────────────────────────────
// Metric info definitions (used by modal)
// ─────────────────────────────────────────
const METRIC_INFO = {
  // ── Architecture smell descriptions (used by the settings modal info buttons) ──
  'smell-cyclic': {
    icon: '⟳',
    title: 'Cyclic Dependency',
    desc: `<p><strong>Cyclic Dependency</strong> occurs when two or more components form a dependency cycle: module A depends on B, which depends on A — directly or through an intermediate chain.</p>
           <p>This violates the hierarchical dependency structure (DAG), making it impossible to understand, test, or replace any module in the cycle in isolation. Empirical studies show that components in cycles are modified significantly more often, amplifying the impact of any change.</p>
           <p><em>Detected via Tarjan's SCC algorithm. Classification is binary: any cycle in the graph characterises the smell — there is no configurable numeric threshold.</em></p>`,
    thresholds: [
      { label: 'SCC ≥ 2 modules', cls: 'med' },
      { label: '≥ 3 modules → MEDIUM', cls: 'med' },
      { label: '≥ 5 modules → HIGH', cls: 'high' },
    ],
  },
  'smell-hub': {
    icon: '◎',
    title: 'Hub-Like Dependency',
    desc: `<p><strong>Hub-Like Dependency</strong> describes a component with an excessive number of both incoming (<em>fan-in</em>) and outgoing (<em>fan-out</em>) dependencies, making it a central convergence point in the dependency graph.</p>
           <p>Any modification to the hub propagates effects to a large number of dependents, while changes to the modules it depends on alter its behaviour. This raises the risk of refactoring, hinders parallel development, and creates performance bottlenecks in distributed systems.</p>
           <p><em>The literature does not establish consensus absolute thresholds (tools like Arcan use system-relative statistical thresholds). This study adopts absolute thresholds for fan-in, fan-out, and total.</em></p>`,
    thresholds: [
      { label: `Fan-in ≥ HUB_MIN_IN`, cls: 'med' },
      { label: `Fan-out ≥ HUB_MIN_OUT`, cls: 'med' },
      { label: `Total ≥ HUB_MIN_TOTAL`, cls: 'high' },
    ],
  },
  'smell-god': {
    icon: '⊕',
    title: 'God Component',
    desc: `<p><strong>God Component</strong> (also known as <em>Blob</em> or <em>Large Component</em>) describes a module that has accumulated excessive responsibilities — the architectural manifestation of the classic <em>God Class</em>.</p>
           <p>It hinders adding new features (any related feature must interact with it), increases global coupling, and concentrates a disproportionate share of system defects. Tornhill &amp; Borg empirically demonstrate that modules with high code density and frequent modifications account for the majority of production bugs.</p>
           <p><em>Scoring system: each metric that exceeds its medium threshold adds +1 point; exceeding the high threshold adds another +1. Reaching the minimum score triggers the smell.</em></p>`,
    thresholds: [
      { label: 'LOC medium/high: +1/+2 pts', cls: 'med' },
      { label: 'Functions medium/high: +1/+2 pts', cls: 'med' },
      { label: 'Exports medium/high: +1/+2 pts', cls: 'med' },
      { label: 'Imports ≥ minimum: +1 pt', cls: 'med' },
      { label: `Score ≥ GOD_MIN_SCORE → flagged`, cls: 'high' },
    ],
  },
  'smell-chatty': {
    icon: '⇄',
    title: 'Chatty Component',
    desc: `<p><strong>Chatty Component</strong> describes a module that imports an excessive number of named symbols from its dependencies, indicating excessive communicational coupling and a lack of adequate abstractions at the interface between components.</p>
           <p>In the JS/TS module context, this manifests as extensive <code>import { a, b, c, d… }</code> statements — especially when many symbols come from a single dependency. This pattern makes the component fragile: any refactoring of the depended module's API can break multiple call sites.</p>
           <p><em>The literature describes this smell qualitatively, without formalised numeric thresholds (Taibi &amp; Lenarduzzi, 2018). This study adopts its own absolute thresholds based on imported symbol counts.</em></p>`,
    thresholds: [
      { label: 'Total symbols medium/high: +1/+2 pts', cls: 'med' },
      { label: 'Max from 1 dep medium/high: +1/+2 pts', cls: 'med' },
      { label: `Score ≥ CHATTY_MIN_SCORE → flagged`, cls: 'high' },
    ],
  },
  'smell-hotspot': {
    icon: '🔥',
    title: 'Hotspot',
    desc: `<p><strong>Hotspot</strong> identifies files that combine <em>large size</em> with <em>high change frequency</em> in the git history — areas of the code the team needs to touch constantly, accumulating technical debt.</p>
           <p>Concept introduced by Tornhill (<em>Your Code as a Crime Scene</em>, 2015): by overlaying static complexity metrics with git behavioural metrics, it is possible to identify the points of greatest real risk — not just the largest files, but those that change most and are already large.</p>
           <p><em>Requires <code>commits.txt</code> in the project root. Both dimensions (frequency and size) must be triggered to characterise the smell.</em></p>`,
    thresholds: [
      { label: 'Commits medium/high: +1/+2 pts', cls: 'med' },
      { label: 'LOC medium/high: +1/+2 pts', cls: 'med' },
      { label: `Score ≥ HOTSPOT_MIN_SCORE → flagged`, cls: 'high' },
    ],
  },
  'smell-arch': {
    icon: '⬡',
    title: 'Architectural Hotspot',
    desc: `<p><strong>Architectural Hotspot</strong> combines three risk dimensions simultaneously: <em>change frequency</em> (behavioural), <em>structural centrality</em> (fan-in + fan-out), and <em>size</em> (volumetric). It is the smell with the highest architectural severity.</p>
           <p>Centrality measures how central the module is in the dependency network: high centrality means it connects many parts of the system. When this combines with a high rate of change and large size, the module concentrates all three major architectural risk vectors simultaneously.</p>
           <p><em>Extends Tornhill's hotspot concept with the structural centrality dimension. Requires <code>commits.txt</code>. Severity: score ≥ 5 = HIGH · ≥ 3 = MEDIUM.</em></p>`,
    thresholds: [
      { label: 'Commits medium/high: +1/+2 pts', cls: 'med' },
      { label: 'Centrality medium/high: +1/+2 pts', cls: 'med' },
      { label: 'LOC medium/high: +1/+2 pts', cls: 'med' },
      { label: `Score ≥ ARCH_MIN_SCORE → flagged`, cls: 'high' },
    ],
  },
  // ── Per-metric descriptions (used by smell list cards) ──
  loc: {
    icon: '≡',
    title: 'LOC — Lines of Code',
    desc: `<p>Non-empty, non-comment <strong>lines of code</strong> in the file.</p>
           <p>The most basic size indicator. Very large files tend to accumulate multiple responsibilities that should be separated into smaller modules — violating the <em>Single Responsibility Principle</em>.</p>`,
    thresholds: [{ label: '≥ 300 lines', cls: 'med' }, { label: '≥ 500 lines', cls: 'high' }],
  },
  func: {
    icon: 'ƒ',
    title: 'Declared Functions',
    desc: `<p>Count of <strong><code>function</code> declarations</strong> and <strong>arrow functions</strong> <code>=></code> in the file.</p>
           <p>A module with many functions is probably doing more than it should. Each additional function increases the cognitive load for readers.</p>`,
    thresholds: [{ label: '≥ 15 functions', cls: 'med' }, { label: '≥ 25 functions', cls: 'high' }],
  },
  exp: {
    icon: '↑',
    title: 'Exports — Public Interface',
    desc: `<p>Number of <strong>exported symbols</strong> from the module (<code>export const</code>, <code>export function</code>, <code>export class</code>, etc.).</p>
           <p>A very large public interface may indicate a lack of cohesion — the module exposes too much to the outside world, making it hard to replace or refactor.</p>`,
    thresholds: [{ label: '≥ 6 exports', cls: 'med' }, { label: '≥ 12 exports', cls: 'high' }],
  },
  imp: {
    icon: '↓',
    title: 'Fan-out — Outgoing Dependencies',
    desc: `<p>Number of <strong>modules this file imports</strong> directly.</p>
           <p>High fan-out indicates strong outgoing coupling: the file depends on many others. This makes isolated testing harder and increases the likelihood of breaking when any dependency changes.</p>`,
    thresholds: [{ label: '≥ 10 imports', cls: 'med' }],
  },
  'fan-in': {
    icon: '←',
    title: 'Fan-in — Incoming Dependencies',
    desc: `<p>Number of <strong>modules that import this file</strong>.</p>
           <p>High fan-in means many other modules depend on this one. Changes to it can propagate impacts throughout the codebase. When combined with high fan-out, it forms a <em>Hub</em> — a critical coupling point.</p>`,
    thresholds: [{ label: `≥ 3 fan-in (Hub: total ≥ 8)`, cls: 'med' }],
  },
  'fan-out': {
    icon: '→',
    title: 'Fan-out — Outgoing Dependencies',
    desc: `<p>Number of <strong>modules this file imports</strong> directly.</p>
           <p>High fan-out indicates the module depends on many parts of the system. When combined with high fan-in, it forms a <em>Hub</em> — a critical bidirectional coupling point.</p>`,
    thresholds: [{ label: `≥ 3 fan-out (Hub: total ≥ 8)`, cls: 'med' }],
  },
  named: {
    icon: '⇄',
    title: 'Imported Symbols',
    desc: `<p>Total number of <strong>named symbols</strong> imported via destructuring <code>{ a, b, c }</code> across all imports in the file.</p>
           <p>A high count indicates the component heavily consumes its dependencies' interfaces, making it fragile to changes in external APIs.</p>`,
    thresholds: [{ label: '≥ 15 symbols', cls: 'med' }, { label: '≥ 30 symbols', cls: 'high' }],
  },
  max: {
    icon: '↗',
    title: 'Max from One Dependency',
    desc: `<p>The largest number of symbols imported from <strong>a single dependency</strong>.</p>
           <p>Indicates strong and specific coupling — the component depends heavily on a single module. If that module changes its API, the impact will be significant.</p>`,
    thresholds: [{ label: '≥ 6 symbols', cls: 'med' }, { label: '≥ 10 symbols', cls: 'high' }],
  },
  freq: {
    icon: '↻',
    title: 'Commits — Change Frequency',
    desc: `<p>Number of <strong>commits that modified this file</strong> in the git history.</p>
           <p>High change frequency in a large file is the classic hotspot signal: an area of the system the team needs to touch constantly, accumulating technical debt.</p>
           <p>Generate the file with: <code>git log --pretty=format:"%H %ai %an" --numstat > commits.txt</code></p>`,
    thresholds: [{ label: '≥ 10 commits', cls: 'med' }, { label: '≥ 25 commits', cls: 'high' }],
  },
  centrality: {
    icon: '⟺',
    title: 'Centrality — Network Importance',
    desc: `<p>Sum of <strong>fan-in + fan-out</strong> for the module. Measures how central it is in the project's dependency network.</p>
           <p>High centrality means the module connects many parts of the system. When combined with high change frequency and large size, it indicates an <em>Architectural Hotspot</em> — the most severe architectural risk.</p>`,
    thresholds: [{ label: '≥ 8 connections', cls: 'med' }, { label: '≥ 15 connections', cls: 'high' }],
  },
  deps: {
    icon: '🔗',
    title: 'Dependencies — Total Edges',
    desc: `<p>Total number of <strong>unique directed connections</strong> between project files — i.e., each successfully resolved "<em>file A imports file B</em>" relationship counts as one dependency.</p>
           <p>Duplicate imports within the same file are counted only once (the graph uses <code>Set</code> internally). Imports to external libraries or unresolved paths are <strong>not</strong> included.</p>
           <p>This number represents the size of the dependency graph and gives a general idea of the project's <strong>coupling level</strong>.</p>`,
    thresholds: [],
  },
};

// Replace threshold key placeholders like GOD_MIN_SCORE with live values
function resolveThresholdLabel(label) {
  return label.replace(/\b([A-Z][A-Z0-9_]+)\b/g, (match) =>
    match in thresholds ? thresholds[match] : match
  );
}

function openMetricModal(key) {
  const info = METRIC_INFO[key];
  if (!info) return;

  document.getElementById('miIcon').textContent  = info.icon;
  document.getElementById('miTitle').textContent = info.title;

  const thresholdsHtml = info.thresholds?.length
    ? `<div class="mi-thresholds">
         <div class="mi-thresholds-title">Detection thresholds</div>
         <div class="mi-thr-row">
           ${info.thresholds.map(t => `<span class="mi-thr-chip ${t.cls}">${resolveThresholdLabel(t.label)}</span>`).join('')}
         </div>
       </div>`
    : '';

  document.getElementById('miBody').innerHTML = info.desc + thresholdsHtml;
  document.getElementById('metricInfoModal').style.display = 'flex';
}

function closeMetricModal() {
  document.getElementById('metricInfoModal').style.display = 'none';
}

import { state, thresholds, THRESHOLD_DEFAULTS } from './state.js';
import {
  analyseFiles, findCyclePath, tick,
  computeGodMetrics, computeGodScore,
  computeChattyMetrics, computeChattyScore,
} from './detectors.js';
import {
  renderGraph,
  resetGraphOpacity,
  highlightCycle, highlightHub, highlightGod, highlightChatty,
  highlightHotspot, highlightArch,
  zoomBy, zoomReset,
} from './graph.js';

// ─────────────────────────────────────────
// Render — Cyclic Dependency list
// ─────────────────────────────────────────
function renderCycleList() {
  const el = document.getElementById('smellList');

  if (state.cyclicSCCs.length === 0) {
    el.innerHTML = `<div class="threshold-info">
        Detected via Tarjan's algorithm (SCC ≥ 2 nodes)
      </div>
      <div class="no-results">
        <div class="no-results-icon">✅</div>
        <strong>No cycles detected!</strong>
        <p style="margin-top:8px;font-size:12px">The code has no cyclic dependencies.</p>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="threshold-info">
    Tarjan's algorithm — reports cycles with ≥ 2 modules · Severity by cycle size: ≥ 5 modules = HIGH · ≥ 3 = MEDIUM · 2 modules = LOW
  </div>`;
  state.cyclicSCCs.forEach((scc, i) => {
    const sev   = scc.length >= 5 ? 'high' : scc.length >= 3 ? 'medium' : 'low';
    const label = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }[sev];
    const path  = findCyclePath(scc);
    const names = path.map(p => p.split('/').pop());

    const pathHtml = names.map((n, k) =>
      k < names.length - 1
        ? `<div class="path-module"><span>${n}</span></div><div class="path-arrow">↓</div>`
        : `<div class="path-module"><span>${n}</span></div><div class="path-return">↩ back to ${names[0]}</div>`
    ).join('');

    const card = document.createElement('div');
    card.className = 'smell-card cycle-card';
    card.title     = scc.join('\n');
    card.innerHTML =
      `<div class="card-head">
         <span class="sev-badge sev-${sev}">${label}</span>
         <span class="card-title">Cycle #${i + 1}</span>
         <span class="card-count">${scc.length} module${scc.length > 1 ? 's' : ''}</span>
       </div>
       <div class="cycle-path">${pathHtml}</div>`;

    card.addEventListener('click', () => {
      if (state.selectedIdx === i) { state.selectedIdx = -1; highlightCycle(-1); }
      else highlightCycle(i);
    });
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Render — Hub-Like Dependency list
// ─────────────────────────────────────────
function renderHubList() {
  const el = document.getElementById('smellList');
  el.innerHTML = `<div class="threshold-info">
    Threshold: fan-in ≥ <strong>${thresholds.HUB_MIN_IN}</strong> · fan-out ≥ <strong>${thresholds.HUB_MIN_OUT}</strong> · total ≥ <strong>${thresholds.HUB_MIN_TOTAL}</strong>
  </div>`;

  // Build metrics for ALL files
  const allFiles = [];
  for (const [path] of state.fileMap) {
    const fanOut   = state.depGraph.get(path)?.size ?? 0;
    const fanIn    = state.revGraph.get(path)?.size ?? 0;
    const total    = fanIn + fanOut;
    const smelly   = state.hubModules.find(m => m.path === path);
    allFiles.push({ path, fanIn, fanOut, total, sev: smelly?.sev ?? null });
  }
  allFiles.sort((a, b) => b.total - a.total);

  const maxTotal = allFiles[0]?.total ?? 1;

  allFiles.forEach((file, i) => {
    const { path, fanIn, fanOut, total, sev } = file;
    const isSmelly = !!sev;
    const parts    = path.split('/');
    const name     = parts.pop();
    const dir      = parts.join('/') || '/';
    const inPct    = Math.round((fanIn  / maxTotal) * 100);
    const outPct   = Math.round((fanOut / maxTotal) * 100);
    const isCycle  = state.cycleNodes.has(path);

    const badgeHtml = isSmelly
      ? `<span class="sev-badge sev-${sev}">${{ high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }[sev]}</span>`
      : `<span class="sev-badge sev-normal">—</span>`;

    const card = document.createElement('div');
    card.className = `smell-card hub-card${isSmelly ? '' : ' normal'}`;
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         ${badgeHtml}
         <span class="card-title">${name}</span>
         <span class="card-count">${total} connections</span>
       </div>
       <div class="hub-metrics">
         <div class="hub-metric metric-clickable" data-metric="fan-in">
           <div class="hub-metric-label"><span class="hub-dir-in">←</span> Fan-in <span class="metric-info-btn" aria-label="Learn more">i</span></div>
           <div class="hub-bar-wrap"><div class="hub-bar-fill fan-in" style="width:${inPct}%"></div></div>
           <span class="hub-metric-val">${fanIn}</span>
         </div>
         <div class="hub-metric metric-clickable" data-metric="fan-out">
           <div class="hub-metric-label"><span class="hub-dir-out">→</span> Fan-out <span class="metric-info-btn" aria-label="Learn more">i</span></div>
           <div class="hub-bar-wrap"><div class="hub-bar-fill fan-out" style="width:${outPct}%"></div></div>
           <span class="hub-metric-val">${fanOut}</span>
         </div>
       </div>
       <div class="hub-path-line">${dir}</div>
       ${isCycle ? `<div class="hub-also-cycle" style="font-size:10px;color:var(--red);margin-top:4px">⟳ Also part of a cycle</div>` : ''}`;

    if (isSmelly) {
      const smellyIdx = state.hubModules.findIndex(m => m.path === path);
      card.addEventListener('click', () => {
        if (state.selectedHubIdx === smellyIdx) { state.selectedHubIdx = -1; highlightHub(-1); }
        else highlightHub(smellyIdx);
      });
    }
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Render — God Component list
// ─────────────────────────────────────────
const METRIC_DEFS = [
  { key: 'loc',  icon: '≡', label: 'LOC',       getter: m => m.loc,         get med() { return thresholds.GOD_LOC_MED;  }, get high() { return thresholds.GOD_LOC_HIGH;  } },
  { key: 'func', icon: 'ƒ', label: 'Functions', getter: m => m.funcCount,   get med() { return thresholds.GOD_FUNC_MED; }, get high() { return thresholds.GOD_FUNC_HIGH; } },
  { key: 'exp',  icon: '↑', label: 'Exports',   getter: m => m.exportCount, get med() { return thresholds.GOD_EXP_MED;  }, get high() { return thresholds.GOD_EXP_HIGH;  } },
  { key: 'imp',  icon: '↓', label: 'Imports',   getter: m => m.importCount, get med() { return thresholds.GOD_IMP_MIN;  }, high: null },
];

function renderGodList() {
  const el = document.getElementById('smellList');
  el.innerHTML = `<div class="threshold-info">
    Threshold: LOC ≥ <strong>${thresholds.GOD_LOC_MED}</strong> · functions ≥ <strong>${thresholds.GOD_FUNC_MED}</strong> · exports ≥ <strong>${thresholds.GOD_EXP_MED}</strong> · imports ≥ <strong>${thresholds.GOD_IMP_MIN}</strong>
  </div>`;

  // Build metrics for ALL files
  const allFiles = [];
  for (const [path, content] of state.fileMap) {
    const smelly = state.godModules.find(m => m.path === path);
    if (smelly) {
      allFiles.push({ ...smelly, isSmelly: true });
    } else {
      const { loc, funcCount, exportCount } = computeGodMetrics(content);
      const importCount = state.depGraph.get(path)?.size ?? 0;
      const { score, flags } = computeGodScore(loc, funcCount, exportCount, importCount);
      allFiles.push({ path, loc, funcCount, exportCount, importCount, score, sev: null, flags, isSmelly: false });
    }
  }
  allFiles.sort((a, b) => b.score - a.score || b.loc - a.loc);

  allFiles.forEach(mod => {
    const { path, sev, score, flags, isSmelly } = mod;
    const parts   = path.split('/');
    const name    = parts.pop();
    const dir     = parts.join('/') || '/';
    const isCycle = state.cycleNodes.has(path);
    const isHub   = state.hubNodePaths.has(path);

    const badgeHtml = isSmelly
      ? `<span class="sev-badge sev-${sev}">${{ high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }[sev]}</span>`
      : `<span class="sev-badge sev-normal">—</span>`;

    const metricsHtml = METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = isSmelly && !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="god-metric metric-clickable ${triggered ? 'triggered' : ''}" data-metric="${def.key}">
        <span class="god-metric-icon">${def.icon}</span>
        <span class="god-metric-label">${def.label}</span>
        <span class="god-metric-val">${val}${levelLabel}</span>
        <span class="metric-info-btn" aria-label="Learn more">i</span>
      </div>`;
    }).join('');

    const alsoTags = [
      isCycle ? `<span class="god-also-tag cycle">⟳ In cycle</span>` : '',
      isHub   ? `<span class="god-also-tag hub">◎ Is hub</span>`     : '',
    ].filter(Boolean).join('');

    const card = document.createElement('div');
    card.className = `smell-card god-card${isSmelly ? '' : ' normal'}`;
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         ${badgeHtml}
         <span class="card-title">${name}</span>
         <span class="card-count">score ${score}</span>
       </div>
       <div class="god-metrics-grid">${metricsHtml}</div>
       <div class="god-path-line">${dir}</div>
       ${alsoTags ? `<div class="god-also">${alsoTags}</div>` : ''}`;

    if (isSmelly) {
      const smellyIdx = state.godModules.findIndex(m => m.path === path);
      card.addEventListener('click', () => {
        if (state.selectedGodIdx === smellyIdx) { state.selectedGodIdx = -1; highlightGod(-1); }
        else highlightGod(smellyIdx);
      });
    }
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Render — Chatty Component list
// ─────────────────────────────────────────
const CHATTY_METRIC_DEFS = [
  { key: 'named', icon: '⇄', label: 'Symbols',      getter: m => m.namedImports, get med() { return thresholds.CHATTY_NAMED_MED; }, get high() { return thresholds.CHATTY_NAMED_HIGH; } },
  { key: 'max',   icon: '↗', label: 'Max from 1 dep', getter: m => m.maxFromOne, get med() { return thresholds.CHATTY_MAX_MED;   }, get high() { return thresholds.CHATTY_MAX_HIGH;   } },
];

function renderChattyList() {
  const el = document.getElementById('smellList');
  el.innerHTML = `<div class="threshold-info">
    Threshold: total symbols ≥ <strong>${thresholds.CHATTY_NAMED_MED}</strong> · or max from one dep ≥ <strong>${thresholds.CHATTY_MAX_MED}</strong>
  </div>`;

  // Build metrics for ALL files
  const allFiles = [];
  for (const [path, content] of state.fileMap) {
    const smelly = state.chattyModules.find(m => m.path === path);
    if (smelly) {
      allFiles.push({ ...smelly, isSmelly: true });
    } else {
      const { namedImports, maxFromOne, topDep } = computeChattyMetrics(content);
      const { score, flags } = computeChattyScore(namedImports, maxFromOne);
      allFiles.push({ path, namedImports, maxFromOne, topDep, score, sev: null, flags, isSmelly: false });
    }
  }
  allFiles.sort((a, b) => b.score - a.score || b.namedImports - a.namedImports);

  allFiles.forEach(mod => {
    const { path, sev, score, flags, topDep, isSmelly } = mod;
    const parts   = path.split('/');
    const name    = parts.pop();
    const dir     = parts.join('/') || '/';
    const isCycle = state.cycleNodes.has(path);
    const isHub   = state.hubNodePaths.has(path);
    const isGod   = state.godNodePaths.has(path);

    const badgeHtml = isSmelly
      ? `<span class="sev-badge sev-${sev}">${{ high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }[sev]}</span>`
      : `<span class="sev-badge sev-normal">—</span>`;

    const metricsHtml = CHATTY_METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = isSmelly && !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="chatty-metric metric-clickable ${triggered ? 'triggered' : ''}" data-metric="${def.key}">
        <span class="chatty-metric-icon">${def.icon}</span>
        <span class="chatty-metric-label">${def.label}</span>
        <span class="chatty-metric-val">${val}${levelLabel}</span>
        <span class="metric-info-btn" aria-label="Learn more">i</span>
      </div>`;
    }).join('');

    const topDepShort = topDep
      ? topDep.split('/').pop().replace(/\.[jt]sx?$/, '')
      : '—';
    const topDepHtml = topDep
      ? `<div class="chatty-top-dep">↗ Top dep: <span>${topDepShort}</span> (${mod.maxFromOne} symbols)</div>`
      : '';

    const alsoTags = [
      isCycle ? `<span class="chatty-also-tag cycle">⟳ In cycle</span>`     : '',
      isHub   ? `<span class="chatty-also-tag hub">◎ Is hub</span>`         : '',
      isGod   ? `<span class="chatty-also-tag god">⊕ God component</span>`  : '',
    ].filter(Boolean).join('');

    const card = document.createElement('div');
    card.className = `smell-card chatty-card${isSmelly ? '' : ' normal'}`;
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         ${badgeHtml}
         <span class="card-title">${name}</span>
         <span class="card-count">score ${score}</span>
       </div>
       <div class="chatty-metrics-grid">${metricsHtml}</div>
       ${topDepHtml}
       <div class="chatty-path-line">${dir}</div>
       ${alsoTags ? `<div class="chatty-also">${alsoTags}</div>` : ''}`;

    if (isSmelly) {
      const smellyIdx = state.chattyModules.findIndex(m => m.path === path);
      card.addEventListener('click', () => {
        if (state.selectedChattyIdx === smellyIdx) { state.selectedChattyIdx = -1; highlightChatty(-1); }
        else highlightChatty(smellyIdx);
      });
    }
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Render — Hotspot list
// ─────────────────────────────────────────
const HOTSPOT_METRIC_DEFS = [
  { key: 'freq', icon: '↻', label: 'Commits', getter: m => m.commitCount, get med() { return thresholds.HOTSPOT_FREQ_MED; }, get high() { return thresholds.HOTSPOT_FREQ_HIGH; } },
  { key: 'loc',  icon: '≡', label: 'LOC',     getter: m => m.loc,         get med() { return thresholds.HOTSPOT_LOC_MED;  }, get high() { return thresholds.HOTSPOT_LOC_HIGH;  } },
];

function renderHotspotList() {
  const el = document.getElementById('smellList');

  if (!state.hasCommits) {
    el.innerHTML = `<div class="no-results">
      <div class="no-results-icon">📄</div>
      <strong>commits.txt not found</strong>
      <p style="margin-top:8px;font-size:12px">
        Include a <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">commits.txt</code>
        file in the project root to enable Hotspot detection.
      </p>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="threshold-info">
    Threshold: commits ≥ <strong>${thresholds.HOTSPOT_FREQ_MED}</strong> · LOC ≥ <strong>${thresholds.HOTSPOT_LOC_MED}</strong> (both must be triggered)
  </div>`;

  // Build metrics for ALL files that appear in commits.txt
  const allFiles = [];
  for (const [path, commitInfo] of state.commitData) {
    const smelly = state.hotspotModules.find(m => m.path === path);
    if (smelly) {
      allFiles.push({ ...smelly, isSmelly: true });
    } else {
      const content = state.fileMap.get(path) ?? '';
      const { loc }  = computeGodMetrics(content);
      const { commitCount, linesChanged } = commitInfo;
      allFiles.push({ path, commitCount, linesChanged, loc, score: 0, sev: null, flags: {}, isSmelly: false });
    }
  }
  allFiles.sort((a, b) => b.score - a.score || b.commitCount - a.commitCount);

  allFiles.forEach(mod => {
    const { path, sev, score, flags, linesChanged, isSmelly } = mod;
    const parts  = path.split('/');
    const name   = parts.pop();
    const dir    = parts.join('/') || '/';

    const badgeHtml = isSmelly
      ? `<span class="sev-badge sev-${sev}">${{ high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }[sev]}</span>`
      : `<span class="sev-badge sev-normal">—</span>`;

    const metricsHtml = HOTSPOT_METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = isSmelly && !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="hotspot-metric metric-clickable ${triggered ? 'triggered' : ''}" data-metric="${def.key}">
        <span class="hotspot-metric-icon">${def.icon}</span>
        <span class="hotspot-metric-label">${def.label}</span>
        <span class="hotspot-metric-val">${val}${levelLabel}</span>
        <span class="metric-info-btn" aria-label="Learn more">i</span>
      </div>`;
    }).join('');

    const isCycle = state.cycleNodes.has(path);
    const isHub   = state.hubNodePaths.has(path);
    const isGod   = state.godNodePaths.has(path);
    const alsoTags = [
      isCycle ? `<span class="hotspot-also-tag cycle">⟳ In cycle</span>`    : '',
      isHub   ? `<span class="hotspot-also-tag hub">◎ Is hub</span>`        : '',
      isGod   ? `<span class="hotspot-also-tag god">⊕ God component</span>` : '',
    ].filter(Boolean).join('');

    const card = document.createElement('div');
    card.className = `smell-card hotspot-card${isSmelly ? '' : ' normal'}`;
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         ${badgeHtml}
         <span class="card-title">${name}</span>
         <span class="card-count">score ${score}</span>
       </div>
       <div class="hotspot-metrics-grid">${metricsHtml}</div>
       <div class="hotspot-lines-changed">± ${linesChanged} total lines changed</div>
       <div class="hotspot-path-line">${dir}</div>
       ${alsoTags ? `<div class="hotspot-also">${alsoTags}</div>` : ''}`;

    if (isSmelly) {
      const smellyIdx = state.hotspotModules.findIndex(m => m.path === path);
      card.addEventListener('click', () => {
        if (state.selectedHotspotIdx === smellyIdx) { state.selectedHotspotIdx = -1; highlightHotspot(-1); }
        else highlightHotspot(smellyIdx);
      });
    }
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Render — Architectural Hotspot list
// ─────────────────────────────────────────
const ARCH_METRIC_DEFS = [
  { key: 'freq',       icon: '↻', label: 'Commits',     getter: m => m.commitCount, get med() { return thresholds.HOTSPOT_FREQ_MED;    }, get high() { return thresholds.HOTSPOT_FREQ_HIGH;    } },
  { key: 'centrality', icon: '⟺', label: 'Centrality',  getter: m => m.centrality,  get med() { return thresholds.ARCH_CENTRALITY_MED; }, get high() { return thresholds.ARCH_CENTRALITY_HIGH; } },
  { key: 'loc',        icon: '≡', label: 'LOC',         getter: m => m.loc,         get med() { return thresholds.HOTSPOT_LOC_MED;     }, get high() { return thresholds.HOTSPOT_LOC_HIGH;     } },
];

function renderArchList() {
  const el = document.getElementById('smellList');

  if (!state.hasCommits) {
    el.innerHTML = `<div class="no-results">
      <div class="no-results-icon">📄</div>
      <strong>commits.txt not found</strong>
      <p style="margin-top:8px;font-size:12px">
        Include a <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">commits.txt</code>
        file in the project root to enable Architectural Hotspot detection.
      </p>
    </div>`;
    return;
  }

  el.innerHTML = `<div class="threshold-info">
    Threshold: commits ≥ <strong>${thresholds.HOTSPOT_FREQ_MED}</strong> · centrality ≥ <strong>${thresholds.ARCH_CENTRALITY_MED}</strong> · LOC ≥ <strong>${thresholds.HOTSPOT_LOC_MED}</strong>
  </div>`;

  // Build metrics for ALL files that appear in commits.txt
  const allFiles = [];
  for (const [path, commitInfo] of state.commitData) {
    const smelly = state.archHotspotModules.find(m => m.path === path);
    if (smelly) {
      allFiles.push({ ...smelly, isSmelly: true });
    } else {
      const content    = state.fileMap.get(path) ?? '';
      const { loc }    = computeGodMetrics(content);
      const fanIn      = state.revGraph.get(path)?.size ?? 0;
      const fanOut     = state.depGraph.get(path)?.size ?? 0;
      const centrality = fanIn + fanOut;
      const { commitCount } = commitInfo;
      allFiles.push({ path, commitCount, loc, centrality, fanIn, fanOut, score: 0, sev: null, flags: {}, isSmelly: false });
    }
  }
  allFiles.sort((a, b) => b.score - a.score || b.commitCount - a.commitCount);

  allFiles.forEach(mod => {
    const { path, sev, score, flags, fanIn, fanOut, isSmelly } = mod;
    const parts  = path.split('/');
    const name   = parts.pop();
    const dir    = parts.join('/') || '/';

    const badgeHtml = isSmelly
      ? `<span class="sev-badge sev-${sev}">${{ high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }[sev]}</span>`
      : `<span class="sev-badge sev-normal">—</span>`;

    const metricsHtml = ARCH_METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = isSmelly && !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="arch-metric metric-clickable ${triggered ? 'triggered' : ''}" data-metric="${def.key}">
        <span class="arch-metric-icon">${def.icon}</span>
        <span class="arch-metric-label">${def.label}</span>
        <span class="arch-metric-val">${val}${levelLabel}</span>
        <span class="metric-info-btn" aria-label="Learn more">i</span>
      </div>`;
    }).join('');

    const fanLine = `<div class="arch-fan-line">
      <span class="arch-fan-in">← ${fanIn} fan-in</span>
      <span class="arch-fan-sep">·</span>
      <span class="arch-fan-out">→ ${fanOut} fan-out</span>
    </div>`;

    const isCycle = state.cycleNodes.has(path);
    const isHub   = state.hubNodePaths.has(path);
    const alsoTags = [
      isCycle ? `<span class="arch-also-tag cycle">⟳ In cycle</span>` : '',
      isHub   ? `<span class="arch-also-tag hub">◎ Is hub</span>`     : '',
    ].filter(Boolean).join('');

    const card = document.createElement('div');
    card.className = `smell-card arch-card${isSmelly ? '' : ' normal'}`;
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         ${badgeHtml}
         <span class="card-title">${name}</span>
         <span class="card-count">score ${score}</span>
       </div>
       <div class="arch-metrics-grid">${metricsHtml}</div>
       ${fanLine}
       <div class="arch-path-line">${dir}</div>
       ${alsoTags ? `<div class="arch-also">${alsoTags}</div>` : ''}`;

    if (isSmelly) {
      const smellyIdx = state.archHotspotModules.findIndex(m => m.path === path);
      card.addEventListener('click', () => {
        if (state.selectedArchIdx === smellyIdx) { state.selectedArchIdx = -1; highlightArch(-1); }
        else highlightArch(smellyIdx);
      });
    }
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Table renders
// One per smell; fall back to card render when list is empty / commits absent.
// ─────────────────────────────────────────
const SEV_LABEL = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };

// Shared helper — builds the <table> HTML and injects it into el
function buildTable(el, cols, rows) {
  el.classList.add('table-mode');
  const ths = cols.map(c =>
    `<th${c.r ? ' class="th-r"' : ''}${c.w ? ` style="width:${c.w}"` : ''}>${c.label}</th>`
  ).join('');
  el.innerHTML =
    `<table class="smell-table">
       <thead><tr>${ths}</tr></thead>
       <tbody>${rows}</tbody>
     </table>`;
}

function renderCycleTable() {
  const el = document.getElementById('smellList');
  if (!state.cyclicSCCs.length) { el.classList.remove('table-mode'); renderCycleList(); return; }

  const rows = state.cyclicSCCs.map((scc, i) => {
    const sev   = scc.length >= 5 ? 'high' : scc.length >= 3 ? 'medium' : 'low';
    const names = scc.map(p => p.split('/').pop()).join(', ');
    return `<tr class="smell-row" data-idx="${i}" title="${scc.join('\n')}">
      <td class="td-num">${i + 1}</td>
      <td class="td-mods">${names}</td>
      <td class="td-val">${scc.length}</td>
      <td class="td-sev"><span class="sev-badge sev-${sev}">${SEV_LABEL[sev]}</span></td>
    </tr>`;
  }).join('');

  buildTable(el, [
    { label: '#', w: '28px' },
    { label: 'Modules' },
    { label: 'N', r: true, w: '28px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

function renderHubTable() {
  const el = document.getElementById('smellList');

  const allFiles = [];
  for (const [path] of state.fileMap) {
    const fanOut = state.depGraph.get(path)?.size ?? 0;
    const fanIn  = state.revGraph.get(path)?.size ?? 0;
    const smelly = state.hubModules.find(m => m.path === path);
    allFiles.push({ path, fanIn, fanOut, total: fanIn + fanOut, sev: smelly?.sev ?? null });
  }
  allFiles.sort((a, b) => b.total - a.total);

  const rows = allFiles.map((m, i) =>
    `<tr class="smell-row${m.sev ? '' : ' row-normal'}" data-idx="${i}" title="${m.path}">
      <td class="td-file">${m.path.split('/').pop()}</td>
      <td class="td-val">${m.fanIn}</td>
      <td class="td-val">${m.fanOut}</td>
      <td class="td-val">${m.total}</td>
      <td class="td-sev">${m.sev ? `<span class="sev-badge sev-${m.sev}">${SEV_LABEL[m.sev]}</span>` : `<span class="sev-badge sev-normal">—</span>`}</td>
    </tr>`
  ).join('');

  buildTable(el, [
    { label: 'File' },
    { label: 'In',    r: true, w: '34px' },
    { label: 'Out',   r: true, w: '34px' },
    { label: 'Total', r: true, w: '44px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

function renderGodTable() {
  const el = document.getElementById('smellList');

  const allFiles = [];
  for (const [path, content] of state.fileMap) {
    const smelly = state.godModules.find(m => m.path === path);
    if (smelly) {
      allFiles.push({ ...smelly });
    } else {
      const { loc, funcCount, exportCount } = computeGodMetrics(content);
      const importCount = state.depGraph.get(path)?.size ?? 0;
      const { score }   = computeGodScore(loc, funcCount, exportCount, importCount);
      allFiles.push({ path, loc, funcCount, exportCount, importCount, score, sev: null });
    }
  }
  allFiles.sort((a, b) => b.score - a.score || b.loc - a.loc);

  const rows = allFiles.map((m, i) =>
    `<tr class="smell-row${m.sev ? '' : ' row-normal'}" data-idx="${i}" title="${m.path}">
      <td class="td-file">${m.path.split('/').pop()}</td>
      <td class="td-val">${m.loc}</td>
      <td class="td-val">${m.funcCount}</td>
      <td class="td-val">${m.exportCount}</td>
      <td class="td-val">${m.score}</td>
      <td class="td-sev">${m.sev ? `<span class="sev-badge sev-${m.sev}">${SEV_LABEL[m.sev]}</span>` : `<span class="sev-badge sev-normal">—</span>`}</td>
    </tr>`
  ).join('');

  buildTable(el, [
    { label: 'File' },
    { label: 'LOC',   r: true, w: '42px' },
    { label: 'ƒ',     r: true, w: '28px' },
    { label: '↑',     r: true, w: '28px' },
    { label: 'Score', r: true, w: '44px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

function renderChattyTable() {
  const el = document.getElementById('smellList');

  const allFiles = [];
  for (const [path, content] of state.fileMap) {
    const smelly = state.chattyModules.find(m => m.path === path);
    if (smelly) {
      allFiles.push({ ...smelly });
    } else {
      const { namedImports, maxFromOne } = computeChattyMetrics(content);
      const { score } = computeChattyScore(namedImports, maxFromOne);
      allFiles.push({ path, namedImports, maxFromOne, score, sev: null });
    }
  }
  allFiles.sort((a, b) => b.score - a.score || b.namedImports - a.namedImports);

  const rows = allFiles.map((m, i) =>
    `<tr class="smell-row${m.sev ? '' : ' row-normal'}" data-idx="${i}" title="${m.path}">
      <td class="td-file">${m.path.split('/').pop()}</td>
      <td class="td-val">${m.namedImports}</td>
      <td class="td-val">${m.maxFromOne}</td>
      <td class="td-val">${m.score}</td>
      <td class="td-sev">${m.sev ? `<span class="sev-badge sev-${m.sev}">${SEV_LABEL[m.sev]}</span>` : `<span class="sev-badge sev-normal">—</span>`}</td>
    </tr>`
  ).join('');

  buildTable(el, [
    { label: 'File' },
    { label: 'Symbols', r: true, w: '60px' },
    { label: 'Max 1',   r: true, w: '46px' },
    { label: 'Score',   r: true, w: '44px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

function renderHotspotTable() {
  const el = document.getElementById('smellList');
  if (!state.hasCommits) { el.classList.remove('table-mode'); renderHotspotList(); return; }

  const allFiles = [];
  for (const [path, commitInfo] of state.commitData) {
    const smelly = state.hotspotModules.find(m => m.path === path);
    if (smelly) {
      allFiles.push({ ...smelly });
    } else {
      const content = state.fileMap.get(path) ?? '';
      const { loc } = computeGodMetrics(content);
      allFiles.push({ path, commitCount: commitInfo.commitCount, loc, score: 0, sev: null });
    }
  }
  allFiles.sort((a, b) => b.score - a.score || b.commitCount - a.commitCount);

  const rows = allFiles.map((m, i) =>
    `<tr class="smell-row${m.sev ? '' : ' row-normal'}" data-idx="${i}" title="${m.path}">
      <td class="td-file">${m.path.split('/').pop()}</td>
      <td class="td-val">${m.commitCount}</td>
      <td class="td-val">${m.loc}</td>
      <td class="td-val">${m.score}</td>
      <td class="td-sev">${m.sev ? `<span class="sev-badge sev-${m.sev}">${SEV_LABEL[m.sev]}</span>` : `<span class="sev-badge sev-normal">—</span>`}</td>
    </tr>`
  ).join('');

  buildTable(el, [
    { label: 'File' },
    { label: 'Commits', r: true, w: '54px' },
    { label: 'LOC',     r: true, w: '42px' },
    { label: 'Score',   r: true, w: '44px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

function renderArchTable() {
  const el = document.getElementById('smellList');
  if (!state.hasCommits) { el.classList.remove('table-mode'); renderArchList(); return; }

  const allFiles = [];
  for (const [path, commitInfo] of state.commitData) {
    const smelly = state.archHotspotModules.find(m => m.path === path);
    if (smelly) {
      allFiles.push({ ...smelly });
    } else {
      const content    = state.fileMap.get(path) ?? '';
      const { loc }    = computeGodMetrics(content);
      const fanIn      = state.revGraph.get(path)?.size ?? 0;
      const fanOut     = state.depGraph.get(path)?.size ?? 0;
      allFiles.push({ path, commitCount: commitInfo.commitCount, centrality: fanIn + fanOut, loc, score: 0, sev: null });
    }
  }
  allFiles.sort((a, b) => b.score - a.score || b.commitCount - a.commitCount);

  const rows = allFiles.map((m, i) =>
    `<tr class="smell-row${m.sev ? '' : ' row-normal'}" data-idx="${i}" title="${m.path}">
      <td class="td-file">${m.path.split('/').pop()}</td>
      <td class="td-val">${m.commitCount}</td>
      <td class="td-val">${m.centrality}</td>
      <td class="td-val">${m.loc}</td>
      <td class="td-val">${m.score}</td>
      <td class="td-sev">${m.sev ? `<span class="sev-badge sev-${m.sev}">${SEV_LABEL[m.sev]}</span>` : `<span class="sev-badge sev-normal">—</span>`}</td>
    </tr>`
  ).join('');

  buildTable(el, [
    { label: 'File' },
    { label: 'Commits',  r: true, w: '54px' },
    { label: 'Central.', r: true, w: '54px' },
    { label: 'LOC',      r: true, w: '42px' },
    { label: 'Score',    r: true, w: '44px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

// ─────────────────────────────────────────
// Toggle button state sync
// ─────────────────────────────────────────
function updateListViewToggle() {
  document.querySelectorAll('[data-list-view]').forEach(b =>
    b.classList.toggle('active', b.dataset.listView === listView));
}

// ─────────────────────────────────────────
// Unified list renderer (cards or table)
// ─────────────────────────────────────────
function renderCurrentList() {
  const el = document.getElementById('smellList');
  el.classList.remove('table-mode'); // each table render re-adds it if needed

  const renders = {
    cyclic:  [renderCycleList,   renderCycleTable  ],
    hub:     [renderHubList,     renderHubTable    ],
    god:     [renderGodList,     renderGodTable    ],
    chatty:  [renderChattyList,  renderChattyTable ],
    hotspot: [renderHotspotList, renderHotspotTable],
    arch:    [renderArchList,    renderArchTable   ],
  }[state.currentSmell];

  if (renders) renders[listView === 'table' ? 1 : 0]();
}

// ─────────────────────────────────────────
// Smell tab switching
// ─────────────────────────────────────────
function setSmell(smell) {
  state.currentSmell = smell;
  state.currentView  = 'all';
  state.selectedIdx = state.selectedHubIdx = state.selectedGodIdx =
    state.selectedChattyIdx = state.selectedHotspotIdx = state.selectedArchIdx = -1;

  document.querySelectorAll('.smell-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.smell === smell));

  updateStats();
  updateViewToggles();
  renderGraph();

  const cfg = {
    cyclic:  { title: 'Detected Cycles',               cls: 'cyclic',  count: state.cyclicSCCs.length         },
    hub:     { title: 'Detected Hubs',                 cls: 'hub',     count: state.hubModules.length         },
    god:     { title: 'Detected God Components',       cls: 'god',     count: state.godModules.length         },
    chatty:  { title: 'Detected Chatty Components',    cls: 'chatty',  count: state.chattyModules.length      },
    hotspot: { title: 'Detected Hotspots',             cls: 'hotspot', count: state.hotspotModules.length     },
    arch:    { title: 'Detected Architectural Hotspots', cls: 'arch',  count: state.archHotspotModules.length },
  }[smell];

  document.getElementById('listTitle').textContent = cfg.title;
  document.getElementById('listBadge').className   = 'list-badge ' + cfg.cls;
  document.getElementById('listBadge').textContent = cfg.count;
  renderCurrentList();
}

// ─────────────────────────────────────────
// Stats bar
// ─────────────────────────────────────────
function updateStats() {
  const s = {
    cyclic:  { c3: 'danger',   v3: state.cyclicSCCs.length,          l3: 'Cycles',
               c4: 'warning',  v4: state.cycleNodes.size,             l4: 'Affected Modules' },
    hub:     { c3: 'warning',  v3: state.hubModules.length,           l3: 'Hubs',
               c4: 'info',     v4: state.hubModules[0]?.total ?? 0,   l4: 'Max Connections' },
    god:     { c3: 'teal',     v3: state.godModules.length,           l3: 'God Components',
               c4: 'teal',     v4: state.godModules[0]?.score ?? 0,   l4: 'Max Score' },
    chatty:  { c3: 'yellow',   v3: state.chattyModules.length,        l3: 'Chatty Components',
               c4: 'yellow',   v4: state.chattyModules[0]?.namedImports ?? 0, l4: 'Max Symbols' },
    hotspot: { c3: 'coral',    v3: state.hotspotModules.length,       l3: 'Hotspots',
               c4: 'coral',    v4: state.hotspotModules[0]?.commitCount ?? 0, l4: 'Max Commits' },
    arch:    { c3: 'magenta',  v3: state.archHotspotModules.length,   l3: 'Arch Hotspots',
               c4: 'magenta',  v4: state.archHotspotModules[0]?.score ?? 0,   l4: 'Max Score' },
  }[state.currentSmell];

  document.getElementById('statCard3').className  = 'stat-card ' + s.c3;
  document.getElementById('statVal3').textContent = s.v3;
  document.getElementById('statLbl3').textContent = s.l3;
  document.getElementById('statCard4').className  = 'stat-card ' + s.c4;
  document.getElementById('statVal4').textContent = s.v4;
  document.getElementById('statLbl4').textContent = s.l4;
}

// ─────────────────────────────────────────
// View toggle buttons
// Uses event delegation — no onclick strings in generated HTML
// ─────────────────────────────────────────
function updateViewToggles() {
  const cfg = {
    cyclic:  { view: 'cycles',    label: 'Cycles Only'            },
    hub:     { view: 'hubs',      label: 'Hubs Only'              },
    god:     { view: 'gods',      label: 'God Components Only'    },
    chatty:  { view: 'chatty',    label: 'Chatty Components Only' },
    hotspot: { view: 'hotspots',  label: 'Hotspots Only'          },
    arch:    { view: 'archs',     label: 'Arch Hotspots Only'     },
  }[state.currentSmell];

  document.getElementById('viewToggleGroup').innerHTML =
    `<button class="toggle ${state.currentView === 'all'     ? 'active' : ''}" data-view="all">${'All Modules'}</button>
     <button class="toggle ${state.currentView === cfg.view  ? 'active' : ''}" data-view="${cfg.view}">${cfg.label}</button>`;
}

// ─────────────────────────────────────────
// View filter
// ─────────────────────────────────────────
function setView(v) {
  state.currentView = v;
  state.selectedIdx = state.selectedHubIdx = state.selectedGodIdx =
    state.selectedChattyIdx = state.selectedHotspotIdx = state.selectedArchIdx = -1;
  updateViewToggles();
  renderGraph();
}

// ─────────────────────────────────────────
// Screen management
// ─────────────────────────────────────────
function setLoading(msg) {
  document.getElementById('loadingText').textContent = msg;
}

function showScreen(name) {
  ['upload', 'loading', 'results'].forEach(n =>
    document.getElementById(n + 'Screen').style.display = 'none');
  document.getElementById('btnNew').style.display    = 'none';
  document.getElementById('btnReport').style.display = 'none';
  document.getElementById(name + 'Screen').style.display = 'flex';
  if (name === 'results') {
    document.getElementById('btnNew').style.display    = 'block';
    document.getElementById('btnReport').style.display = 'block';
  }
}

// ─────────────────────────────────────────
// Report modal
// ─────────────────────────────────────────
function countSeverities(modules) {
  const out = { high: 0, medium: 0, low: 0 };
  modules.forEach(m => { if (m.sev) out[m.sev]++; });
  return out;
}

function renderReport() {
  const s = state;

  // Cyclic severity: per-SCC (size ≥5 = high, ≥3 = medium, else low)
  const cycleSevs = { high: 0, medium: 0, low: 0 };
  s.cyclicSCCs.forEach(scc => {
    const sev = scc.length >= 5 ? 'high' : scc.length >= 3 ? 'medium' : 'low';
    cycleSevs[sev]++;
  });

  // Unique files touched by any smell
  const allAffected = new Set([
    ...s.cycleNodes,
    ...s.hubNodePaths,
    ...s.godNodePaths,
    ...s.chattyNodePaths,
    ...s.hotspotNodePaths,
    ...s.archHotspotNodePaths,
  ]);

  const hubSevs     = countSeverities(s.hubModules);
  const godSevs     = countSeverities(s.godModules);
  const chattySevs  = countSeverities(s.chattyModules);
  const hotSevs     = countSeverities(s.hotspotModules);
  const archSevs    = countSeverities(s.archHotspotModules);

  const rows = [
    { icon: '⟳', label: 'Cyclic Dependency', color: 'red',     total: s.cyclicSCCs.length,         sevs: cycleSevs,  files: s.cycleNodes.size },
    { icon: '◎', label: 'Hub-Like Dependency',color: 'orange',  total: s.hubModules.length,          sevs: hubSevs,    files: s.hubNodePaths.size },
    { icon: '⊕', label: 'God Component',      color: 'teal',   total: s.godModules.length,          sevs: godSevs,    files: s.godNodePaths.size },
    { icon: '⇄', label: 'Chatty Component',   color: 'yellow', total: s.chattyModules.length,       sevs: chattySevs, files: s.chattyNodePaths.size },
    { icon: '🔥', label: 'Hotspot',           color: 'coral',  total: s.hasCommits ? s.hotspotModules.length : null,     sevs: hotSevs,  files: s.hotspotNodePaths.size },
    { icon: '⬡', label: 'Arch Hotspot',       color: 'magenta',total: s.hasCommits ? s.archHotspotModules.length : null, sevs: archSevs, files: s.archHotspotNodePaths.size },
  ];

  const totalSmells = rows.reduce((a, r) => a + (r.total ?? 0), 0);
  const totalHigh   = rows.reduce((a, r) => a + r.sevs.high,   0);
  const totalMed    = rows.reduce((a, r) => a + r.sevs.medium, 0);
  const totalLow    = rows.reduce((a, r) => a + r.sevs.low,    0);

  const bodyRows = rows.map(r => {
    const na = r.total === null;
    if (na) {
      return `<tr>
      <td class="rpt-smell"><span class="rpt-dot rpt-dot-${r.color}"></span>${r.icon} ${r.label}</td>
      <td class="rpt-na" colspan="5">git log not found</td>
    </tr>`;
    }
    return `<tr>
      <td class="rpt-smell"><span class="rpt-dot rpt-dot-${r.color}"></span>${r.icon} ${r.label}</td>
      <td class="rpt-num rpt-total">${r.total || '–'}</td>
      <td class="rpt-num rpt-high">${r.sevs.high   || '–'}</td>
      <td class="rpt-num rpt-med" >${r.sevs.medium || '–'}</td>
      <td class="rpt-num rpt-low" >${r.sevs.low    || '–'}</td>
      <td class="rpt-num">${r.files || '–'}</td>
    </tr>`;
  }).join('');

  const html =
    `<div class="rpt-meta">
       <span class="rpt-meta-item">📁 ${s.fileMap.size} files analysed</span>
       <span class="rpt-meta-item">🔗 ${Array.from(s.depGraph.values()).reduce((a,s)=>a+s.size,0)} dependencies</span>
       ${s.hasCommits ? '<span class="rpt-meta-item">📜 commits.txt included</span>' : '<span class="rpt-meta-item rpt-meta-warn">⚠ no commits.txt</span>'}
     </div>
     <table class="rpt-table">
       <thead>
         <tr>
           <th>Smell</th>
           <th class="rpt-num">Total</th>
           <th class="rpt-num rpt-high">High</th>
           <th class="rpt-num rpt-med">Medium</th>
           <th class="rpt-num rpt-low">Low</th>
           <th class="rpt-num">Files</th>
         </tr>
       </thead>
       <tbody>${bodyRows}</tbody>
       <tfoot>
         <tr class="rpt-foot">
           <td>Total</td>
           <td class="rpt-num rpt-total">${totalSmells || '–'}</td>
           <td class="rpt-num rpt-high">${totalHigh || '–'}</td>
           <td class="rpt-num rpt-med">${totalMed  || '–'}</td>
           <td class="rpt-num rpt-low">${totalLow  || '–'}</td>
           <td class="rpt-num">${allAffected.size || '–'}</td>
         </tr>
       </tfoot>
     </table>
     <p class="rpt-note">* "Files" = unique source files affected by each smell. The column total is the union across all smells.</p>`;

  document.getElementById('reportBody').innerHTML = html;
  document.getElementById('reportModal').style.display = 'flex';
}

function buildReportText() {
  const s = state;
  const has = s.hasCommits;
  const lines = [
    'ARCHITECTURE SMELLS REPORT',
    '==========================',
    `Files analysed      : ${s.fileMap.size}`,
    `Dependencies        : ${Array.from(s.depGraph.values()).reduce((a,s)=>a+s.size,0)}`,
    `commits.txt         : ${has ? 'yes' : 'no'}`,
    '',
    'Smell                  | Total | High | Medium | Low   | Files',
    '-----------------------+-------+------+--------+-------+-------',
  ];
  const rows = [
    { label: 'Cyclic Dependency',  total: s.cyclicSCCs.length,              files: s.cycleNodes.size,          modules: s.cyclicSCCs },
    { label: 'Hub-Like Dependency',total: s.hubModules.length,               files: s.hubNodePaths.size,        modules: s.hubModules },
    { label: 'God Component',      total: s.godModules.length,               files: s.godNodePaths.size,        modules: s.godModules },
    { label: 'Chatty Component',   total: s.chattyModules.length,            files: s.chattyNodePaths.size,     modules: s.chattyModules },
    { label: 'Hotspot',            total: has ? s.hotspotModules.length : null, files: s.hotspotNodePaths.size, modules: s.hotspotModules },
    { label: 'Arch Hotspot',       total: has ? s.archHotspotModules.length : null, files: s.archHotspotNodePaths.size, modules: s.archHotspotModules },
  ];
  rows.forEach(r => {
    const t = r.total ?? '–';
    const sev = r.modules.reduce ? { h: 0, m: 0, l: 0 } : { h: 0, m: 0, l: 0 };
    if (r.modules.reduce) r.modules.forEach(m => {
      const sv = m.sev || (Array.isArray(m) ? (m.length >= 5 ? 'high' : m.length >= 3 ? 'medium' : 'low') : 'low');
      if (sv === 'high') sev.h++; else if (sv === 'medium') sev.m++; else sev.l++;
    });
    const pad = (v, w) => String(v).padStart(w);
    lines.push(
      r.label.padEnd(22) + ' | ' + pad(t,5) + ' | ' + pad(sev.h||'–',4) + ' | ' +
      pad(sev.m||'–',6) + ' | ' + pad(sev.l||'–',5) + ' | ' + pad(r.files||'–',5)
    );
  });
  return lines.join('\n');
}

function buildReportLatex() {
  const s = state;
  const has = s.hasCommits;

  const escape = t => String(t)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/[&%$#_{}]/g, c => '\\' + c)
    .replace(/\^/g, '\\^{}')
    .replace(/~/g, '\\textasciitilde{}');

  const sevOf = (m, cyclic) => {
    if (cyclic) return m.length >= 5 ? 'high' : m.length >= 3 ? 'medium' : 'low';
    return m.sev || 'low';
  };

  const rows = [
    { label: 'Cyclic Dependency',   total: s.cyclicSCCs.length,                          files: s.cycleNodes.size,           modules: s.cyclicSCCs,          cyclic: true },
    { label: 'Hub-Like Dependency', total: s.hubModules.length,                           files: s.hubNodePaths.size,         modules: s.hubModules },
    { label: 'God Component',       total: s.godModules.length,                           files: s.godNodePaths.size,         modules: s.godModules },
    { label: 'Chatty Component',    total: s.chattyModules.length,                        files: s.chattyNodePaths.size,      modules: s.chattyModules },
    { label: 'Hotspot',             total: has ? s.hotspotModules.length     : null,      files: s.hotspotNodePaths.size,     modules: s.hotspotModules },
    { label: 'Arch Hotspot',        total: has ? s.archHotspotModules.length : null,      files: s.archHotspotNodePaths.size, modules: s.archHotspotModules },
  ];

  const bodyRows = rows.map(r => {
    if (r.total === null) {
      return `${escape(r.label)} & -- & \\multicolumn{3}{c|}{git log not found} & -- \\\\`;
    }
    const sev = { high: 0, medium: 0, low: 0 };
    r.modules.forEach(m => { sev[sevOf(m, r.cyclic)]++; });
    return `${escape(r.label)} & ${r.total || '--'} & ${sev.high || '--'} & ${sev.medium || '--'} & ${sev.low || '--'} & ${r.files || '--'} \\\\`;
  }).join('\n');

  const depCount = Array.from(s.depGraph.values()).reduce((a, v) => a + v.size, 0);
  const commitsLine = has
    ? '% commits.txt: yes'
    : '% commits.txt: no (run: git log --pretty=format:"\\%H \\%ai \\%an" --numstat > commits.txt)';

  const footerRow =
    `\\multicolumn{3}{l|}{\\small Files analysed: ${s.fileMap.size}} & ` +
    `\\multicolumn{3}{r}{\\small Dependencies: ${depCount}} \\\\`;

  return [
    commitsLine,
    '\\begin{tabular}{l|r|r|r|r|r}',
    '\\hline',
    '\\textbf{Smell} & \\textbf{Total} & \\textbf{High} & \\textbf{Medium} & \\textbf{Low} & \\textbf{Files} \\\\',
    '\\hline',
    bodyRows,
    '\\hline',
    footerRow,
    '\\hline',
    '\\end{tabular}',
  ].join('\n');
}

// ─────────────────────────────────────────
// Main flow
// ─────────────────────────────────────────
async function handleFiles(files) {
  if (!files || files.length === 0) return;
  showScreen('loading');
  state.currentSmell = 'cyclic';
  state.currentView  = 'all';

  try {
    const { fileCount, depCount } = await analyseFiles(files, setLoading);

    document.getElementById('statFiles').textContent   = fileCount;
    document.getElementById('statDeps').textContent    = depCount;
    document.getElementById('tabCyclic').textContent   = state.cyclicSCCs.length;
    document.getElementById('tabHub').textContent      = state.hubModules.length;
    document.getElementById('tabGod').textContent      = state.godModules.length;
    document.getElementById('tabChatty').textContent   = state.chattyModules.length;
    document.getElementById('tabHotspot').textContent  = state.hasCommits ? state.hotspotModules.length    : '–';
    document.getElementById('tabArch').textContent     = state.hasCommits ? state.archHotspotModules.length : '–';

    document.querySelectorAll('.smell-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.smell === 'cyclic'));

    updateStats();
    updateViewToggles();
    document.getElementById('listTitle').textContent = 'Detected Cycles';
    document.getElementById('listBadge').className   = 'list-badge cyclic';
    document.getElementById('listBadge').textContent = state.cyclicSCCs.length;

    showScreen('results');
    await tick();
    renderGraph();
    renderCurrentList();

  } catch (err) {
    console.error(err);
    alert('Error analysing files:\n' + err.message);
    showScreen('upload');
  }
}

// ─────────────────────────────────────────
// Event listeners
// All wired here — no onclick attributes in HTML
// ─────────────────────────────────────────

// Folder input
document.getElementById('folderInput').addEventListener('change', e => handleFiles(e.target.files));

// Drag-and-drop
const dz = document.getElementById('dropzone');
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', ()  => dz.classList.remove('over'));
dz.addEventListener('drop',      e  => { e.preventDefault(); dz.classList.remove('over'); handleFiles(e.dataTransfer.files); });

// Metric info modal — event delegation on smellList
document.getElementById('smellList').addEventListener('click', e => {
  const cell = e.target.closest('[data-metric]');
  if (cell) { e.stopPropagation(); openMetricModal(cell.dataset.metric); }
});

// Metric info modal — stat cards (e.g. Dependencies)
document.querySelector('.stats-bar').addEventListener('click', e => {
  const card = e.target.closest('[data-metric]');
  if (card) openMetricModal(card.dataset.metric);
});
document.getElementById('btnMiClose').addEventListener('click', closeMetricModal);
document.getElementById('metricInfoModal').addEventListener('click', e => {
  if (e.target === document.getElementById('metricInfoModal')) closeMetricModal();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  // Close topmost visible modal first
  if (document.getElementById('metricInfoModal').style.display !== 'none') {
    closeMetricModal();
  } else if (document.getElementById('settingsModal').style.display !== 'none') {
    closeSettings();
  }
});

// Report button
document.getElementById('btnReport').addEventListener('click', renderReport);
document.getElementById('btnReportClose').addEventListener('click', () => {
  document.getElementById('reportModal').style.display = 'none';
});
document.getElementById('reportModal').addEventListener('click', e => {
  if (e.target === document.getElementById('reportModal'))
    document.getElementById('reportModal').style.display = 'none';
});
document.getElementById('btnReportCopy').addEventListener('click', () => {
  const text = buildReportText();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btnReportCopy');
    const prev = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = prev; }, 1800);
  });
});
document.getElementById('btnReportLatex').addEventListener('click', () => {
  const tex = buildReportLatex();
  navigator.clipboard.writeText(tex).then(() => {
    const btn = document.getElementById('btnReportLatex');
    const prev = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = prev; }, 1800);
  });
});

// New analysis button
document.getElementById('btnNew').addEventListener('click', () => {
  showScreen('upload');
  document.getElementById('folderInput').value = '';
  state.selectedIdx = state.selectedHubIdx = state.selectedGodIdx =
    state.selectedChattyIdx = state.selectedHotspotIdx = state.selectedArchIdx = -1;
});

// Smell tab switching (event delegation on the tab strip)
document.querySelector('.smell-tabs').addEventListener('click', e => {
  const tab = e.target.closest('[data-smell]');
  if (tab) setSmell(tab.dataset.smell);
});

// View toggle buttons (event delegation — buttons are dynamically generated)
document.getElementById('viewToggleGroup').addEventListener('click', e => {
  const btn = e.target.closest('[data-view]');
  if (btn) setView(btn.dataset.view);
});

// Zoom buttons
document.querySelector('[data-zoom="in"]').addEventListener('click',    () => zoomBy(1.3));
document.querySelector('[data-zoom="out"]').addEventListener('click',   () => zoomBy(0.77));
document.querySelector('[data-zoom="reset"]').addEventListener('click', () => zoomReset());

// List view toggle (cards ↔ table)
document.getElementById('listViewToggle').addEventListener('click', e => {
  const btn = e.target.closest('[data-list-view]');
  if (!btn || btn.dataset.listView === listView) return;
  listView = btn.dataset.listView;
  state.selectedIdx = state.selectedHubIdx = state.selectedGodIdx =
    state.selectedChattyIdx = state.selectedHotspotIdx = state.selectedArchIdx = -1;
  resetGraphOpacity();
  updateListViewToggle();
  renderCurrentList();
});

// Table row click — highlight on graph (event delegation)
document.getElementById('smellList').addEventListener('click', e => {
  const row = e.target.closest('.smell-row');
  if (!row) return;
  const idx         = parseInt(row.dataset.idx, 10);
  const wasSelected = row.classList.contains('selected');
  document.querySelectorAll('.smell-row.selected').forEach(r => r.classList.remove('selected'));
  const highlight = {
    cyclic: highlightCycle, hub: highlightHub, god: highlightGod,
    chatty: highlightChatty, hotspot: highlightHotspot, arch: highlightArch,
  }[state.currentSmell];
  if (!highlight) return;
  highlight(wasSelected ? -1 : idx);
  if (!wasSelected) row.classList.add('selected');
});

// ─────────────────────────────────────────
// Settings modal — threshold editor
// ─────────────────────────────────────────
function openSettings() {
  // Populate inputs with current threshold values
  document.querySelectorAll('#settingsModal [data-key]').forEach(input => {
    input.value = thresholds[input.dataset.key];
  });
  document.getElementById('settingsModal').style.display = 'flex';
}

function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
}

function saveThreshold(key, rawValue) {
  const val = parseInt(rawValue, 10);
  if (!Number.isFinite(val) || val < 0) return;
  thresholds[key] = val;
  try {
    // Persist only values that differ from defaults
    const overrides = {};
    for (const k of Object.keys(THRESHOLD_DEFAULTS)) {
      if (thresholds[k] !== THRESHOLD_DEFAULTS[k]) overrides[k] = thresholds[k];
    }
    localStorage.setItem('arch-thresholds', JSON.stringify(overrides));
  } catch { /* storage unavailable */ }
}

function resetThresholds() {
  for (const [k, v] of Object.entries(THRESHOLD_DEFAULTS)) thresholds[k] = v;
  try { localStorage.removeItem('arch-thresholds'); } catch { /* ignore */ }
  document.querySelectorAll('#settingsModal [data-key]').forEach(input => {
    input.value = THRESHOLD_DEFAULTS[input.dataset.key];
  });
}

document.getElementById('btnSettings').addEventListener('click', openSettings);
document.getElementById('btnSettingsClose').addEventListener('click', closeSettings);
document.getElementById('settingsModal').addEventListener('click', e => {
  if (e.target === document.getElementById('settingsModal')) closeSettings();
});
document.getElementById('btnSettingsReset').addEventListener('click', resetThresholds);

// Auto-save on input change (event delegation)
document.getElementById('settingsModal').addEventListener('input', e => {
  const input = e.target.closest('[data-key]');
  if (input) saveThreshold(input.dataset.key, input.value);
});

// Smell info buttons (event delegation — open the metric info modal)
document.getElementById('settingsModal').addEventListener('click', e => {
  const btn = e.target.closest('[data-metric]');
  if (btn) { e.stopPropagation(); openMetricModal(btn.dataset.metric); }
});

// Click on empty SVG area → deselect
document.getElementById('graphSvg').addEventListener('click', e => {
  if (e.target.tagName.toLowerCase() === 'svg') {
    state.selectedIdx = state.selectedHubIdx = state.selectedGodIdx =
      state.selectedChattyIdx = state.selectedHotspotIdx = state.selectedArchIdx = -1;
    resetGraphOpacity();
    document.querySelectorAll('.smell-card, .smell-row').forEach(c => c.classList.remove('selected'));
  }
});
