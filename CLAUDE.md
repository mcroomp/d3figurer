# CLAUDE.md — d3figurer

Authoritative guidance for AI agents working on the d3figurer codebase.

---

## What this package is

`d3figurer` is a **server-side D3.js figure renderer** and MCP server. It:

1. Spins up a persistent Chrome process (via Puppeteer) and a tiny HTTP server.
2. Accepts `POST /render` — executes `figure.js` in a jsdom context, captures the SVG via Puppeteer, exports PDF, PNG, or SVG.
3. Accepts `POST /check` — runs layout QA (text overlap, clipping, box overflow, rect intrusion, explicit containment assertions).
4. Exposes `render_figure`, `check_figure`, and `server_status` as MCP tools via `mcp_server.js`.

---

## Repository layout

```
d3figurer/
├── package.json
├── server.sh                Lifecycle manager (install / start / stop / status / log)
├── test.sh                  Test runner (quiet by default; -v verbose; pattern filter)
├── mcp_server.js            MCP stdio server — JSON-RPC 2.0, no SDK dependency
├── mcp.sh                   Self-locating MCP launcher (sets NODE_PATH, execs mcp_server.js)
├── setup_mcp.sh             Cross-platform setup: Node install, deps, MCP registration
├── setup_mcp.cmd            Windows CMD wrapper — delegates to setup_mcp.sh via WSL
├── gallery/                 18 sample figures grouped by category
│   ├── README.md            Figure index and shared helper docs
│   ├── shared/              helpers.js + styles.js (skipped by figure discovery)
│   ├── diagram/             Node diagrams, flow charts, architecture illustrations (9 figures)
│   ├── timeline/            Horizontal timelines and event sequences (3 figures)
│   └── chart/               Bar/line/area/bubble/dumbbell charts (6 figures)
├── bin/
│   ├── d3figurer.js         Master CLI: server / render / batch / check / stop
│   ├── d3figurer-server.js  Starts render server directly
│   └── d3figurer-check.js   Runs one layout check / watch loop
├── src/
│   ├── server.js            FigurerServer — Chrome + HTTP server
│   ├── client.js            FigurerClient — HTTP client + hang detection
│   ├── checker.js           formatReport / checkAndReport / watchFigure / checkAllAndReport
│   ├── previews.js          Static gallery generator (inline SVG, no browser JS)
│   ├── live-previews.js     Live-reload gallery generator (browser loads figure.js directly)
│   ├── standalone.js        One-shot render without a running server
│   └── index.js             Public API — D3Figurer class + re-exports
└── tests/
    ├── test-checker.js          30 tests — formatReport corner cases
    ├── test-client.js           16 tests — FigurerClient methods
    ├── test-server-internals.js 18 tests — makeQueue, normalizePdfDates, FigurerServer, _loadFigureModules
    └── test-mcp-server.js       19 tests — JSON-RPC protocol and tool dispatch
```

---

## Architecture

### Install pattern (WSL2 / Linux)

All npm packages live on the **Linux filesystem** (`~/.d3figurer-work/`), never on `/mnt/c/`. node_modules on a 9p-mounted Windows drive is ~100× slower.

```
~/.d3figurer-work/d3figurer/node_modules   ← npm packages (d3, jsdom, puppeteer, …)
~/.d3figurer-work/puppeteer/               ← Chrome binary (PUPPETEER_CACHE_DIR)
~/.d3figurer-work/run/                     ← PID files, logs
```

`server.sh install` copies `package.json` there and runs `npm install`. Source files stay in the repo. `NODE_PATH` is injected at runtime.

Override work directory: `--work-dir <path>` or `D3FIGURER_WORK_DIR` env var.

### Two-process Chrome architecture

Chrome starts **once** via `server.sh start`. The Node render-server connects via `puppeteer.connect({ browserURL })` rather than launching its own Chrome:

- `server.sh restart` — only restarts the Node process; Chrome stays warm.
- Cold start: ~6 s. Renders after restart: ~0.3 s.
- `server.sh stop` — kills both processes.

### Serial render queue

All renders/checks share **one Chromium page** and are serialised through `makeQueue()` in `server.js`. Critical pattern — `tail = next.catch(() => {})` must be kept or the queue deadlocks after the first rejection:

```js
const next = tail.then(fn);
tail = next.catch(() => {}); // queue keeps running even if fn rejects
return next;                 // caller still sees the rejection
```

### Render formats

`POST /render` supports `format: 'pdf' | 'png' | 'svg'`:
- `pdf` — Puppeteer `page.pdf()` with viewport matching SVG dimensions
- `png` — Puppeteer `page.screenshot()` at 2× scale
- `svg` — raw SVG string written directly (no Puppeteer rendering)

### MCP server (`mcp_server.js`)

Minimal JSON-RPC 2.0 stdio server, no external SDK. Claude Code launches it via `mcp.sh`.

| Method | Behaviour |
|--------|-----------|
| `initialize` | Returns `protocolVersion`, `capabilities: {tools:{}}`, `serverInfo` |
| `notifications/initialized` | No-op |
| `tools/list` | Returns the `TOOLS` array (3 entries) |
| `tools/call` | Dispatches to `renderFigure`, `checkFigure`, or `serverStatus` |
| `ping` | Returns `{}` |
| unknown with id | Returns `{error:{code:-32601}}` |
| exception with id | Returns `{error:{code:-32603}}` |
| invalid JSON | Silently ignored |

Tool handlers call `client.isServerAvailable()` first and return a human-readable "Server not running" message if it fails, rather than throwing.

`D3FIGURER_PORT` env var sets the client port (default `9229`).

---

## Source module reference

### `src/server.js` — FigurerServer

```js
const s = new FigurerServer({ port, srcDir, fontCSS, idleMinutes, chromeOptions });
await s.start();
```

- `puppeteer` is lazily `require()`-d inside `start()` — never at module load time.
- `_internals` exported for unit tests only: `{ normalizePdfDates, makeQueue }`.
- `_loadFigureModules()` — recursive walk; skips `shared/` at any depth; supports both flat (`name/figure.js`) and two-level (`category/name/figure.js`) layouts, loaded as `category/name` keys. Reads `.svg` files alongside `figure.js` and injects them as `global.window.__CUSTOM_FLAGS`.

HTTP endpoints:
- `GET /` → `{ ready, figures }` — status
- `DELETE /` → graceful shutdown
- `POST /render` — `{ figure, outputPath, format?, reload? }`
- `POST /check` — `{ figure, screenshotPath?, reload? }` — returns overlaps, tooClose, clipped, boxOverflows, rectIntrusions, outsideBox
- `POST /load-url` — `{ url, screenshotPath? }` — Puppeteer navigates to URL; returns `{ ok, failedRequests }`

### `/check` issue categories

| Category | What it detects |
|----------|-----------------|
| `overlaps` | Two text elements whose bounding boxes overlap by more than 2px in both axes |
| `tooClose` | Text elements with gap < 8px horizontal or < 3px vertical |
| `clipped` | Text elements extending outside the SVG viewport |
| `boxOverflows` | Text whose centre is inside a filled `<rect>` but the text overflows the rect edge |
| `rectIntrusions` | Text outside a rect whose bounding box still overlaps the rect (arrow labels, etc.) |
| `outsideBox` | Text with `data-inside="id"` that is not fully contained in the `<rect data-box="id">` |

Use `data-skip-check` on a `<text>` or `<rect>` to exclude it from all checks.

Explicit containment assertion:
```xml
<rect data-box="node1" .../>
<text data-inside="node1">label</text>
```

### `src/client.js` — FigurerClient

```js
const client = new FigurerClient({ port, hangThresholdMs, hangHardTimeout, serverShPath });
```

- `isServerAvailable()` → `boolean` — 500 ms probe
- `getStatus()` → `{ ready, figures }`
- `render(name, outputPath, { format, reload })` — single render
- `renderBatch(figures, opts)` → `{ ok, total, errors }` — batch with hang detection
- `loadUrl(url, screenshotPath)` — `POST /load-url` (Puppeteer navigates to URL; optional screenshot)
- `checkFigure(name, opts)` → raw analysis object
- `shutdown()` → `boolean`

### `src/checker.js` — layout QA

- `formatReport(result, figure, opts)` — **pure function**, no I/O. Handles all six issue categories.
- `checkAndReport(client, figure, opts)` — runs one check and prints.
- `watchFigure(client, figure, opts)` — `fs.watch` with 250 ms debounce.
- `checkAllAndReport(client, figures, opts)` — runs checks on every figure, prints per-figure summary and overall pass/fail count. Returns `{ ok, total, results }`.

### `src/previews.js` — static gallery

Generates fully self-contained HTML files (no external scripts). Figures are rendered server-side via `figure.js` + jsdom and embedded as inline SVG.

```js
const { generatePreviews, checkPreviews, discoverFigures, flatName } = require('./previews');

generatePreviews(srcDir, previewDir, { fontCSS, title, figures })
  // → { ok, total, errors }

checkPreviews(previewDir, figureNames)
  // → { ok, total, errors }  — file-based only, no Chrome needed
```

- `discoverFigures(srcDir)` — recursive walk returning `['diagram/transformer', 'chart/adoption', ...]`. Skips `shared/`.
- `flatName(name)` — `'diagram/transformer'` → `'diagram_transformer'`.

### `src/live-previews.js` — live-reload gallery

Generates HTML that loads `figure.js` directly from source via `<script>` tags, so a browser refresh picks up edits without regenerating. Requires a browser require() shim for `d3`, `jsdom`, `helpers`, `styles`, `country-flag-icons`, and `data.json`.

```js
const { generateLivePreviews, checkLivePreviews } = require('./live-previews');

generateLivePreviews(srcDir, previewDir, { fontCSS, title, figures })
  // → { ok, total, errors }

await checkLivePreviews(previewDir, figureNames, { chromeUrl })
  // → { ok, total, errors }  — loads each figure in Chrome, checks for <svg> / .err
```

`checkLivePreviews` requires Chrome to be running (connects via `puppeteer.connect`).

### `src/index.js` — public API

Exports a `D3Figurer` convenience class plus named helpers:

```js
const D3Figurer = require('d3figurer');
const figurer = new D3Figurer({ port, srcDir, fontCSS });
await figurer.startServer();
await figurer.render('diagram/transformer', '/tmp/out.pdf', { format: 'pdf' });
await figurer.stopServer();
```

Named exports:
- `D3Figurer.FigurerClient`
- `D3Figurer.generatePreviews`, `D3Figurer.checkPreviews`
- `D3Figurer.generateLivePreviews`, `D3Figurer.checkLivePreviews`
- `D3Figurer.checkAllAndReport`
- `D3Figurer.discoverFigures`, `D3Figurer.flatName`

---

## Figure module contract

```js
'use strict';
module.exports = function () {
  return '<svg width="900" height="600">...</svg>';
};
```

- `module.exports` must be a function.
- Return value: HTML string with a root `<svg width="N" height="N">`.
- `shared/` in `srcDir` is always skipped by discovery.
- `data.json` alongside `figure.js` is hot-reloaded on check `--watch`.
- `.svg` files alongside `figure.js` are loaded as `global.window.__CUSTOM_FLAGS` (keyed by basename without extension).

### Gallery shared utilities (`gallery/shared/`)

- `helpers.js` — `makeSVG(W, H)`, `addMarker()`, `addText()`, `addIcon()`
- `styles.js` — `S.RED` (#e4003b), `S.FONT`, `S.PNG_W` (1600), `S.PDF_W` (900), `S.fontStyle()`

Gallery figures import with `require('../../shared/helpers')` (two levels up because they live in `gallery/category/name/`).

---

## `bin/d3figurer.js` — CLI

Commands: `server`, `render`, `batch`, `check`, `stop`.

### Batch command

```bash
node bin/d3figurer.js batch <outputDir> --src-dir <path>
node bin/d3figurer.js batch <outputDir> --src-dir <path> --preview-only
```

Renders all figures × all 3 formats (PNG, SVG, PDF) in one pass. Output structure:

```
output/
├── preview/   index.html + one <stem>.html per figure (inline SVG, download links)
├── png/       <stem>.png
├── svg/       <stem>.svg
└── pdf/       <stem>.pdf
```

`--preview-only` skips rendering and only rebuilds the HTML from existing output files.

After building, the batch command verifies `output/preview/index.html` loads in Chromium via `POST /load-url`.

The index page has: category label, figure name, White/Gray/Dark background toggle, filter by name/category/title, auto-sized iframes via `postMessage`.

---

## Gallery preview architecture

The preview is a static HTML site deployed to GitHub Pages. No server needed.

- **Figure pages** (`preview/<stem>.html`) — inline SVG generated at build time from `figure.js`. When in an iframe, JS hides header/downloads and posts `figureReady` with dimensions. When opened directly, shows title, download links (PDF/PNG/SVG), back link.
- **Index page** (`preview/index.html`) — `<iframe>` cards. `postMessage` listener auto-sizes each iframe to the correct SVG aspect ratio based on card width. White/Gray/Dark CSS class toggle. Filter searches name + category + title.
- **Output files** — `png/`, `svg/`, `pdf/` live one level up from `preview/`; download links use `../png/` etc.

---

## Testing

```bash
./test.sh              # quiet
./test.sh -v           # verbose
./test.sh "pattern"    # filter by test name regex
```

`NODE_PATH=$HOME/.d3figurer-work/d3figurer/node_modules` is set by `test.sh`. Unit tests need no running server.

| File | Tests | What is covered |
|------|------:|-----------------|
| `test-checker.js` | 30 | `formatReport` — all sections, corner cases |
| `test-client.js` | 16 | `isServerAvailable`, `_logHang`, `_requestTimed`, `renderBatch`, `shutdown` |
| `test-server-internals.js` | 18 | `makeQueue`, `normalizePdfDates`, `FigurerServer` constructor, `_loadFigureModules` |
| `test-mcp-server.js` | 19 | JSON-RPC protocol, tool dispatch, server-down handling |

Writing new tests: use `node:test` + `node:assert/strict`, no mocha/jest. Never `require('puppeteer')` in tests.

---

## Server lifecycle

```bash
./server.sh install                       # one-time: install node_modules + Chrome
./server.sh start --src-dir <path>        # start Chrome + render server (blocks until ready)
./server.sh stop                          # graceful stop (both processes)
./server.sh restart                       # restart render-server only (Chrome stays warm)
./server.sh status
./server.sh log
./server.sh chrome-log
```

Default ports: `9229` (render server), `9230` (Chrome DevTools).

---

## Known bugs fixed

| Bug | Location | Fix |
|-----|----------|-----|
| Queue deadlock after rejection | `makeQueue()` in `server.js` | `tail = next.catch(() => {})` |
| `_internals` export dropped on NTFS | `server.js` | Append via Python or `printf` — Claude Code's Edit tool drops trailing lines on NTFS |
| Puppeteer loads at module parse | `server.js` | `require('puppeteer')` moved inside `start()` |
| Puppeteer loads at module parse | `standalone.js` | `require('puppeteer')` moved inside `render()` |
| `check` command shows `Figure: undefined` | `bin/d3figurer.js` | `runCheck` now uses `formatReport` from `checker.js` — full overlap details displayed |
| `check` command ignores `tooClose`/`boxOverflows` | `bin/d3figurer.js` | Exit code 1 now triggers on all issue categories |

---

## Using d3figurer from a project (not gallery)

You can keep figures inside the project repository and point d3figurer at them with `--src-dir`.

### Directory layout (flat — one level)

```
myproject/
└── figures/
    ├── shared/           ← skipped by discovery; put helpers + styles here
    │   ├── styles.js     ← project-specific palette
    │   └── helpers.js    ← copy of gallery/shared/helpers.js; require('./styles')
    ├── architecture/
    │   └── figure.js     ← figure name: "architecture"
    └── timeline/
        └── figure.js     ← figure name: "timeline"
```

Figures import shared utilities one level up:
```js
const S = require('../shared/styles.js');
const { makeSVG, addMarker, addText } = require('../shared/helpers.js');
```

### Matching the project's font

In `shared/styles.js`, override `FONT` and `fontStyle()` to match the LaTeX stylesheet:

```js
FONT: "'Fira Sans', Arial, sans-serif",
fontStyle(svgNode) {
  svgNode.append('defs').append('style').text(
    "@import url('https://fonts.googleapis.com/css2?family=Fira+Sans:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap');"
  );
},
```

### Workflow

```bash
# 1. Start server pointing at project figures
./server.sh start --src-dir /path/to/myproject/figures

# 2. Render a figure to PDF
NODE_PATH=$HOME/.d3figurer-work/d3figurer/node_modules \
  node bin/d3figurer.js render architecture /path/to/myproject/archi.pdf --format pdf

# 3. Check layout
NODE_PATH=$HOME/.d3figurer-work/d3figurer/node_modules \
  node bin/d3figurer.js check architecture

# 4. If PDF is locked (Windows viewer open), render to /tmp first
NODE_PATH=$HOME/.d3figurer-work/d3figurer/node_modules \
  node bin/d3figurer.js render timeline /tmp/timeline.pdf --format pdf
cp /tmp/timeline.pdf /path/to/myproject/timeline.pdf
```

### Restart gotcha

`server.sh restart` restarts only the Node process without `--src-dir`, losing the figures.
Use **stop + start** when you need to change or reload `--src-dir`:

```bash
./server.sh stop && ./server.sh start --src-dir /path/to/figures
```

### LaTeX integration

Include d3figurer PDFs in LaTeX with:
```latex
\includegraphics[width=0.95\textwidth]{figure.pdf}
```

When removing LaTeX packages that write to `.aux` (e.g. `pgfgantt`), delete `main.aux` before the first rebuild to avoid "Undefined control sequence" errors from stale entries.

---

## Key principles

1. **Linux FS for packages** — never `npm install` into `/mnt/c/`.
2. **One Chrome, many renders** — Chrome starts once; Node connects via DevTools protocol.
3. **Queue correctness** — always `tail = next.catch(() => {})` in `makeQueue`.
4. **Lazy Puppeteer** — `require('puppeteer')` stays inside `start()` and `render()`; never at module load.
5. **Pure formatReport** — no I/O, no side effects.
6. **Figure contract** — every `figure.js` returns an SVG string with `width="N" height="N"`.
7. **MCP graceful degradation** — return "Server not running" text rather than throwing.
8. **Gallery output is generated** — `gallery/output/` is in `.gitignore`; built by CI.
9. **NODE_PATH required for CLI** — always prefix CLI calls with `NODE_PATH=$HOME/.d3figurer-work/d3figurer/node_modules`.
10. **src-dir on `/mnt/c/` is fine** — only node_modules needs Linux FS; figure sources can live anywhere.
