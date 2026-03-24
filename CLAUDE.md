# Architecture Smell Detector — CLAUDE.md

Single-page browser tool that analyses JS/TS projects for architecture smells by reading a folder upload, building a dependency graph, and running detectors. No build step, no server — open `index.html` directly in a browser.

---

## File structure

```
index.html   — markup only, zero inline event handlers
styles.css   — all CSS, dark-theme GitHub-like palette
state.js     — shared mutable state + all exported constants
parser.js    — file helpers, import extraction, path resolution, commits.txt parser
detectors.js — all smell detection algorithms + main analyseFiles() pipeline
graph.js     — D3.js force-directed graph rendering + highlight helpers
ui.js        — entry point: render lists, tab switching, event wiring
```

### Dependency order (no circular deps)

```
ui.js → graph.js   → state.js
ui.js → detectors.js → parser.js → state.js
```

`ui.js` is the only module that imports from all others.
`detectors.js` never imports from `ui.js` or `graph.js`.
`graph.js` never imports from `ui.js` or `detectors.js`.

---

## Key architectural decisions

### Mutable state object pattern
All shared state lives in a single `export const state = { ... }` object in `state.js`. Every module imports this same reference. Mutations like `state.cyclicSCCs = [...]` propagate everywhere because we mutate the object, not rebind the variable. This sidesteps the ES module read-only binding restriction on `export let`.

### onProgress callback (avoids circular deps)
`analyseFiles(files, onProgress)` accepts a callback instead of calling `setLoading` directly. This lets `detectors.js` report progress to the UI without importing from `ui.js`.

### ES modules (`type="module"`)
All JS files use `import`/`export`. No globals, no `onclick` attributes. All event listeners are wired in `ui.js` using `addEventListener` and event delegation.

---

## Architecture smells implemented

| Tab | Key | Color | Description |
|-----|-----|-------|-------------|
| ⟳ Cyclic Dependency | `cyclic` | red `#f85149` | Files that form import cycles (Tarjan SCC) |
| ◎ Hub-Like Dependency | `hub` | orange `#d29922` | Files with high fan-in AND fan-out |
| ⊕ God Component | `god` | teal `#3dc9b0` | Files that are too large, have too many functions/exports |
| ⇄ Chatty Component | `chatty` | yellow `#e8d44d` | Files that import excessive named symbols from dependencies |
| 🔥 Hotspot | `hotspot` | coral `#fd9644` | Files that are large AND change frequently (requires commits.txt) |
| ⬡ Arch Hotspot | `arch` | magenta `#e056fd` | Files with high change frequency + high dependency centrality + large size (requires commits.txt) |

---

## Thresholds and scoring (state.js)

All thresholds are named constants exported from `state.js`. The scoring system works uniformly: each threshold breach adds points; a minimum score triggers flagging.

### Hub
- `HUB_MIN_IN = 3`, `HUB_MIN_OUT = 3`, `HUB_MIN_TOTAL = 8`
- Must exceed all three to be flagged. Severity based on total connections.

### God Component (max score: 7)
| Metric | Medium (+1 pt) | High (+1 pt more) |
|--------|---------------|-------------------|
| LOC | ≥ 300 | ≥ 500 |
| Functions | ≥ 15 | ≥ 25 |
| Exports | ≥ 6 | ≥ 12 |
| Imports (fan-out) | ≥ 10 | — |

`GOD_MIN_SCORE = 2` to flag.

### Chatty Component (max score: 4)
| Metric | Medium (+1 pt) | High (+1 pt more) |
|--------|---------------|-------------------|
| Total named imports | ≥ 15 | ≥ 30 |
| Max from one dep | ≥ 6 | ≥ 10 |

`CHATTY_MIN_SCORE = 2` to flag. Also tracks `topDep` — the single dependency contributing the most symbols.

### Hotspot (max score: 4) — requires commits.txt
| Metric | Medium (+1 pt) | High (+1 pt more) |
|--------|---------------|-------------------|
| Commit count | ≥ 10 | ≥ 25 |
| LOC | ≥ 300 | ≥ 500 |

`HOTSPOT_MIN_SCORE = 2` — both dimensions must fire (size AND frequency).

### Architectural Hotspot (max score: 6) — requires commits.txt
| Metric | Medium (+1 pt) | High (+1 pt more) |
|--------|---------------|-------------------|
| Commit count | ≥ 10 | ≥ 25 |
| Centrality (fan-in + fan-out) | ≥ 8 | ≥ 15 |
| LOC | ≥ 300 | ≥ 500 |

`ARCH_MIN_SCORE = 2` to flag. Severity: ≥5 = high, ≥3 = medium, else low.

---

## commits.txt support (optional)

When the uploaded project contains a `commits.txt` at its root, the tool parses it and enables the Hotspot and Arch Hotspot tabs. Without it, those tabs show a "commits.txt não encontrado" message.

### File format
```
<hash40> <date> <time> <tz> <author...>
<lines_added>\t<lines_removed>\t<filepath>
<lines_added>\t<lines_removed>\t<filepath>
...
<hash40> <date> <time> <tz> <author...>
<lines_added>\t<lines_removed>\t<filepath>
```

Example:
```
97d4417388a5e3ececcb853878305081fe7b8bfc 2026-03-12 18:36:07 -0300 Diegton Rodrigues
14	4	components/forms/exercise/exercise-form-component.js
6	4	components/forms/workout/workout-form-component.js
```

Paths in `commits.txt` are relative to the project root (no leading `/`). The parser prepends `/` to match the internal `fileMap` key format. Binary files that use `-` instead of line counts are handled gracefully (parsed as 0).

### How to generate commits.txt
```bash
git log --pretty=format:"%H %ai %an" --numstat > commits.txt
```

### What gets computed
- `commitCount` — how many commits touched this file
- `linesChanged` — total lines added + removed across all commits

---

## State shape (state.js)

```js
state = {
  fileMap:  Map<path, content>,      // all parsed source files
  depGraph: Map<path, Set<path>>,    // who imports whom
  revGraph: Map<path, Set<path>>,    // reverse: who is imported by whom

  cyclicSCCs:   Array<string[]>,     // each SCC with ≥2 nodes
  cycleNodes:   Set<path>,
  cycleEdges:   Set<"src::dst">,

  hubModules:   Array<{path, fanIn, fanOut, total, sev}>,
  hubNodePaths: Set<path>,

  godModules:   Array<{path, loc, funcCount, exportCount, importCount, score, sev, flags}>,
  godNodePaths: Set<path>,

  chattyModules:   Array<{path, namedImports, maxFromOne, topDep, score, sev, flags}>,
  chattyNodePaths: Set<path>,

  hasCommits:          boolean,
  commitData:          Map<path, {commitCount, linesChanged}>,
  hotspotModules:      Array<{path, commitCount, linesChanged, loc, score, sev, flags}>,
  hotspotNodePaths:    Set<path>,
  archHotspotModules:  Array<{path, commitCount, loc, centrality, fanIn, fanOut, score, sev, flags}>,
  archHotspotNodePaths: Set<path>,

  currentSmell:      string,   // 'cyclic' | 'hub' | 'god' | 'chatty' | 'hotspot' | 'arch'
  currentView:       string,   // 'all' | 'cycles' | 'hubs' | 'gods' | 'chatty' | 'hotspots' | 'archs'
  selectedIdx:         number, // selected cyclic SCC index (-1 = none)
  selectedHubIdx:      number,
  selectedGodIdx:      number,
  selectedChattyIdx:   number,
  selectedHotspotIdx:  number,
  selectedArchIdx:     number,
}
```

---

## Analysis pipeline (detectors.js — analyseFiles)

1. Read all files → populate `state.fileMap`
2. Extract imports → build `state.depGraph` and `state.revGraph`
3. `tarjanSCC()` → find cycles → populate `state.cyclicSCCs`, `state.cycleNodes`, `state.cycleEdges`
4. `detectHubs()` → populate `state.hubModules`
5. `detectGodComponents()` → populate `state.godModules`
6. `detectChattyComponents()` → populate `state.chattyModules`
7. If `commits.txt` is present:
   - `parseCommitsTxt()` → populate `state.commitData`, set `state.hasCommits = true`
   - `detectHotspots()` → populate `state.hotspotModules`
   - `detectArchHotspots()` → populate `state.archHotspotModules`

Each step calls `onProgress(msg)` then `await tick()` (40ms setTimeout) to keep the loading screen responsive.

---

## Graph rendering (graph.js)

Uses **D3.js v7** force-directed layout (imported via CDN in index.html). Graph is module-private — no state is exported from graph.js except the render/highlight/zoom functions.

### Node color priority (cross-smell overlap)
For the first four smells: `cycle > hub > god > chatty` — a file in multiple categories takes the highest-priority color.
For `hotspot` and `arch` smells, node color is independent (no cross-priority blending with the first four).

### Arrow markers (SVG defs)
| ID | Color | Used for |
|----|-------|---------|
| `arr-def` | `#3d444d` | default edges |
| `arr-cyc` | `#f85149` | cyclic edges |
| `arr-hub` | `#d29922` | hub edges |
| `arr-pur` | `#bc8cff` | hub+cycle overlap |
| `arr-teal` | `#3dc9b0` | god edges |
| `arr-yell` | `#e8d44d` | chatty edges |
| `arr-coral` | `#fd9644` | hotspot edges |
| `arr-mag` | `#e056fd` | arch hotspot edges |

---

## How to add a new smell

1. **state.js** — add result array, node Set, selected index, and any constants
2. **detectors.js** — import new constants; write `detectXxx()` function; call it inside `analyseFiles()`
3. **index.html** — add `<button class="smell-tab" data-smell="xxx">` with a `<span id="tabXxx">`
4. **ui.js** — import new constants and `highlightXxx` from graph.js; write `renderXxxList()`; add entry to `setSmell()`, `updateStats()`, and `updateViewToggles()` cfg objects; update `handleFiles()` tab count; add `selectedXxxIdx` to all reset chains
5. **graph.js** — extend `nodeColor`, `nodeStroke`, `nodeLabelColor`, `edgeStroke`, `edgeOpacity`, `edgeMarker`, `updateLegend`, node data object, `resetGraphOpacity` stroke-width guard, node radius (`r`), and `showTip` tooltip; add new arrow marker; add `highlightXxx` export; add view filter case
6. **styles.css** — add CSS variable, tab active color, stab-count active bg, stat-card color, list-badge color, and card styles (card hover/selected, metrics grid, metric cells, path line, also-tags)
