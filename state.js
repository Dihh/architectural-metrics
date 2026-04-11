// ─────────────────────────────────────────
// Mutable shared state
// Using an object so all modules share the same live reference
// and assignments (state.x = ...) propagate everywhere.
// ─────────────────────────────────────────
export const state = {
  // Dependency graph data
  fileMap:  new Map(),
  depGraph: new Map(),
  revGraph: new Map(),

  // Cyclic Dependency results
  cyclicSCCs: [],
  cycleNodes: new Set(),
  cycleEdges: new Set(),

  // Hub-Like Dependency results
  hubModules:   [],
  hubNodePaths: new Set(),

  // God Component results
  // each entry: { path, loc, funcCount, exportCount, importCount, score, sev, flags }
  godModules:    [],
  godNodePaths:  new Set(),
  godMetricsMap: new Map(), // path → { loc, funcCount, exportCount, importCount, score } for ALL files

  // Chatty Component results
  // each entry: { path, namedImports, maxFromOne, topDep, score, sev, flags }
  chattyModules:    [],
  chattyNodePaths:  new Set(),
  chattyMetricsMap: new Map(), // path → { namedImports, maxFromOne, topDep, score } for ALL files

  // Hotspot results (requires commits.txt)
  // each entry: { path, commitCount, linesChanged, loc, score, sev, flags }
  hasCommits:          false,
  commitData:          new Map(), // path → { commitCount, linesChanged }
  hotspotModules:      [],
  hotspotNodePaths:    new Set(),

  // Architectural Hotspot results
  // each entry: { path, commitCount, loc, centrality, score, sev, flags }
  archHotspotModules:   [],
  archHotspotNodePaths: new Set(),

  // UI state
  currentSmell:      'cyclic',
  currentView:       'all',
  selectedIdx:         -1,
  selectedHubIdx:      -1,
  selectedGodIdx:      -1,
  selectedChattyIdx:   -1,
  selectedHotspotIdx:  -1,
  selectedArchIdx:     -1,
};

// ─────────────────────────────────────────
// Immutable constants
// ─────────────────────────────────────────
export const SUPPORTED = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

export const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '__pycache__', '.cache', 'vendor', '.turbo', 'out', '.output',
]);

// ─────────────────────────────────────────
// Configurable thresholds
// Defaults live here; overrides are persisted to localStorage under 'arch-thresholds'.
// ─────────────────────────────────────────
export const THRESHOLD_DEFAULTS = {
  // Hub-Like Dependency
  HUB_MIN_IN:    3,
  HUB_MIN_OUT:   3,
  HUB_MIN_TOTAL: 8,
  // God Component
  GOD_LOC_MED:   300,
  GOD_LOC_HIGH:  500,
  GOD_FUNC_MED:  15,
  GOD_FUNC_HIGH: 25,
  GOD_EXP_MED:   6,
  GOD_EXP_HIGH:  12,
  GOD_IMP_MIN:   10,
  GOD_MIN_SCORE: 2,
  // Chatty Component
  CHATTY_NAMED_MED:  15,
  CHATTY_NAMED_HIGH: 30,
  CHATTY_MAX_MED:    6,
  CHATTY_MAX_HIGH:   10,
  CHATTY_MIN_SCORE:  2,
  // Hotspot
  HOTSPOT_FREQ_MED:  10,
  HOTSPOT_FREQ_HIGH: 25,
  HOTSPOT_LOC_MED:   300,
  HOTSPOT_LOC_HIGH:  500,
  HOTSPOT_MIN_SCORE: 2,
  // Architectural Hotspot
  ARCH_CENTRALITY_MED:  8,
  ARCH_CENTRALITY_HIGH: 15,
  ARCH_MIN_SCORE:       2,
};

// Mutable thresholds object — all modules share the same reference.
// Mutating a property (e.g. thresholds.HUB_MIN_IN = 5) propagates everywhere.
export const thresholds = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('arch-thresholds') || '{}');
    const out = { ...THRESHOLD_DEFAULTS };
    for (const [k, v] of Object.entries(saved)) {
      if (k in out && typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  } catch {
    return { ...THRESHOLD_DEFAULTS };
  }
})();
