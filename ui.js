// Current list presentation mode — module-level, persists across smell switches
let listView = 'cards'; // 'cards' | 'table'

import {
  state,
  HUB_MIN_IN, HUB_MIN_OUT,
  GOD_LOC_MED, GOD_FUNC_MED, GOD_EXP_MED,
  GOD_LOC_HIGH, GOD_FUNC_HIGH, GOD_EXP_HIGH, GOD_IMP_MIN,
  CHATTY_NAMED_MED, CHATTY_NAMED_HIGH, CHATTY_MAX_MED, CHATTY_MAX_HIGH,
  HOTSPOT_FREQ_MED, HOTSPOT_FREQ_HIGH, HOTSPOT_LOC_MED, HOTSPOT_LOC_HIGH,
  ARCH_CENTRALITY_MED, ARCH_CENTRALITY_HIGH,
} from './state.js';
import { analyseFiles, findCyclePath, tick } from './detectors.js';
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
    el.innerHTML = `<div class="no-results">
      <div class="no-results-icon">✅</div>
      <strong>Nenhum ciclo detectado!</strong>
      <p style="margin-top:8px;font-size:12px">O código não apresenta dependências cíclicas.</p>
    </div>`;
    return;
  }

  el.innerHTML = '';
  state.cyclicSCCs.forEach((scc, i) => {
    const sev   = scc.length >= 5 ? 'high' : scc.length >= 3 ? 'medium' : 'low';
    const label = { high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev];
    const path  = findCyclePath(scc);
    const names = path.map(p => p.split('/').pop());

    const pathHtml = names.map((n, k) =>
      k < names.length - 1
        ? `<div class="path-module"><span>${n}</span></div><div class="path-arrow">↓</div>`
        : `<div class="path-module"><span>${n}</span></div><div class="path-return">↩ volta para ${names[0]}</div>`
    ).join('');

    const card = document.createElement('div');
    card.className = 'smell-card cycle-card';
    card.title     = scc.join('\n');
    card.innerHTML =
      `<div class="card-head">
         <span class="sev-badge sev-${sev}">${label}</span>
         <span class="card-title">Ciclo #${i + 1}</span>
         <span class="card-count">${scc.length} módulo${scc.length > 1 ? 's' : ''}</span>
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

  if (state.hubModules.length === 0) {
    el.innerHTML = `<div class="no-results">
      <div class="no-results-icon">✅</div>
      <strong>Nenhum hub detectado!</strong>
      <p style="margin-top:8px;font-size:12px">
        Nenhum módulo concentra alto fan-in e fan-out.<br>
        <span style="font-size:10px;opacity:.7">(Limiar: fan-in ≥ ${HUB_MIN_IN} e fan-out ≥ ${HUB_MIN_OUT})</span>
      </p>
    </div>`;
    return;
  }

  el.innerHTML = '';
  const maxTotal = state.hubModules[0].total;

  state.hubModules.forEach(({ path, fanIn, fanOut, total, sev }, i) => {
    const label  = { high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev];
    const parts  = path.split('/');
    const name   = parts.pop();
    const dir    = parts.join('/') || '/';
    const inPct  = Math.round((fanIn  / maxTotal) * 100);
    const outPct = Math.round((fanOut / maxTotal) * 100);
    const isCycle = state.cycleNodes.has(path);

    const card = document.createElement('div');
    card.className = 'smell-card hub-card';
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         <span class="sev-badge sev-${sev}">${label}</span>
         <span class="card-title">${name}</span>
         <span class="card-count">${total} conexões</span>
       </div>
       <div class="hub-metrics">
         <div class="hub-metric">
           <div class="hub-metric-label"><span class="hub-dir-in">←</span> Fan-in</div>
           <div class="hub-bar-wrap"><div class="hub-bar-fill fan-in" style="width:${inPct}%"></div></div>
           <span class="hub-metric-val">${fanIn}</span>
         </div>
         <div class="hub-metric">
           <div class="hub-metric-label"><span class="hub-dir-out">→</span> Fan-out</div>
           <div class="hub-bar-wrap"><div class="hub-bar-fill fan-out" style="width:${outPct}%"></div></div>
           <span class="hub-metric-val">${fanOut}</span>
         </div>
       </div>
       <div class="hub-path-line">${dir}</div>
       ${isCycle ? `<div class="hub-also-cycle" style="font-size:10px;color:var(--red);margin-top:4px">⟳ Também participa de um ciclo</div>` : ''}`;

    card.addEventListener('click', () => {
      if (state.selectedHubIdx === i) { state.selectedHubIdx = -1; highlightHub(-1); }
      else highlightHub(i);
    });
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Render — God Component list
// ─────────────────────────────────────────
const METRIC_DEFS = [
  { key: 'loc',  icon: '≡', label: 'LOC',     getter: m => m.loc,         med: GOD_LOC_MED,  high: GOD_LOC_HIGH },
  { key: 'func', icon: 'ƒ', label: 'Funções',  getter: m => m.funcCount,   med: GOD_FUNC_MED, high: GOD_FUNC_HIGH },
  { key: 'exp',  icon: '↑', label: 'Exports',  getter: m => m.exportCount, med: GOD_EXP_MED,  high: GOD_EXP_HIGH },
  { key: 'imp',  icon: '↓', label: 'Imports',  getter: m => m.importCount, med: GOD_IMP_MIN,  high: null },
];

function renderGodList() {
  const el = document.getElementById('smellList');

  if (state.godModules.length === 0) {
    el.innerHTML = `<div class="no-results">
      <div class="no-results-icon">✅</div>
      <strong>Nenhum God Component detectado!</strong>
      <p style="margin-top:8px;font-size:12px">
        Nenhum módulo concentra responsabilidades excessivas.<br>
        <span style="font-size:10px;opacity:.7">(Limiares: ≥${GOD_LOC_MED} LOC, ≥${GOD_FUNC_MED} funções, ≥${GOD_EXP_MED} exports)</span>
      </p>
    </div>`;
    return;
  }

  el.innerHTML = '';

  state.godModules.forEach((mod, i) => {
    const { path, sev, score, flags } = mod;
    const label   = { high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev];
    const parts   = path.split('/');
    const name    = parts.pop();
    const dir     = parts.join('/') || '/';
    const isCycle = state.cycleNodes.has(path);
    const isHub   = state.hubNodePaths.has(path);

    const metricsHtml = METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="god-metric ${triggered ? 'triggered' : ''}">
        <span class="god-metric-icon">${def.icon}</span>
        <span class="god-metric-label">${def.label}</span>
        <span class="god-metric-val">${val}${levelLabel}</span>
      </div>`;
    }).join('');

    const alsoTags = [
      isCycle ? `<span class="god-also-tag cycle">⟳ Em ciclo</span>` : '',
      isHub   ? `<span class="god-also-tag hub">◎ É hub</span>`   : '',
    ].filter(Boolean).join('');

    const card = document.createElement('div');
    card.className = 'smell-card god-card';
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         <span class="sev-badge sev-${sev}">${label}</span>
         <span class="card-title">${name}</span>
         <span class="card-count">score ${score}</span>
       </div>
       <div class="god-metrics-grid">${metricsHtml}</div>
       <div class="god-path-line">${dir}</div>
       ${alsoTags ? `<div class="god-also">${alsoTags}</div>` : ''}`;

    card.addEventListener('click', () => {
      if (state.selectedGodIdx === i) { state.selectedGodIdx = -1; highlightGod(-1); }
      else highlightGod(i);
    });
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Render — Chatty Component list
// ─────────────────────────────────────────
const CHATTY_METRIC_DEFS = [
  { key: 'named', icon: '⇄', label: 'Símbolos',   getter: m => m.namedImports, med: CHATTY_NAMED_MED, high: CHATTY_NAMED_HIGH },
  { key: 'max',   icon: '↗', label: 'Max de 1 dep', getter: m => m.maxFromOne,   med: CHATTY_MAX_MED,   high: CHATTY_MAX_HIGH },
];

function renderChattyList() {
  const el = document.getElementById('smellList');

  if (state.chattyModules.length === 0) {
    el.innerHTML = `<div class="no-results">
      <div class="no-results-icon">✅</div>
      <strong>Nenhum Chatty Component detectado!</strong>
      <p style="margin-top:8px;font-size:12px">
        Nenhum módulo importa um volume excessivo de símbolos externos.<br>
        <span style="font-size:10px;opacity:.7">(Limiar: ≥${CHATTY_NAMED_MED} símbolos totais ou ≥${CHATTY_MAX_MED} de uma dep.)</span>
      </p>
    </div>`;
    return;
  }

  el.innerHTML = '';

  state.chattyModules.forEach((mod, i) => {
    const { path, sev, score, flags, topDep } = mod;
    const label   = { high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev];
    const parts   = path.split('/');
    const name    = parts.pop();
    const dir     = parts.join('/') || '/';
    const isCycle = state.cycleNodes.has(path);
    const isHub   = state.hubNodePaths.has(path);
    const isGod   = state.godNodePaths.has(path);

    const metricsHtml = CHATTY_METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="chatty-metric ${triggered ? 'triggered' : ''}">
        <span class="chatty-metric-icon">${def.icon}</span>
        <span class="chatty-metric-label">${def.label}</span>
        <span class="chatty-metric-val">${val}${levelLabel}</span>
      </div>`;
    }).join('');

    // Show which dependency contributes the most symbols
    const topDepShort = topDep
      ? topDep.split('/').pop().replace(/\.[jt]sx?$/, '')
      : '—';
    const topDepHtml = topDep
      ? `<div class="chatty-top-dep">↗ Principal: <span>${topDepShort}</span> (${mod.maxFromOne} símbolos)</div>`
      : '';

    const alsoTags = [
      isCycle ? `<span class="chatty-also-tag cycle">⟳ Em ciclo</span>` : '',
      isHub   ? `<span class="chatty-also-tag hub">◎ É hub</span>`    : '',
      isGod   ? `<span class="chatty-also-tag god">⊕ God component</span>` : '',
    ].filter(Boolean).join('');

    const card = document.createElement('div');
    card.className = 'smell-card chatty-card';
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         <span class="sev-badge sev-${sev}">${label}</span>
         <span class="card-title">${name}</span>
         <span class="card-count">score ${score}</span>
       </div>
       <div class="chatty-metrics-grid">${metricsHtml}</div>
       ${topDepHtml}
       <div class="chatty-path-line">${dir}</div>
       ${alsoTags ? `<div class="chatty-also">${alsoTags}</div>` : ''}`;

    card.addEventListener('click', () => {
      if (state.selectedChattyIdx === i) { state.selectedChattyIdx = -1; highlightChatty(-1); }
      else highlightChatty(i);
    });
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Render — Hotspot list
// ─────────────────────────────────────────
const HOTSPOT_METRIC_DEFS = [
  { key: 'freq', icon: '↻', label: 'Commits',  getter: m => m.commitCount, med: HOTSPOT_FREQ_MED, high: HOTSPOT_FREQ_HIGH },
  { key: 'loc',  icon: '≡', label: 'LOC',      getter: m => m.loc,         med: HOTSPOT_LOC_MED,  high: HOTSPOT_LOC_HIGH  },
];

function renderHotspotList() {
  const el = document.getElementById('smellList');

  if (!state.hasCommits) {
    el.innerHTML = `<div class="no-results">
      <div class="no-results-icon">📄</div>
      <strong>commits.txt não encontrado</strong>
      <p style="margin-top:8px;font-size:12px">
        Inclua um arquivo <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">commits.txt</code>
        na raiz do projeto para habilitar a detecção de Hotspots.
      </p>
    </div>`;
    return;
  }

  if (state.hotspotModules.length === 0) {
    el.innerHTML = `<div class="no-results">
      <div class="no-results-icon">✅</div>
      <strong>Nenhum Hotspot detectado!</strong>
      <p style="margin-top:8px;font-size:12px">
        Nenhum arquivo combina alta frequência de mudanças com grande tamanho.<br>
        <span style="font-size:10px;opacity:.7">(Limiar: ≥${HOTSPOT_FREQ_MED} commits e ≥${HOTSPOT_LOC_MED} LOC)</span>
      </p>
    </div>`;
    return;
  }

  el.innerHTML = '';

  state.hotspotModules.forEach((mod, i) => {
    const { path, sev, score, flags, linesChanged } = mod;
    const label  = { high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev];
    const parts  = path.split('/');
    const name   = parts.pop();
    const dir    = parts.join('/') || '/';

    const metricsHtml = HOTSPOT_METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="hotspot-metric ${triggered ? 'triggered' : ''}">
        <span class="hotspot-metric-icon">${def.icon}</span>
        <span class="hotspot-metric-label">${def.label}</span>
        <span class="hotspot-metric-val">${val}${levelLabel}</span>
      </div>`;
    }).join('');

    const isCycle = state.cycleNodes.has(path);
    const isHub   = state.hubNodePaths.has(path);
    const isGod   = state.godNodePaths.has(path);
    const alsoTags = [
      isCycle ? `<span class="hotspot-also-tag cycle">⟳ Em ciclo</span>`        : '',
      isHub   ? `<span class="hotspot-also-tag hub">◎ É hub</span>`             : '',
      isGod   ? `<span class="hotspot-also-tag god">⊕ God component</span>`     : '',
    ].filter(Boolean).join('');

    const card = document.createElement('div');
    card.className = 'smell-card hotspot-card';
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         <span class="sev-badge sev-${sev}">${label}</span>
         <span class="card-title">${name}</span>
         <span class="card-count">score ${score}</span>
       </div>
       <div class="hotspot-metrics-grid">${metricsHtml}</div>
       <div class="hotspot-lines-changed">± ${linesChanged} linhas alteradas no total</div>
       <div class="hotspot-path-line">${dir}</div>
       ${alsoTags ? `<div class="hotspot-also">${alsoTags}</div>` : ''}`;

    card.addEventListener('click', () => {
      if (state.selectedHotspotIdx === i) { state.selectedHotspotIdx = -1; highlightHotspot(-1); }
      else highlightHotspot(i);
    });
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Render — Architectural Hotspot list
// ─────────────────────────────────────────
const ARCH_METRIC_DEFS = [
  { key: 'freq',       icon: '↻', label: 'Commits',       getter: m => m.commitCount, med: HOTSPOT_FREQ_MED,    high: HOTSPOT_FREQ_HIGH    },
  { key: 'centrality', icon: '⟺', label: 'Centralidade',  getter: m => m.centrality,  med: ARCH_CENTRALITY_MED, high: ARCH_CENTRALITY_HIGH },
  { key: 'loc',        icon: '≡', label: 'LOC',           getter: m => m.loc,         med: HOTSPOT_LOC_MED,     high: HOTSPOT_LOC_HIGH     },
];

function renderArchList() {
  const el = document.getElementById('smellList');

  if (!state.hasCommits) {
    el.innerHTML = `<div class="no-results">
      <div class="no-results-icon">📄</div>
      <strong>commits.txt não encontrado</strong>
      <p style="margin-top:8px;font-size:12px">
        Inclua um arquivo <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">commits.txt</code>
        na raiz do projeto para habilitar a detecção de Architectural Hotspots.
      </p>
    </div>`;
    return;
  }

  if (state.archHotspotModules.length === 0) {
    el.innerHTML = `<div class="no-results">
      <div class="no-results-icon">✅</div>
      <strong>Nenhum Architectural Hotspot detectado!</strong>
      <p style="margin-top:8px;font-size:12px">
        Nenhum arquivo combina frequência de mudanças, centralidade de dependências e tamanho.<br>
        <span style="font-size:10px;opacity:.7">(Limiar: ≥${HOTSPOT_FREQ_MED} commits, ≥${ARCH_CENTRALITY_MED} centralidade ou ≥${HOTSPOT_LOC_MED} LOC)</span>
      </p>
    </div>`;
    return;
  }

  el.innerHTML = '';

  state.archHotspotModules.forEach((mod, i) => {
    const { path, sev, score, flags, fanIn, fanOut } = mod;
    const label  = { high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev];
    const parts  = path.split('/');
    const name   = parts.pop();
    const dir    = parts.join('/') || '/';

    const metricsHtml = ARCH_METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="arch-metric ${triggered ? 'triggered' : ''}">
        <span class="arch-metric-icon">${def.icon}</span>
        <span class="arch-metric-label">${def.label}</span>
        <span class="arch-metric-val">${val}${levelLabel}</span>
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
      isCycle ? `<span class="arch-also-tag cycle">⟳ Em ciclo</span>` : '',
      isHub   ? `<span class="arch-also-tag hub">◎ É hub</span>`     : '',
    ].filter(Boolean).join('');

    const card = document.createElement('div');
    card.className = 'smell-card arch-card';
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         <span class="sev-badge sev-${sev}">${label}</span>
         <span class="card-title">${name}</span>
         <span class="card-count">score ${score}</span>
       </div>
       <div class="arch-metrics-grid">${metricsHtml}</div>
       ${fanLine}
       <div class="arch-path-line">${dir}</div>
       ${alsoTags ? `<div class="arch-also">${alsoTags}</div>` : ''}`;

    card.addEventListener('click', () => {
      if (state.selectedArchIdx === i) { state.selectedArchIdx = -1; highlightArch(-1); }
      else highlightArch(i);
    });
    el.appendChild(card);
  });
}

// ─────────────────────────────────────────
// Table renders
// One per smell; fall back to card render when list is empty / commits absent.
// ─────────────────────────────────────────
const SEV_LABEL = { high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' };

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
    { label: 'Módulos' },
    { label: 'N', r: true, w: '28px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

function renderHubTable() {
  const el = document.getElementById('smellList');
  if (!state.hubModules.length) { el.classList.remove('table-mode'); renderHubList(); return; }

  const rows = state.hubModules.map((m, i) =>
    `<tr class="smell-row" data-idx="${i}" title="${m.path}">
      <td class="td-file">${m.path.split('/').pop()}</td>
      <td class="td-val">${m.fanIn}</td>
      <td class="td-val">${m.fanOut}</td>
      <td class="td-val">${m.total}</td>
      <td class="td-sev"><span class="sev-badge sev-${m.sev}">${SEV_LABEL[m.sev]}</span></td>
    </tr>`
  ).join('');

  buildTable(el, [
    { label: 'Arquivo' },
    { label: 'In',    r: true, w: '34px' },
    { label: 'Out',   r: true, w: '34px' },
    { label: 'Total', r: true, w: '44px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

function renderGodTable() {
  const el = document.getElementById('smellList');
  if (!state.godModules.length) { el.classList.remove('table-mode'); renderGodList(); return; }

  const rows = state.godModules.map((m, i) =>
    `<tr class="smell-row" data-idx="${i}" title="${m.path}">
      <td class="td-file">${m.path.split('/').pop()}</td>
      <td class="td-val">${m.loc}</td>
      <td class="td-val">${m.funcCount}</td>
      <td class="td-val">${m.exportCount}</td>
      <td class="td-val">${m.score}</td>
      <td class="td-sev"><span class="sev-badge sev-${m.sev}">${SEV_LABEL[m.sev]}</span></td>
    </tr>`
  ).join('');

  buildTable(el, [
    { label: 'Arquivo' },
    { label: 'LOC',   r: true, w: '42px' },
    { label: 'ƒ',     r: true, w: '28px' },
    { label: '↑',     r: true, w: '28px' },
    { label: 'Score', r: true, w: '44px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

function renderChattyTable() {
  const el = document.getElementById('smellList');
  if (!state.chattyModules.length) { el.classList.remove('table-mode'); renderChattyList(); return; }

  const rows = state.chattyModules.map((m, i) =>
    `<tr class="smell-row" data-idx="${i}" title="${m.path}">
      <td class="td-file">${m.path.split('/').pop()}</td>
      <td class="td-val">${m.namedImports}</td>
      <td class="td-val">${m.maxFromOne}</td>
      <td class="td-val">${m.score}</td>
      <td class="td-sev"><span class="sev-badge sev-${m.sev}">${SEV_LABEL[m.sev]}</span></td>
    </tr>`
  ).join('');

  buildTable(el, [
    { label: 'Arquivo' },
    { label: 'Símbolos', r: true, w: '60px' },
    { label: 'Max 1',   r: true, w: '46px' },
    { label: 'Score',   r: true, w: '44px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

function renderHotspotTable() {
  const el = document.getElementById('smellList');
  if (!state.hasCommits || !state.hotspotModules.length) { el.classList.remove('table-mode'); renderHotspotList(); return; }

  const rows = state.hotspotModules.map((m, i) =>
    `<tr class="smell-row" data-idx="${i}" title="${m.path}">
      <td class="td-file">${m.path.split('/').pop()}</td>
      <td class="td-val">${m.commitCount}</td>
      <td class="td-val">${m.loc}</td>
      <td class="td-val">${m.score}</td>
      <td class="td-sev"><span class="sev-badge sev-${m.sev}">${SEV_LABEL[m.sev]}</span></td>
    </tr>`
  ).join('');

  buildTable(el, [
    { label: 'Arquivo' },
    { label: 'Commits', r: true, w: '54px' },
    { label: 'LOC',     r: true, w: '42px' },
    { label: 'Score',   r: true, w: '44px' },
    { label: 'Sev', w: '60px' },
  ], rows);
}

function renderArchTable() {
  const el = document.getElementById('smellList');
  if (!state.hasCommits || !state.archHotspotModules.length) { el.classList.remove('table-mode'); renderArchList(); return; }

  const rows = state.archHotspotModules.map((m, i) =>
    `<tr class="smell-row" data-idx="${i}" title="${m.path}">
      <td class="td-file">${m.path.split('/').pop()}</td>
      <td class="td-val">${m.commitCount}</td>
      <td class="td-val">${m.centrality}</td>
      <td class="td-val">${m.loc}</td>
      <td class="td-val">${m.score}</td>
      <td class="td-sev"><span class="sev-badge sev-${m.sev}">${SEV_LABEL[m.sev]}</span></td>
    </tr>`
  ).join('');

  buildTable(el, [
    { label: 'Arquivo' },
    { label: 'Commits',   r: true, w: '54px' },
    { label: 'Central.',  r: true, w: '54px' },
    { label: 'LOC',       r: true, w: '42px' },
    { label: 'Score',     r: true, w: '44px' },
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
    cyclic:  { title: 'Ciclos Detectados',                 cls: 'cyclic',  count: state.cyclicSCCs.length         },
    hub:     { title: 'Hubs Detectados',                   cls: 'hub',     count: state.hubModules.length         },
    god:     { title: 'God Components Detectados',         cls: 'god',     count: state.godModules.length         },
    chatty:  { title: 'Chatty Components Detectados',      cls: 'chatty',  count: state.chattyModules.length      },
    hotspot: { title: 'Hotspots Detectados',               cls: 'hotspot', count: state.hotspotModules.length     },
    arch:    { title: 'Architectural Hotspots Detectados', cls: 'arch',    count: state.archHotspotModules.length },
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
    cyclic:  { c3: 'danger',   v3: state.cyclicSCCs.length,          l3: 'Ciclos',
               c4: 'warning',  v4: state.cycleNodes.size,             l4: 'Módulos Afetados' },
    hub:     { c3: 'warning',  v3: state.hubModules.length,           l3: 'Hubs',
               c4: 'info',     v4: state.hubModules[0]?.total ?? 0,   l4: 'Max Conexões' },
    god:     { c3: 'teal',     v3: state.godModules.length,           l3: 'God Components',
               c4: 'teal',     v4: state.godModules[0]?.score ?? 0,   l4: 'Max Score' },
    chatty:  { c3: 'yellow',   v3: state.chattyModules.length,        l3: 'Chatty Components',
               c4: 'yellow',   v4: state.chattyModules[0]?.namedImports ?? 0, l4: 'Max Símbolos' },
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
    cyclic:  { view: 'cycles',    label: 'Apenas Ciclos'            },
    hub:     { view: 'hubs',      label: 'Apenas Hubs'              },
    god:     { view: 'gods',      label: 'Apenas God Components'    },
    chatty:  { view: 'chatty',    label: 'Apenas Chatty Components' },
    hotspot: { view: 'hotspots',  label: 'Apenas Hotspots'          },
    arch:    { view: 'archs',     label: 'Apenas Arch Hotspots'     },
  }[state.currentSmell];

  document.getElementById('viewToggleGroup').innerHTML =
    `<button class="toggle ${state.currentView === 'all'     ? 'active' : ''}" data-view="all">${'Todos os Módulos'}</button>
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

  const naCol  = `<td class="rpt-na" colspan="3">requer commits.txt</td>`;

  const bodyRows = rows.map(r => {
    const na = r.total === null;
    const sevCols = na ? naCol :
      `<td class="rpt-num rpt-high">${r.sevs.high   || '–'}</td>
       <td class="rpt-num rpt-med" >${r.sevs.medium || '–'}</td>
       <td class="rpt-num rpt-low" >${r.sevs.low    || '–'}</td>`;
    const totalCell = na ? '–' : (r.total || '–');
    const filesCell = na ? '–' : (r.files || '–');
    return `<tr>
      <td class="rpt-smell"><span class="rpt-dot rpt-dot-${r.color}"></span>${r.icon} ${r.label}</td>
      <td class="rpt-num rpt-total">${totalCell}</td>
      ${sevCols}
      <td class="rpt-num">${filesCell}</td>
    </tr>`;
  }).join('');

  const html =
    `<div class="rpt-meta">
       <span class="rpt-meta-item">📁 ${s.fileMap.size} arquivos analisados</span>
       <span class="rpt-meta-item">🔗 ${Array.from(s.depGraph.values()).reduce((a,s)=>a+s.size,0)} dependências</span>
       ${s.hasCommits ? '<span class="rpt-meta-item">📜 commits.txt incluído</span>' : '<span class="rpt-meta-item rpt-meta-warn">⚠ sem commits.txt</span>'}
     </div>
     <table class="rpt-table">
       <thead>
         <tr>
           <th>Smell</th>
           <th class="rpt-num">Total</th>
           <th class="rpt-num rpt-high">Alto</th>
           <th class="rpt-num rpt-med">Médio</th>
           <th class="rpt-num rpt-low">Baixo</th>
           <th class="rpt-num">Arquivos</th>
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
     <p class="rpt-note">* "Arquivos" = arquivos-fonte únicos afetados por cada smell. O total da coluna é a união de todos os smells.</p>`;

  document.getElementById('reportBody').innerHTML = html;
  document.getElementById('reportModal').style.display = 'flex';
}

function buildReportText() {
  const s = state;
  const has = s.hasCommits;
  const lines = [
    'RELATÓRIO DE ARCHITECTURE SMELLS',
    '=================================',
    `Arquivos analisados : ${s.fileMap.size}`,
    `Dependências        : ${Array.from(s.depGraph.values()).reduce((a,s)=>a+s.size,0)}`,
    `commits.txt         : ${has ? 'sim' : 'não'}`,
    '',
    'Smell                  | Total | Alto | Médio | Baixo | Arquivos',
    '-----------------------+-------+------+-------+-------+---------',
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
      pad(sev.m||'–',5) + ' | ' + pad(sev.l||'–',5) + ' | ' + pad(r.files||'–',7)
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
      return `${escape(r.label)} & -- & \\multicolumn{3}{c|}{requer commits.txt} & -- \\\\`;
    }
    const sev = { high: 0, medium: 0, low: 0 };
    r.modules.forEach(m => { sev[sevOf(m, r.cyclic)]++; });
    return `${escape(r.label)} & ${r.total || '--'} & ${sev.high || '--'} & ${sev.medium || '--'} & ${sev.low || '--'} & ${r.files || '--'} \\\\`;
  }).join('\n');

  return [
    '\\begin{tabular}{l|r|r|r|r|r}',
    '\\hline',
    '\\textbf{Smell} & \\textbf{Total} & \\textbf{Alto} & \\textbf{M\\\'edio} & \\textbf{Baixo} & \\textbf{Arquivos} \\\\',
    '\\hline',
    bodyRows,
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
    document.getElementById('listTitle').textContent = 'Ciclos Detectados';
    document.getElementById('listBadge').className   = 'list-badge cyclic';
    document.getElementById('listBadge').textContent = state.cyclicSCCs.length;

    showScreen('results');
    await tick();
    renderGraph();
    renderCurrentList();

  } catch (err) {
    console.error(err);
    alert('Erro ao analisar os arquivos:\n' + err.message);
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
    btn.textContent = '✓ Copiado!';
    setTimeout(() => { btn.textContent = prev; }, 1800);
  });
});
document.getElementById('btnReportLatex').addEventListener('click', () => {
  const tex = buildReportLatex();
  navigator.clipboard.writeText(tex).then(() => {
    const btn = document.getElementById('btnReportLatex');
    const prev = btn.textContent;
    btn.textContent = '✓ Copiado!';
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

// Click on empty SVG area → deselect
document.getElementById('graphSvg').addEventListener('click', e => {
  if (e.target.tagName.toLowerCase() === 'svg') {
    state.selectedIdx = state.selectedHubIdx = state.selectedGodIdx =
      state.selectedChattyIdx = state.selectedHotspotIdx = state.selectedArchIdx = -1;
    resetGraphOpacity();
    document.querySelectorAll('.smell-card, .smell-row').forEach(c => c.classList.remove('selected'));
  }
});
