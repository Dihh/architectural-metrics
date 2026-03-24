import {
  state,
  HUB_MIN_IN, HUB_MIN_OUT, HUB_MIN_TOTAL,
  GOD_LOC_MED, GOD_LOC_HIGH,
  GOD_FUNC_MED, GOD_FUNC_HIGH,
  GOD_EXP_MED, GOD_EXP_HIGH,
  GOD_IMP_MIN, GOD_MIN_SCORE,
  CHATTY_NAMED_MED, CHATTY_NAMED_HIGH,
  CHATTY_MAX_MED, CHATTY_MAX_HIGH,
  CHATTY_MIN_SCORE,
  HOTSPOT_FREQ_MED, HOTSPOT_FREQ_HIGH,
  HOTSPOT_LOC_MED,  HOTSPOT_LOC_HIGH,
  HOTSPOT_MIN_SCORE,
  ARCH_CENTRALITY_MED, ARCH_CENTRALITY_HIGH,
  ARCH_MIN_SCORE,
} from './state.js';
import { isSupported, shouldSkip, readText, extractImports, resolveImport, parseCommitsTxt } from './parser.js';

export const tick = () => new Promise(r => setTimeout(r, 40));

// ─────────────────────────────────────────
// Tarjan's SCC  —  O(V+E)
// ─────────────────────────────────────────
export function tarjanSCC(graph) {
  const nodes = [...graph.keys()];
  const idx = new Map(), low = new Map(), onStack = new Map();
  const stack = [], result = [];
  let counter = 0;

  function sc(v) {
    idx.set(v, counter); low.set(v, counter); counter++;
    stack.push(v); onStack.set(v, true);

    for (const w of (graph.get(v) || new Set())) {
      if (!idx.has(w)) {
        sc(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.get(w)) {
        low.set(v, Math.min(low.get(v), idx.get(w)));
      }
    }

    if (low.get(v) === idx.get(v)) {
      const scc = [];
      let w;
      do { w = stack.pop(); onStack.set(w, false); scc.push(w); } while (w !== v);
      result.push(scc);
    }
  }

  for (const v of nodes) { if (!idx.has(v)) sc(v); }
  return result;
}

// ─────────────────────────────────────────
// Representative cycle path (DFS within SCC)
// ─────────────────────────────────────────
export function findCyclePath(scc) {
  if (scc.length === 1) return scc;
  const set   = new Set(scc);
  const start = scc[0];
  let found   = null;

  function dfs(node, path, vis) {
    for (const next of (state.depGraph.get(node) || new Set())) {
      if (!set.has(next)) continue;
      if (next === start && path.length >= 2) { found = [...path]; return true; }
      if (!vis.has(next)) {
        vis.add(next); path.push(next);
        if (dfs(next, path, vis)) return true;
        path.pop(); vis.delete(next);
      }
    }
    return false;
  }

  dfs(start, [start], new Set([start]));
  return found || scc;
}

// ─────────────────────────────────────────
// Hub-Like Dependency detection
// ─────────────────────────────────────────
export function detectHubs() {
  const hubs = [];

  for (const [path] of state.fileMap) {
    const fanOut = state.depGraph.get(path)?.size ?? 0;
    const fanIn  = state.revGraph.get(path)?.size ?? 0;
    const total  = fanIn + fanOut;

    if (fanIn >= HUB_MIN_IN && fanOut >= HUB_MIN_OUT && total >= HUB_MIN_TOTAL) {
      const sev = total >= 20 ? 'high' : total >= 12 ? 'medium' : 'low';
      hubs.push({ path, fanIn, fanOut, total, sev });
    }
  }

  hubs.sort((a, b) => b.total - a.total);
  state.hubModules   = hubs;
  state.hubNodePaths = new Set(hubs.map(h => h.path));
}

// ─────────────────────────────────────────
// God Component detection
// ─────────────────────────────────────────
export function computeGodMetrics(content) {
  // Strip block and line comments for cleaner regex matching
  const noComments = content
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');

  // LOC: non-blank, non-pure-comment lines in raw content
  const loc = content.split('\n').filter(l => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).length;

  // Function count: `function` keywords + arrow functions
  const funcCount =
    (noComments.match(/\bfunction\b/g) || []).length +
    (noComments.match(/=>\s*[{(]/g)   || []).length;

  // Export count: meaningful export declarations
  const exportCount = (noComments.match(
    /\bexport\s+(?:default\s+)?(?:const|let|var|function|class|type|interface|enum|\{)/g
  ) || []).length;

  return { loc, funcCount, exportCount };
}

export function computeGodScore(loc, funcCount, exportCount, importCount) {
  let score = 0;
  const flags = {};

  if      (loc >= GOD_LOC_HIGH)       { score += 2; flags.loc  = 'high';   }
  else if (loc >= GOD_LOC_MED)        { score += 1; flags.loc  = 'medium'; }

  if      (funcCount >= GOD_FUNC_HIGH) { score += 2; flags.func = 'high';   }
  else if (funcCount >= GOD_FUNC_MED)  { score += 1; flags.func = 'medium'; }

  if      (exportCount >= GOD_EXP_HIGH) { score += 2; flags.exp = 'high';   }
  else if (exportCount >= GOD_EXP_MED)  { score += 1; flags.exp = 'medium'; }

  if (importCount >= GOD_IMP_MIN) { score += 1; flags.imp = 'medium'; }

  return { score, flags };
}

export function detectGodComponents() {
  const gods = [];

  for (const [path, content] of state.fileMap) {
    const { loc, funcCount, exportCount } = computeGodMetrics(content);
    const importCount = state.depGraph.get(path)?.size ?? 0;
    const { score, flags } = computeGodScore(loc, funcCount, exportCount, importCount);

    if (score >= GOD_MIN_SCORE) {
      const sev = score >= 6 ? 'high' : score >= 4 ? 'medium' : 'low';
      gods.push({ path, loc, funcCount, exportCount, importCount, score, sev, flags });
    }
  }

  gods.sort((a, b) => b.score - a.score);
  state.godModules   = gods;
  state.godNodePaths = new Set(gods.map(g => g.path));
}

// ─────────────────────────────────────────
// Chatty Component detection
// ─────────────────────────────────────────

/**
 * Count all named symbols in import statements.
 * e.g. `import { a, b as x, type C }` → 3 symbols, from that one module path.
 * Returns total across all imports and the module that contributes the most.
 */
export function computeChattyMetrics(content) {
  const clean = content
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');

  let totalNamed = 0;
  let maxFromOne = 0;
  let topDep     = null;

  // Matches: import [type] { ... } from '...'
  const rx = /\bimport\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = rx.exec(clean)) !== null) {
    const symbols = m[1]
      .split(',')
      .map(s => s.trim().replace(/\s+as\s+\w+$/, ''))  // strip 'as alias'
      .filter(s => s.length > 0);
    const count = symbols.length;
    totalNamed += count;
    if (count > maxFromOne) {
      maxFromOne = count;
      topDep = m[2];
    }
  }

  return { namedImports: totalNamed, maxFromOne, topDep };
}

export function computeChattyScore(namedImports, maxFromOne) {
  let score = 0;
  const flags = {};

  if      (namedImports >= CHATTY_NAMED_HIGH) { score += 2; flags.named = 'high';   }
  else if (namedImports >= CHATTY_NAMED_MED)  { score += 1; flags.named = 'medium'; }

  if      (maxFromOne >= CHATTY_MAX_HIGH) { score += 2; flags.max = 'high';   }
  else if (maxFromOne >= CHATTY_MAX_MED)  { score += 1; flags.max = 'medium'; }

  return { score, flags };
}

export function detectChattyComponents() {
  const chatty = [];

  for (const [path, content] of state.fileMap) {
    const { namedImports, maxFromOne, topDep } = computeChattyMetrics(content);
    const { score, flags } = computeChattyScore(namedImports, maxFromOne);

    if (score >= CHATTY_MIN_SCORE) {
      const sev = score >= 6 ? 'high' : score >= 4 ? 'medium' : 'low';
      chatty.push({ path, namedImports, maxFromOne, topDep, score, sev, flags });
    }
  }

  chatty.sort((a, b) => b.score - a.score);
  state.chattyModules   = chatty;
  state.chattyNodePaths = new Set(chatty.map(c => c.path));
}

// ─────────────────────────────────────────
// Hotspot detection  (requires commits.txt)
// ─────────────────────────────────────────
export function detectHotspots() {
  const hotspots = [];

  for (const [path, content] of state.fileMap) {
    const commitInfo = state.commitData.get(path);
    if (!commitInfo) continue; // file not touched in commits.txt → skip

    const { loc } = computeGodMetrics(content);
    const { commitCount, linesChanged } = commitInfo;

    let score = 0;
    const flags = {};

    if      (commitCount >= HOTSPOT_FREQ_HIGH) { score += 2; flags.freq = 'high';   }
    else if (commitCount >= HOTSPOT_FREQ_MED)  { score += 1; flags.freq = 'medium'; }

    if      (loc >= HOTSPOT_LOC_HIGH) { score += 2; flags.loc = 'high';   }
    else if (loc >= HOTSPOT_LOC_MED)  { score += 1; flags.loc = 'medium'; }

    if (score >= HOTSPOT_MIN_SCORE) {
      const sev = score >= 4 ? 'high' : score >= 3 ? 'medium' : 'low';
      hotspots.push({ path, commitCount, linesChanged, loc, score, sev, flags });
    }
  }

  hotspots.sort((a, b) => b.score - a.score || b.commitCount - a.commitCount);
  state.hotspotModules   = hotspots;
  state.hotspotNodePaths = new Set(hotspots.map(h => h.path));
}

// ─────────────────────────────────────────
// Architectural Hotspot detection
// Combines: change frequency + dependency centrality + size
// ─────────────────────────────────────────
export function detectArchHotspots() {
  const archs = [];

  for (const [path, content] of state.fileMap) {
    const commitInfo = state.commitData.get(path);
    if (!commitInfo) continue;

    const { loc }      = computeGodMetrics(content);
    const { commitCount } = commitInfo;
    const fanOut       = state.depGraph.get(path)?.size ?? 0;
    const fanIn        = state.revGraph.get(path)?.size ?? 0;
    const centrality   = fanIn + fanOut;

    let score = 0;
    const flags = {};

    if      (commitCount >= HOTSPOT_FREQ_HIGH)      { score += 2; flags.freq        = 'high';   }
    else if (commitCount >= HOTSPOT_FREQ_MED)        { score += 1; flags.freq        = 'medium'; }

    if      (centrality >= ARCH_CENTRALITY_HIGH)     { score += 2; flags.centrality  = 'high';   }
    else if (centrality >= ARCH_CENTRALITY_MED)      { score += 1; flags.centrality  = 'medium'; }

    if      (loc >= HOTSPOT_LOC_HIGH)                { score += 2; flags.loc         = 'high';   }
    else if (loc >= HOTSPOT_LOC_MED)                 { score += 1; flags.loc         = 'medium'; }

    if (score >= ARCH_MIN_SCORE) {
      const sev = score >= 5 ? 'high' : score >= 3 ? 'medium' : 'low';
      archs.push({ path, commitCount, loc, centrality, fanIn, fanOut, score, sev, flags });
    }
  }

  archs.sort((a, b) => b.score - a.score || b.commitCount - a.commitCount);
  state.archHotspotModules   = archs;
  state.archHotspotNodePaths = new Set(archs.map(a => a.path));
}

// ─────────────────────────────────────────
// Main analysis pipeline
// onProgress(msg) is called at each step so the caller can update the UI
// without creating a dependency on ui.js here.
// ─────────────────────────────────────────
export async function analyseFiles(files, onProgress) {
  state.fileMap.clear();
  state.depGraph.clear();
  state.revGraph.clear();
  state.hasCommits = false;
  state.commitData.clear();
  state.hotspotModules      = [];
  state.hotspotNodePaths    = new Set();
  state.archHotspotModules  = [];
  state.archHotspotNodePaths = new Set();

  const arr  = Array.from(files);
  const root = arr[0]?.webkitRelativePath?.split('/')[0] ?? '';

  const promises = arr
    .filter(f => isSupported(f.name) && !shouldSkip(f.webkitRelativePath))
    .map(async f => {
      const norm = '/' + f.webkitRelativePath.slice(root.length + 1);
      const txt  = await readText(f);
      return [norm, txt];
    });

  onProgress('Lendo ' + arr.length + ' arquivo(s)…');
  const entries = await Promise.all(promises);
  for (const [p, c] of entries) {
    state.fileMap.set(p, c);
    state.depGraph.set(p, new Set());
  }

  onProgress('Construindo grafo de dependências…'); await tick();

  let totalDeps = 0;
  for (const [fp, content] of state.fileMap) {
    for (const imp of extractImports(content)) {
      const res = resolveImport(fp, imp);
      if (res && res !== fp) {
        state.depGraph.get(fp).add(res);
        if (!state.revGraph.has(res)) state.revGraph.set(res, new Set());
        state.revGraph.get(res).add(fp);
        totalDeps++;
      }
    }
  }

  onProgress('Detectando Cyclic Dependencies…'); await tick();
  const allSCCs = tarjanSCC(state.depGraph);
  state.cyclicSCCs = allSCCs.filter(s => s.length > 1);
  for (const [p, deps] of state.depGraph) {
    if (deps.has(p)) state.cyclicSCCs.push([p]);
  }

  state.cycleNodes.clear();
  state.cycleEdges.clear();
  for (const scc of state.cyclicSCCs) {
    const set = new Set(scc);
    for (const n of scc) {
      state.cycleNodes.add(n);
      if (scc.length === 1) { state.cycleEdges.add(`${n}::${n}`); continue; }
      for (const d of (state.depGraph.get(n) || new Set())) {
        if (set.has(d)) state.cycleEdges.add(`${n}::${d}`);
      }
    }
  }

  onProgress('Detectando Hub-Like Dependencies…'); await tick();
  detectHubs();

  onProgress('Detectando God Components…'); await tick();
  detectGodComponents();

  onProgress('Detectando Chatty Components…'); await tick();
  detectChattyComponents();

  // ── Optional: commits.txt ──────────────────────────────
  const commitsFile = arr.find(f => f.name === 'commits.txt');
  if (commitsFile) {
    onProgress('Lendo commits.txt…'); await tick();
    const commitsText = await readText(commitsFile);
    state.commitData  = parseCommitsTxt(commitsText);
    state.hasCommits  = true;

    onProgress('Detectando Hotspots…'); await tick();
    detectHotspots();

    onProgress('Detectando Architectural Hotspots…'); await tick();
    detectArchHotspots();
  }

  return { fileCount: state.fileMap.size, depCount: totalDeps };
}
