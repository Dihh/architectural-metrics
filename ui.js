// Current list presentation mode — module-level, persists across smell switches
let listView = 'cards'; // 'cards' | 'table'

// ─────────────────────────────────────────
// Metric info definitions (used by modal)
// ─────────────────────────────────────────
const METRIC_INFO = {
  loc: {
    icon: '≡',
    title: 'LOC — Lines of Code',
    desc: `<p><strong>Linhas de código</strong> não vazias e sem comentários puros no arquivo.</p>
           <p>É o indicador mais básico de tamanho. Arquivos muito grandes tendem a acumular múltiplas responsabilidades que deveriam ser separadas em módulos menores — violando o <em>Princípio da Responsabilidade Única</em>.</p>`,
    thresholds: [{ label: '≥ 300 linhas', cls: 'med' }, { label: '≥ 500 linhas', cls: 'high' }],
  },
  func: {
    icon: 'ƒ',
    title: 'Funções declaradas',
    desc: `<p>Contagem de <strong>declarações <code>function</code></strong> e <strong>arrow functions</strong> <code>=></code> no arquivo.</p>
           <p>Um módulo com muitas funções está provavelmente fazendo mais do que deveria. Cada função adicional aumenta a carga cognitiva de quem lê o código.</p>`,
    thresholds: [{ label: '≥ 15 funções', cls: 'med' }, { label: '≥ 25 funções', cls: 'high' }],
  },
  exp: {
    icon: '↑',
    title: 'Exports — Interface Pública',
    desc: `<p>Número de <strong>símbolos exportados</strong> pelo módulo (<code>export const</code>, <code>export function</code>, <code>export class</code>, etc.).</p>
           <p>Uma interface pública muito grande pode indicar falta de coesão — o módulo expõe demais para o mundo externo, tornando-se difícil de substituir ou refatorar.</p>`,
    thresholds: [{ label: '≥ 6 exports', cls: 'med' }, { label: '≥ 12 exports', cls: 'high' }],
  },
  imp: {
    icon: '↓',
    title: 'Fan-out — Dependências de Saída',
    desc: `<p>Quantidade de <strong>módulos que este arquivo importa</strong> diretamente.</p>
           <p>Alto fan-out indica forte acoplamento de saída: o arquivo depende de muitos outros. Isso dificulta testes isolados e aumenta a probabilidade de quebrar quando qualquer dependência muda.</p>`,
    thresholds: [{ label: '≥ 10 imports', cls: 'med' }],
  },
  'fan-in': {
    icon: '←',
    title: 'Fan-in — Dependências de Entrada',
    desc: `<p>Quantidade de <strong>módulos que importam este arquivo</strong>.</p>
           <p>Alto fan-in significa que muitos outros módulos dependem deste. Mudanças nele podem propagar impactos por toda a base de código. Quando combinado com alto fan-out, forma um <em>Hub</em> — ponto crítico de acoplamento.</p>`,
    thresholds: [{ label: `≥ 3 fan-in (Hub: total ≥ 8)`, cls: 'med' }],
  },
  'fan-out': {
    icon: '→',
    title: 'Fan-out — Dependências de Saída',
    desc: `<p>Quantidade de <strong>módulos que este arquivo importa</strong> diretamente.</p>
           <p>Alto fan-out indica que o módulo depende de muitas partes do sistema. Quando combinado com alto fan-in, forma um <em>Hub</em> — ponto crítico de acoplamento bidirecional.</p>`,
    thresholds: [{ label: `≥ 3 fan-out (Hub: total ≥ 8)`, cls: 'med' }],
  },
  named: {
    icon: '⇄',
    title: 'Símbolos Importados',
    desc: `<p>Total de <strong>símbolos nomeados</strong> importados via destructuring <code>{ a, b, c }</code> em todos os imports do arquivo.</p>
           <p>Alta contagem indica que o componente consome fortemente as interfaces de seus dependentes, tornando-o frágil a mudanças nas APIs externas.</p>`,
    thresholds: [{ label: '≥ 15 símbolos', cls: 'med' }, { label: '≥ 30 símbolos', cls: 'high' }],
  },
  max: {
    icon: '↗',
    title: 'Máx. de uma Dependência',
    desc: `<p>O maior número de símbolos importados de <strong>uma única dependência</strong>.</p>
           <p>Indica acoplamento forte e específico — o componente depende intensamente de um único módulo. Se esse módulo mudar sua API, o impacto será grande.</p>`,
    thresholds: [{ label: '≥ 6 símbolos', cls: 'med' }, { label: '≥ 10 símbolos', cls: 'high' }],
  },
  freq: {
    icon: '↻',
    title: 'Commits — Frequência de Mudanças',
    desc: `<p>Número de <strong>commits que modificaram este arquivo</strong> no histórico git.</p>
           <p>Alta frequência de mudanças em um arquivo grande é o sinal clássico de <em>hotspot</em>: uma área do sistema que o time precisa tocar constantemente, acumulando dívida técnica.</p>
           <p>Gere o arquivo com: <code>git log --pretty=format:"%H %ai %an" --numstat > commits.txt</code></p>`,
    thresholds: [{ label: '≥ 10 commits', cls: 'med' }, { label: '≥ 25 commits', cls: 'high' }],
  },
  centrality: {
    icon: '⟺',
    title: 'Centralidade — Importância na Rede',
    desc: `<p>Soma de <strong>fan-in + fan-out</strong> do módulo. Mede o quão central ele é na rede de dependências do projeto.</p>
           <p>Alta centralidade significa que o módulo conecta muitas partes do sistema. Quando combinada com alta frequência de mudanças e grande tamanho, indica um <em>Architectural Hotspot</em> — o risco arquitetural mais grave.</p>`,
    thresholds: [{ label: '≥ 8 conexões', cls: 'med' }, { label: '≥ 15 conexões', cls: 'high' }],
  },
  deps: {
    icon: '🔗',
    title: 'Dependências — Total de Arestas',
    desc: `<p>Número total de <strong>conexões direcionadas únicas</strong> entre arquivos do projeto — ou seja, cada relação "<em>arquivo A importa arquivo B</em>" resolvida com sucesso conta como uma dependência.</p>
           <p>Importações duplicadas dentro do mesmo arquivo são contadas apenas uma vez (o grafo usa <code>Set</code> internamente). Imports para bibliotecas externas ou caminhos não resolvidos <strong>não</strong> são incluídos.</p>
           <p>Esse número representa o tamanho do grafo de dependências e dá uma ideia geral do <strong>nível de acoplamento</strong> do projeto.</p>`,
    thresholds: [],
  },
};

function openMetricModal(key) {
  const info = METRIC_INFO[key];
  if (!info) return;

  document.getElementById('miIcon').textContent  = info.icon;
  document.getElementById('miTitle').textContent = info.title;

  const thresholdsHtml = info.thresholds?.length
    ? `<div class="mi-thresholds">
         <div class="mi-thresholds-title">Limiares de detecção</div>
         <div class="mi-thr-row">
           ${info.thresholds.map(t => `<span class="mi-thr-chip ${t.cls}">${t.label}</span>`).join('')}
         </div>
       </div>`
    : '';

  document.getElementById('miBody').innerHTML = info.desc + thresholdsHtml;
  document.getElementById('metricInfoModal').style.display = 'flex';
}

function closeMetricModal() {
  document.getElementById('metricInfoModal').style.display = 'none';
}

import {
  state,
  HUB_MIN_IN, HUB_MIN_OUT, HUB_MIN_TOTAL,
  GOD_LOC_MED, GOD_FUNC_MED, GOD_EXP_MED,
  GOD_LOC_HIGH, GOD_FUNC_HIGH, GOD_EXP_HIGH, GOD_IMP_MIN,
  CHATTY_NAMED_MED, CHATTY_NAMED_HIGH, CHATTY_MAX_MED, CHATTY_MAX_HIGH,
  HOTSPOT_FREQ_MED, HOTSPOT_FREQ_HIGH, HOTSPOT_LOC_MED, HOTSPOT_LOC_HIGH,
  ARCH_CENTRALITY_MED, ARCH_CENTRALITY_HIGH,
} from './state.js';
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
        Detectado via algoritmo de Tarjan (SCC ≥ 2 nós)
      </div>
      <div class="no-results">
        <div class="no-results-icon">✅</div>
        <strong>Nenhum ciclo detectado!</strong>
        <p style="margin-top:8px;font-size:12px">O código não apresenta dependências cíclicas.</p>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="threshold-info">
    Algoritmo de Tarjan — reporta ciclos com ≥ 2 módulos · Severidade por tamanho do ciclo: ≥ 5 módulos = ALTO · ≥ 3 = MÉDIO · 2 módulos = BAIXO
  </div>`;
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
  el.innerHTML = `<div class="threshold-info">
    Limiar: fan-in ≥ <strong>${HUB_MIN_IN}</strong> · fan-out ≥ <strong>${HUB_MIN_OUT}</strong> · total ≥ <strong>${HUB_MIN_TOTAL}</strong>
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
      ? `<span class="sev-badge sev-${sev}">${{ high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev]}</span>`
      : `<span class="sev-badge sev-normal">—</span>`;

    const card = document.createElement('div');
    card.className = `smell-card hub-card${isSmelly ? '' : ' normal'}`;
    card.title     = path;
    card.innerHTML =
      `<div class="card-head">
         ${badgeHtml}
         <span class="card-title">${name}</span>
         <span class="card-count">${total} conexões</span>
       </div>
       <div class="hub-metrics">
         <div class="hub-metric metric-clickable" data-metric="fan-in">
           <div class="hub-metric-label"><span class="hub-dir-in">←</span> Fan-in <span class="metric-info-btn" aria-label="Saiba mais">i</span></div>
           <div class="hub-bar-wrap"><div class="hub-bar-fill fan-in" style="width:${inPct}%"></div></div>
           <span class="hub-metric-val">${fanIn}</span>
         </div>
         <div class="hub-metric metric-clickable" data-metric="fan-out">
           <div class="hub-metric-label"><span class="hub-dir-out">→</span> Fan-out <span class="metric-info-btn" aria-label="Saiba mais">i</span></div>
           <div class="hub-bar-wrap"><div class="hub-bar-fill fan-out" style="width:${outPct}%"></div></div>
           <span class="hub-metric-val">${fanOut}</span>
         </div>
       </div>
       <div class="hub-path-line">${dir}</div>
       ${isCycle ? `<div class="hub-also-cycle" style="font-size:10px;color:var(--red);margin-top:4px">⟳ Também participa de um ciclo</div>` : ''}`;

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
  { key: 'loc',  icon: '≡', label: 'LOC',     getter: m => m.loc,         med: GOD_LOC_MED,  high: GOD_LOC_HIGH },
  { key: 'func', icon: 'ƒ', label: 'Funções',  getter: m => m.funcCount,   med: GOD_FUNC_MED, high: GOD_FUNC_HIGH },
  { key: 'exp',  icon: '↑', label: 'Exports',  getter: m => m.exportCount, med: GOD_EXP_MED,  high: GOD_EXP_HIGH },
  { key: 'imp',  icon: '↓', label: 'Imports',  getter: m => m.importCount, med: GOD_IMP_MIN,  high: null },
];

function renderGodList() {
  const el = document.getElementById('smellList');
  el.innerHTML = `<div class="threshold-info">
    Limiar: LOC ≥ <strong>${GOD_LOC_MED}</strong> · funções ≥ <strong>${GOD_FUNC_MED}</strong> · exports ≥ <strong>${GOD_EXP_MED}</strong> · imports ≥ <strong>${GOD_IMP_MIN}</strong>
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
      ? `<span class="sev-badge sev-${sev}">${{ high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev]}</span>`
      : `<span class="sev-badge sev-normal">—</span>`;

    const metricsHtml = METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = isSmelly && !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="god-metric metric-clickable ${triggered ? 'triggered' : ''}" data-metric="${def.key}">
        <span class="god-metric-icon">${def.icon}</span>
        <span class="god-metric-label">${def.label}</span>
        <span class="god-metric-val">${val}${levelLabel}</span>
        <span class="metric-info-btn" aria-label="Saiba mais">i</span>
      </div>`;
    }).join('');

    const alsoTags = [
      isCycle ? `<span class="god-also-tag cycle">⟳ Em ciclo</span>` : '',
      isHub   ? `<span class="god-also-tag hub">◎ É hub</span>`      : '',
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
  { key: 'named', icon: '⇄', label: 'Símbolos',   getter: m => m.namedImports, med: CHATTY_NAMED_MED, high: CHATTY_NAMED_HIGH },
  { key: 'max',   icon: '↗', label: 'Max de 1 dep', getter: m => m.maxFromOne,   med: CHATTY_MAX_MED,   high: CHATTY_MAX_HIGH },
];

function renderChattyList() {
  const el = document.getElementById('smellList');
  el.innerHTML = `<div class="threshold-info">
    Limiar: símbolos totais ≥ <strong>${CHATTY_NAMED_MED}</strong> · ou máx. de uma dep ≥ <strong>${CHATTY_MAX_MED}</strong>
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
      ? `<span class="sev-badge sev-${sev}">${{ high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev]}</span>`
      : `<span class="sev-badge sev-normal">—</span>`;

    const metricsHtml = CHATTY_METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = isSmelly && !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="chatty-metric metric-clickable ${triggered ? 'triggered' : ''}" data-metric="${def.key}">
        <span class="chatty-metric-icon">${def.icon}</span>
        <span class="chatty-metric-label">${def.label}</span>
        <span class="chatty-metric-val">${val}${levelLabel}</span>
        <span class="metric-info-btn" aria-label="Saiba mais">i</span>
      </div>`;
    }).join('');

    const topDepShort = topDep
      ? topDep.split('/').pop().replace(/\.[jt]sx?$/, '')
      : '—';
    const topDepHtml = topDep
      ? `<div class="chatty-top-dep">↗ Principal: <span>${topDepShort}</span> (${mod.maxFromOne} símbolos)</div>`
      : '';

    const alsoTags = [
      isCycle ? `<span class="chatty-also-tag cycle">⟳ Em ciclo</span>`     : '',
      isHub   ? `<span class="chatty-also-tag hub">◎ É hub</span>`          : '',
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

  el.innerHTML = `<div class="threshold-info">
    Limiar: commits ≥ <strong>${HOTSPOT_FREQ_MED}</strong> · LOC ≥ <strong>${HOTSPOT_LOC_MED}</strong> (ambos devem ser atingidos)
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
      ? `<span class="sev-badge sev-${sev}">${{ high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev]}</span>`
      : `<span class="sev-badge sev-normal">—</span>`;

    const metricsHtml = HOTSPOT_METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = isSmelly && !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="hotspot-metric metric-clickable ${triggered ? 'triggered' : ''}" data-metric="${def.key}">
        <span class="hotspot-metric-icon">${def.icon}</span>
        <span class="hotspot-metric-label">${def.label}</span>
        <span class="hotspot-metric-val">${val}${levelLabel}</span>
        <span class="metric-info-btn" aria-label="Saiba mais">i</span>
      </div>`;
    }).join('');

    const isCycle = state.cycleNodes.has(path);
    const isHub   = state.hubNodePaths.has(path);
    const isGod   = state.godNodePaths.has(path);
    const alsoTags = [
      isCycle ? `<span class="hotspot-also-tag cycle">⟳ Em ciclo</span>`    : '',
      isHub   ? `<span class="hotspot-also-tag hub">◎ É hub</span>`         : '',
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
       <div class="hotspot-lines-changed">± ${linesChanged} linhas alteradas no total</div>
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

  el.innerHTML = `<div class="threshold-info">
    Limiar: commits ≥ <strong>${HOTSPOT_FREQ_MED}</strong> · centralidade ≥ <strong>${ARCH_CENTRALITY_MED}</strong> · LOC ≥ <strong>${HOTSPOT_LOC_MED}</strong>
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
      ? `<span class="sev-badge sev-${sev}">${{ high: 'ALTO', medium: 'MÉDIO', low: 'BAIXO' }[sev]}</span>`
      : `<span class="sev-badge sev-normal">—</span>`;

    const metricsHtml = ARCH_METRIC_DEFS.map(def => {
      const val        = def.getter(mod);
      const triggered  = isSmelly && !!flags[def.key];
      const levelLabel = flags[def.key] === 'high' ? ' ⚠' : '';
      return `<div class="arch-metric metric-clickable ${triggered ? 'triggered' : ''}" data-metric="${def.key}">
        <span class="arch-metric-icon">${def.icon}</span>
        <span class="arch-metric-label">${def.label}</span>
        <span class="arch-metric-val">${val}${levelLabel}</span>
        <span class="metric-info-btn" aria-label="Saiba mais">i</span>
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
      isHub   ? `<span class="arch-also-tag hub">◎ É hub</span>`      : '',
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
    { label: 'Arquivo' },
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
    { label: 'Arquivo' },
    { label: 'Símbolos', r: true, w: '60px' },
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
    { label: 'Arquivo' },
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
    { label: 'Arquivo' },
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

  const bodyRows = rows.map(r => {
    const na = r.total === null;
    if (na) {
      return `<tr>
      <td class="rpt-smell"><span class="rpt-dot rpt-dot-${r.color}"></span>${r.icon} ${r.label}</td>
      <td class="rpt-na" colspan="5">git log não encontrado</td>
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
      return `${escape(r.label)} & -- & \\multicolumn{3}{c|}{git log n\\~{a}o encontrado} & -- \\\\`;
    }
    const sev = { high: 0, medium: 0, low: 0 };
    r.modules.forEach(m => { sev[sevOf(m, r.cyclic)]++; });
    return `${escape(r.label)} & ${r.total || '--'} & ${sev.high || '--'} & ${sev.medium || '--'} & ${sev.low || '--'} & ${r.files || '--'} \\\\`;
  }).join('\n');

  const depCount = Array.from(s.depGraph.values()).reduce((a, v) => a + v.size, 0);
  const commitsLine = has
    ? '% commits.txt: sim'
    : '% commits.txt: n\\~{a}o (execute: git log --pretty=format:"\\%H \\%ai \\%an" --numstat > commits.txt)';

  const footerRow =
    `\\multicolumn{3}{l|}{\\small Arquivos analisados: ${s.fileMap.size}} & ` +
    `\\multicolumn{3}{r}{\\small Depend\\^{e}ncias: ${depCount}} \\\\`;

  return [
    commitsLine,
    '\\begin{tabular}{l|r|r|r|r|r}',
    '\\hline',
    '\\textbf{Smell} & \\textbf{Total} & \\textbf{Alto} & \\textbf{M\\\'edio} & \\textbf{Baixo} & \\textbf{Arquivos} \\\\',
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

// Metric info modal — event delegation on smellList
document.getElementById('smellList').addEventListener('click', e => {
  const cell = e.target.closest('[data-metric]');
  if (cell) { e.stopPropagation(); openMetricModal(cell.dataset.metric); }
});

// Metric info modal — stat cards (e.g. Dependências)
document.querySelector('.stats-bar').addEventListener('click', e => {
  const card = e.target.closest('[data-metric]');
  if (card) openMetricModal(card.dataset.metric);
});
document.getElementById('btnMiClose').addEventListener('click', closeMetricModal);
document.getElementById('metricInfoModal').addEventListener('click', e => {
  if (e.target === document.getElementById('metricInfoModal')) closeMetricModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('metricInfoModal').style.display !== 'none')
    closeMetricModal();
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
