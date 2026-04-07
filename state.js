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

// Hub thresholds
export const HUB_MIN_IN    = 3;
export const HUB_MIN_OUT   = 3;
export const HUB_MIN_TOTAL = 8;

// God Component thresholds (each exceeded metric adds points to the god score)
export const GOD_LOC_MED   = 300;   // +1 pt
export const GOD_LOC_HIGH  = 500;   // +1 pt more
export const GOD_FUNC_MED  = 15;    // +1 pt
export const GOD_FUNC_HIGH = 25;    // +1 pt more
export const GOD_EXP_MED   = 6;     // +1 pt
export const GOD_EXP_HIGH  = 12;    // +1 pt more
export const GOD_IMP_MIN   = 10;    // +1 pt  (fan-out)
export const GOD_MIN_SCORE = 2;     // minimum score to be flagged

// Chatty Component thresholds
export const CHATTY_NAMED_MED  = 15;  // total named imports +1 pt
export const CHATTY_NAMED_HIGH = 30;  // total named imports +1 pt more
export const CHATTY_MAX_MED    = 6;   // max symbols from one dep +1 pt
export const CHATTY_MAX_HIGH   = 10;  // max symbols from one dep +1 pt more
export const CHATTY_MIN_SCORE  = 2;   // minimum score to be flagged

// Hotspot thresholds (change frequency + size)
export const HOTSPOT_FREQ_MED  = 10;  // commits touching file +1 pt
export const HOTSPOT_FREQ_HIGH = 25;  // +1 pt more
export const HOTSPOT_LOC_MED   = 300; // LOC +1 pt  (reuses GOD thresholds conceptually)
export const HOTSPOT_LOC_HIGH  = 500; // +1 pt more
export const HOTSPOT_MIN_SCORE = 2;   // must fire at least two dimensions

// Architectural Hotspot thresholds (frequency + centrality + size)
export const ARCH_CENTRALITY_MED  = 8;  // fan-in + fan-out +1 pt
export const ARCH_CENTRALITY_HIGH = 15; // +1 pt more
export const ARCH_MIN_SCORE       = 2;  // minimum score to be flagged
