import { state, SUPPORTED, SKIP_DIRS } from './state.js';

// ─────────────────────────────────────────
// File helpers
// ─────────────────────────────────────────
export const isSupported = name => SUPPORTED.some(e => name.endsWith(e));
export const shouldSkip  = p    => p.split('/').some(s => SKIP_DIRS.has(s));

export const readText = file => new Promise(res => {
  const r = new FileReader();
  r.onload  = e => res(e.target.result);
  r.onerror = () => res('');
  r.readAsText(file);
});

// Normalise a split path array → '/a/b/c'
export function normPath(parts) {
  const out = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return '/' + out.join('/');
}

// ─────────────────────────────────────────
// Import extraction
// ─────────────────────────────────────────
export function extractImports(src) {
  // Strip comments before matching
  const clean = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');

  const found = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'";\n]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:[^'";\n]*?\s+from\s+)['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const rx of patterns) {
    let m;
    while ((m = rx.exec(clean)) !== null) {
      const p = m[1];
      if (p.startsWith('.') || p.startsWith('/')) found.add(p);
    }
  }

  return [...found];
}

// ─────────────────────────────────────────
// commits.txt parser
// Format per block:
//   <hash40> <date> <time> <tz> <author...>
//   <added>\t<removed>\t<filepath>
//   ...
// Returns Map<normalizedPath, { commitCount, linesChanged }>
// ─────────────────────────────────────────
export function parseCommitsTxt(text) {
  const result = new Map();
  let inCommit = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // Commit header: 40-char lowercase hex hash followed by a space
    if (/^[0-9a-f]{40} /.test(line)) {
      inCommit = true;
      continue;
    }

    // File change line: three tab-delimited fields
    // added \t removed \t filepath
    // Binary files use '-' instead of numbers
    if (inCommit) {
      const parts = rawLine.split('\t');
      if (parts.length >= 3) {
        const filepath = parts[2].trim();
        if (!filepath) continue;
        // Normalise: strip leading slash if present, then prepend one
        const normPath = '/' + filepath.replace(/^\//, '');
        const a = parseInt(parts[0], 10) || 0;
        const r = parseInt(parts[1], 10) || 0;
        if (!result.has(normPath)) {
          result.set(normPath, { commitCount: 0, linesChanged: 0 });
        }
        const entry = result.get(normPath);
        entry.commitCount++;
        entry.linesChanged += a + r;
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────
// Import path resolution
// ─────────────────────────────────────────
export function resolveImport(filePath, importPath) {
  const dir  = filePath.substring(0, filePath.lastIndexOf('/'));
  const base = importPath.startsWith('/')
    ? importPath
    : normPath([...dir.split('/'), ...importPath.split('/')]);

  if (state.fileMap.has(base)) return base;
  for (const ext of SUPPORTED) {
    if (state.fileMap.has(base + ext)) return base + ext;
  }
  for (const ext of SUPPORTED) {
    const idx = base + '/index' + ext;
    if (state.fileMap.has(idx)) return idx;
  }
  return null;
}
