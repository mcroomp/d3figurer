/**
 * live-previews.js — generate and check live-reload iframe preview galleries.
 *
 * Each figure page loads its dependencies as plain <script> tags (no ES modules),
 * which works with both file:// and http:// without CORS restrictions.
 *
 * Strategy: at generation time, transform each source file into a global-script
 * variant that sets / reads window globals instead of using import / export:
 *   d3.min.js      → (unchanged) sets window.d3
 *   jsdom-shim.js  → sets window.JSDOM
 *   {stem}.data.js → sets window.__fig_data
 *   {stem}.run.js  → reads globals, calls figure, inserts SVG
 *
 * Public API:
 *   generateLivePreviews(srcDir, previewDir, options) → Promise<{ ok, total, errors }>
 *   checkLivePreviews(previewDir, figureNames, options) → Promise<{ ok, total, errors }>
 */

import fs   from 'fs';
import path  from 'path';
import { discoverFigures, flatName } from './previews.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function findPkgRoot(resolvedPath) {
  let dir = path.dirname(resolvedPath);
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Cannot find package root for: ' + resolvedPath);
    dir = parent;
  }
}

/** Read any .svg files in a figure's source directory; copy them to previewDir. */
function loadFigureCustomSvgs(figDir, previewDir) {
  const result = {};
  try {
    for (const f of fs.readdirSync(figDir).filter(f => f.endsWith('.svg'))) {
      try {
        result[path.basename(f, '.svg')] = fs.readFileSync(path.join(figDir, f), 'utf8');
        fs.copyFileSync(path.join(figDir, f), path.join(previewDir, f));
      } catch (_) {}
    }
  } catch (_) {}
  return result;
}

// ── Source transformers ───────────────────────────────────────────────────────

/**
 * Transform a styles.js (export default {...}) into a global-setter script.
 * Sets window.__d3fig_styles.
 */
function transformStyles(src) {
  return src.replace(/^\s*export\s+default\s+/m, 'window.__d3fig_styles = ').trimEnd() + '\n';
}

/**
 * Transform helpers.js into a global-setter script.
 * Removes import lines, wraps in IIFE that reads window globals and sets window.__d3fig_helpers.
 */
function transformHelpers(src) {
  // Collect destructured names from the export statement
  const exportMatch = src.match(/export\s*\{([^}]+)\}/);
  const exportedNames = exportMatch
    ? exportMatch[1].split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const body = src
    .replace(/^import\s+.*?;\n/gm, '')        // remove all import lines
    .replace(/^export\s*\{[^}]+\};\s*$/m, ''); // remove export {...}

  const globalSetters = exportedNames.map(n => `${n}: ${n}`).join(', ');
  return `(function() {
var d3    = window.d3;
var JSDOM = window.JSDOM;
var S     = window.__d3fig_styles;
${body.trim()}
window.__d3fig_helpers = { ${globalSetters} };
Object.assign(window, window.__d3fig_helpers);
})();\n`;
}

/**
 * Transform data.js (export default [...]) into a global-setter script.
 * Sets window.__d3fig_data.
 */
function transformData(src) {
  return src.replace(/^\s*export\s+default\s+/m, 'window.__d3fig_data = ').trimEnd() + '\n';
}

/**
 * Transform figure.js into a self-contained runner script.
 * Removes imports (replaces with window-global reads), transforms export default function
 * into an immediate call that inserts the SVG into the page.
 *
 * @param {string} src      - figure.js source
 * @param {string} stem     - flatName of the figure (for postMessage)
 * @param {object} extraGlobals - map of bare specifier → window expression for extra deps
 */
function transformFigure(src, stem, extraGlobals = {}) {
  // Parse import statements to build local variable assignments from window globals
  const preamble = [];
  let body = src.replace(
    /^import\s+(.*?)\s+from\s+['"]([^'"]+)['"];\n/gm,
    (match, spec, mod) => {
      const g = extraGlobals[mod];
      if (g) {
        if (spec.startsWith('* as ')) {
          preamble.push(`var ${spec.slice(5)} = ${g};`);
        } else {
          preamble.push(`var ${spec} = ${g};`);
        }
      }
      return '';
    },
  );

  // Replace `export default function [name]() {` with a named function declaration
  body = body.replace(/export\s+default\s+function\s*(\w*)\s*\(/, (_, name) =>
    `function ${name || '__figure'}(`);
  // Determine the function name (fallback to __figure)
  const fnNameMatch = body.match(/^function\s+(\w+)\s*\(/m);
  const fnName = fnNameMatch ? fnNameMatch[1] : '__figure';

  return `(function() {
var d3   = window.d3;
var S    = window.__d3fig_styles;
var data = window.__d3fig_data;
${preamble.join('\n')}
${body.trim()}
var svgHtml = ${fnName}();
document.body.insertAdjacentHTML('beforeend', svgHtml);
var svg = document.querySelector('svg');
if (svg) {
  if (window.self !== window.top) {
    document.querySelector('h2').style.display = 'none';
    document.body.style.padding = '0';
  }
  var w = parseFloat(svg.getAttribute('width'))  || svg.viewBox.baseVal.width  || 900;
  var h = parseFloat(svg.getAttribute('height')) || svg.viewBox.baseVal.height || 500;
  window.parent.postMessage({ type: 'figureReady', name: '${stem}', width: w, height: h }, '*');
}
})();\n`;
}

// ── d3figurer core helpers (browser-compatible IIFE, sets window.makeSVG etc.) ──

/**
 * Transform d3figurer/src/helpers.js into a browser-compatible IIFE.
 * Strips ESM imports/exports, reads d3 and JSDOM from window globals,
 * and exposes makeSVG / addMarker / addIcon as window properties.
 */
function generateD3FigurerBrowserScript(src) {
  const body = src
    .replace(/^import\s+.*?;\n/gm, '')         // strip import lines
    .replace(/^export\s*\{[^}]+\};\s*$/m, ''); // strip export {...}

  return `(function() {
var d3    = window.d3;
var JSDOM = window.JSDOM;
${body.trim()}
window.makeSVG   = typeof makeSVG   !== 'undefined' ? makeSVG   : window.makeSVG;
window.addMarker = typeof addMarker !== 'undefined' ? addMarker : window.addMarker;
window.addIcon   = typeof addIcon   !== 'undefined' ? addIcon   : window.addIcon;
})();\n`;
}

// ── JSDOM global shim (plain script, sets window.JSDOM) ──────────────────────

const JSDOM_GLOBAL_SRC = `\
// Browser JSDOM shim — wraps the real DOM so figure helpers work unchanged.
window.JSDOM = class JSDOM {
  constructor() {
    var body = document.createElement('div');
    this.window = {
      document: {
        body:             body,
        createElement:    function(t)      { return document.createElement(t); },
        createElementNS:  function(ns, t)  { return document.createElementNS(ns, t); },
        createTextNode:   function(txt)    { return document.createTextNode(txt); },
        querySelector:    function(sel)    { return body.querySelector(sel); },
        querySelectorAll: function(sel)    { return body.querySelectorAll(sel); },
      }
    };
  }
};
`;

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildLiveFigureHtml(name, opts) {
  const { fontCSS = '', customSvgsJson = '{}', stem = '', extraScripts = [] } = opts;

  // Inline call script: invokes __d3fig_figure(), inserts SVG, notifies parent
  const callScript = `(function() {
var svgHtml = (window.__d3fig_figure || function(){ return ''; })({
  data: window.__d3fig_data,
  S: window.__d3fig_styles,
  d3: window.d3,
  assets: window.__d3fig_assets || {},
});
document.body.insertAdjacentHTML('beforeend', svgHtml);
var svg = document.querySelector('svg');
if (svg) {
  if (window.self !== window.top) {
    document.querySelector('h2').style.display = 'none';
    document.body.style.padding = '0';
  }
  var w = parseFloat(svg.getAttribute('width'))  || svg.viewBox.baseVal.width  || 900;
  var h = parseFloat(svg.getAttribute('height')) || svg.viewBox.baseVal.height || 500;
  window.parent.postMessage({ type: 'figureReady', name: '${stem}', width: w, height: h }, '*');
}
})();`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Cache-Control" content="no-store">
<title>${name}</title>
<style>
${fontCSS}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: white; }
body { padding: 16px; font-family: 'Montserrat', system-ui, Arial, sans-serif; }
h2 { font-size: 11px; font-weight: 700; color: #e4003b; margin-bottom: 10px;
     font-family: monospace; text-transform: uppercase; letter-spacing: .05em; }
svg { max-width: 100%; height: auto; display: block;
      box-shadow: 0 1px 6px rgba(0,0,0,.12); }
.err { color: #e4003b; font-size: 12px; font-family: monospace; margin-top: 8px; }
</style>
</head>
<body>
<h2>${name}</h2>
<script src="d3.min.js"></script>
<script src="jsdom-shim.js"></script>
<script src="d3figurer-browser.js"></script>
<script src="styles.js"></script>
<script src="helpers.js"></script>
${extraScripts.map(s => `<script src="${s}"></script>`).join('\n')}
<script>window.__CUSTOM_FLAGS = ${customSvgsJson};</script>
<script src="../${name}/data.js"></script>
<script src="../${name}/figure.js"></script>
<script>${callScript}</script>
</body>
</html>`;
}

function buildLiveIndexHtml(entries, opts) {
  const { fontCSS = '', title = 'd3figurer gallery' } = opts;

  const cards = entries.map(({ stem, name }) => `
  <div class="card" data-name="${stem}">
    <div class="card-header">
      <span class="card-name">${name}</span>
      <a class="card-open" href="${stem}.html" target="_blank">open ↗</a>
    </div>
    <div class="card-body white" id="body-${stem}">
      <iframe src="${stem}.html" scrolling="no" title="${name}"></iframe>
    </div>
  </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Cache-Control" content="no-store">
<title>${title}</title>
<style>
${fontCSS}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Montserrat', system-ui, Arial, sans-serif; background: #f0f0f0; }
header { background: #e4003b; color: white; padding: 12px 24px;
         position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.2);
         display: flex; align-items: baseline; gap: 14px; }
header h1 { font-size: 16px; font-weight: 700; }
header span { font-size: 12px; opacity: .75; }
#toolbar { background: white; border-bottom: 1px solid #ddd;
           padding: 8px 24px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
label { font-size: 11px; font-weight: 700; color: #666;
        text-transform: uppercase; letter-spacing: .05em; }
#filter { padding: 5px 10px; border: 1px solid #ccc; border-radius: 4px;
          font-family: inherit; font-size: 13px; width: 200px; }
.btns { display: flex; gap: 5px; }
.btn { padding: 5px 12px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;
       font-family: inherit; font-size: 11px; font-weight: 700; background: white; color: #666; }
.btn.active { background: #e4003b; border-color: #e4003b; color: white; }
#count { margin-left: auto; font-size: 11px; color: #aaa; }
main { padding: 16px 24px; display: grid;
       grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 16px; }
.card { background: white; border-radius: 8px;
        box-shadow: 0 1px 4px rgba(0,0,0,.12); overflow: hidden; }
.card-header { padding: 8px 14px; background: #fafafa; border-bottom: 1px solid #eee;
               display: flex; align-items: baseline; gap: 10px; }
.card-name { font-size: 12px; font-weight: 700; color: #333; font-family: monospace; }
.card-open { margin-left: auto; font-size: 10px; color: #bbb; text-decoration: none; }
.card-open:hover { color: #e4003b; }
.card-body { overflow: hidden; }
.card-body.white { background: white; }
.card-body.gray  { background: #c0c0c0; }
.card-body.dark  { background: #222; }
.card-body iframe { display: block; width: 100%; height: 200px; border: none; background: transparent; }
.hidden { display: none !important; }
</style>
</head>
<body>
<header>
  <h1>${title}</h1>
  <span>${entries.length} figures</span>
</header>
<div id="toolbar">
  <label>Filter:</label>
  <input id="filter" type="text" placeholder="filter figures…" oninput="applyFilter()">
  <label>Background:</label>
  <div class="btns">
    <button class="btn active" onclick="setBg('white',this)">White</button>
    <button class="btn" onclick="setBg('gray',this)">Gray</button>
    <button class="btn" onclick="setBg('dark',this)">Dark</button>
  </div>
  <span id="count"></span>
</div>
<main id="grid">
${cards}
</main>
<script>
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'figureReady') return;
  var body = document.getElementById('body-' + e.data.name);
  if (!body) return;
  var iframe = body.querySelector('iframe');
  if (!iframe) return;
  iframe.style.height = Math.round((body.clientWidth / e.data.width) * e.data.height) + 'px';
});
function applyFilter() {
  var q = document.getElementById('filter').value.toLowerCase();
  var n = 0;
  document.querySelectorAll('.card').forEach(function(c) {
    var match = !q || c.dataset.name.includes(q);
    c.classList.toggle('hidden', !match);
    if (match) n++;
  });
  var total = document.querySelectorAll('.card').length;
  document.getElementById('count').textContent = (q ? n + ' / ' : '') + total + ' figures';
}
function setBg(bg, btn) {
  document.querySelectorAll('.btns .btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.querySelectorAll('.card-body').forEach(function(b) {
    b.classList.remove('white', 'gray', 'dark');
    b.classList.add(bg);
  });
}
applyFilter();
</script>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a preview gallery using plain <script> tags (no ES modules).
 * All source files are transformed into global-setter scripts so they work
 * with file:// URLs without any CORS restrictions.
 *
 * @param {string}   srcDir      Directory containing figure modules
 * @param {string}   previewDir  Output directory for the preview HTML files
 * @param {object}   options
 * @param {string}   [options.fontCSS]    CSS injected into every page
 * @param {string}   [options.title]      Gallery title
 * @param {string[]} [options.figures]    Explicit figure names (default: auto-discover)
 * @returns {Promise<{ ok: number, total: number, errors: Array<{name, message}> }>}
 */
async function generateLivePreviews(srcDir, previewDir, options = {}) {
  const { fontCSS = '', title = 'd3figurer gallery', figures: figureNames } = options;
  const names = figureNames || discoverFigures(srcDir);

  fs.mkdirSync(previewDir, { recursive: true });

  // d3.min.js — UMD, sets window.d3
  const d3Url  = import.meta.resolve('d3');
  const d3Root = findPkgRoot(new URL(d3Url).pathname);
  fs.copyFileSync(path.join(d3Root, 'dist', 'd3.min.js'), path.join(previewDir, 'd3.min.js'));

  // jsdom-shim.js — plain script, sets window.JSDOM
  fs.writeFileSync(path.join(previewDir, 'jsdom-shim.js'), JSDOM_GLOBAL_SRC, 'utf8');

  // d3figurer-browser.js — browser-compatible makeSVG / addMarker / addIcon
  const d3figHelpersPath = new URL('./helpers.js', import.meta.url).pathname;
  if (fs.existsSync(d3figHelpersPath)) {
    const d3figSrc = fs.readFileSync(d3figHelpersPath, 'utf8');
    fs.writeFileSync(path.join(previewDir, 'd3figurer-browser.js'),
      generateD3FigurerBrowserScript(d3figSrc), 'utf8');
  }

  // styles.js — transform shared/styles.js to global setter
  const sharedDir = path.join(srcDir, 'shared');
  const stylesSrc = path.join(sharedDir, 'styles.js');
  if (fs.existsSync(stylesSrc)) {
    fs.writeFileSync(path.join(previewDir, 'styles.js'),
      transformStyles(fs.readFileSync(stylesSrc, 'utf8')), 'utf8');
  }

  // helpers.js — transform shared/helpers.js to global setter
  const helpersSrc = path.join(sharedDir, 'helpers.js');
  if (fs.existsSync(helpersSrc)) {
    fs.writeFileSync(path.join(previewDir, 'helpers.js'),
      transformHelpers(fs.readFileSync(helpersSrc, 'utf8')), 'utf8');
  }

  // Extra bare-specifier globals (e.g. country-flag-icons)
  const extraGlobals = {};
  const extraScripts = [];
  try {
    const flagsModule = await import('country-flag-icons/string/3x2');
    const flagsData   = flagsModule.default || flagsModule;
    fs.writeFileSync(path.join(previewDir, 'country-flag-icons.js'),
      `window.__d3fig_assets = window.__d3fig_assets || {};\nwindow.__d3fig_assets.flags = ${JSON.stringify(flagsData)};\n`, 'utf8');
    extraScripts.push('country-flag-icons.js');
  } catch (_) {}

  const errors  = [];
  const entries = [];

  for (const name of names) {
    const stem   = flatName(name);
    const figDir = path.join(srcDir, name);
    const customSvgsJson = JSON.stringify(loadFigureCustomSvgs(figDir, previewDir));

    const html = buildLiveFigureHtml(name, { fontCSS, customSvgsJson, stem, extraScripts });
    try {
      fs.writeFileSync(path.join(previewDir, `${stem}.html`), html, 'utf8');
      entries.push({ stem, name });
    } catch (e) {
      errors.push({ name, message: e.message });
    }
  }

  fs.writeFileSync(
    path.join(previewDir, 'index.html'),
    buildLiveIndexHtml(entries, { fontCSS, title }),
    'utf8',
  );

  return { ok: names.length - errors.length, total: names.length, errors };
}

/**
 * Verify that live preview iframes render correctly in a real browser.
 * Uses file:// URLs — the plain <script> approach has no CORS restrictions.
 */
async function checkLivePreviews(previewDir, figureNames, options = {}) {
  const { chromeUrl = 'http://127.0.0.1:9230' } = options;
  const { default: puppeteer } = await import('puppeteer');

  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: chromeUrl });
  } catch (e) {
    throw new Error(`Cannot connect to Chrome at ${chromeUrl} — is server.sh running? (${e.message})`);
  }

  const errors = [];

  for (const name of figureNames) {
    const stem   = flatName(name);
    const figUrl = 'file://' + path.join(previewDir, `${stem}.html`).replace(/\\/g, '/');
    const page   = await browser.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

    try {
      await page.goto(figUrl, { waitUntil: 'networkidle0', timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('svg') || document.querySelector('.err'),
        { timeout: 10000 }).catch(() => {});

      const [svgPresent, inPageErr] = await page.evaluate(() => {
        const svg = document.querySelector('svg');
        const err = document.querySelector('.err');
        return [Boolean(svg), err ? err.textContent.trim() : null];
      });

      if (!svgPresent)               errors.push({ name, message: 'no <svg> rendered' });
      else if (inPageErr)            errors.push({ name, message: inPageErr });
      else if (consoleErrors.length) errors.push({ name, message: consoleErrors[0] });
    } catch (e) {
      errors.push({ name, message: e.message });
    } finally {
      await page.close();
    }
  }

  await browser.disconnect();
  return { ok: figureNames.length - errors.length, total: figureNames.length, errors };
}

export { generateLivePreviews, checkLivePreviews };
