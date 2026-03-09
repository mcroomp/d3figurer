'use strict';
/**
 * live-previews.js — generate and check live-reload iframe preview galleries.
 *
 * Unlike static previews (inline SVG), live previews load figure.js directly
 * from disk via <script> tags, so the browser picks up source changes on
 * refresh without re-running the generator.
 *
 * Each figure page includes a browser require() shim that maps:
 *   require('jsdom')          → BrowserJSDOM (wraps native browser DOM)
 *   require('d3')             → window.d3 (loaded from d3.min.js)
 *   require('.../helpers')    → window.__HELPERS (helpers.js inlined at build time)
 *   require('.../styles')     → window.__S (styles object from styles.js)
 *   require('country-flag-icons/...') → window.__FLAGS_3X2
 *
 * Public API:
 *   generateLivePreviews(srcDir, previewDir, options) → { ok, total, errors }
 *   checkLivePreviews(previewDir, figureNames, options) → Promise<{ ok, total, errors }>
 */

const fs   = require('fs');
const path = require('path');
const { discoverFigures, flatName } = require('./previews');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Walk up from a resolved module path to find the package root (has package.json). */
function findPkgRoot(resolvedMain) {
  let dir = path.dirname(resolvedMain);
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Cannot find package root for: ' + resolvedMain);
    dir = parent;
  }
}

/** Try to load country-flag-icons JSON; returns '{}' if not installed. */
function loadFlagsJson() {
  try { return JSON.stringify(require('country-flag-icons/string/3x2')); } catch (_) { return '{}'; }
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

// ── HTML builders ─────────────────────────────────────────────────────────────

/**
 * Build the per-figure HTML page for a live preview.
 *
 * The page loads d3.min.js, inlines helpers.js source (so require('jsdom'),
 * require('d3'), require('./styles') all resolve), then loads figure.js from
 * its source path via a <script> tag.  When the figure changes on disk, a
 * browser refresh picks up the new version without regenerating this HTML.
 */
function buildLiveFigureHtml(name, opts) {
  const { fontCSS = '', helpersSrc, stylesJson, flagsJson = '{}', customSvgsJson = '{}', dataJsRelPath = null, figureJsRelPath } = opts;
  const stem = flatName(name);

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
<script>
// ── Injected data ──────────────────────────────────────────────────────────
window.__S           = ${stylesJson};
window.__S.fontStyle = function() {};  // no-op in browser
window.__FLAGS_3X2   = ${flagsJson};
window.__CUSTOM_FLAGS = ${customSvgsJson};
window.__FIGURE_DATA  = null; // loaded dynamically via loadScript (data.js)

// ── Browser JSDOM shim ─────────────────────────────────────────────────────
// figure.js calls: const { JSDOM } = require('jsdom'); new JSDOM('...')
// In the browser we wrap the real DOM instead.
class BrowserJSDOM {
  constructor() {
    const body = document.createElement('div');
    this.window = {
      document: {
        body,
        createElement:    function(t)     { return document.createElement(t); },
        createElementNS:  function(ns, t) { return document.createElementNS(ns, t); },
        createTextNode:   function(txt)   { return document.createTextNode(txt); },
        querySelector:    function(sel)   { return body.querySelector(sel); },
        querySelectorAll: function(sel)   { return body.querySelectorAll(sel); },
      }
    };
  }
}

// ── require() shim ─────────────────────────────────────────────────────────
window.require = function(id) {
  if (id === 'jsdom')                              return { JSDOM: BrowserJSDOM };
  if (id === 'd3')                                 return window.d3;
  if (id.includes('helpers'))                      return window.__HELPERS;
  if (id.includes('styles'))                       return window.__S;
  if (id.startsWith('country-flag-icons'))         return window.__FLAGS_3X2;
  if (id.includes('data.js') || id.includes('data.json')) return window.__FIGURE_DATA;
  throw new Error('Cannot require: ' + id);
};

function loadScript(src) {
  return new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = src + '?t=' + Date.now();  // cache-bust for live reload
    s.onload  = resolve;
    s.onerror = function() { reject(new Error('Failed to load: ' + src)); };
    document.head.appendChild(s);
  });
}

async function main() {
  await loadScript('d3.min.js');

  // Load data.js via script tag (cache-busted) — avoids CORS issues with file:// URLs
  ${dataJsRelPath ? `window.module = { exports: null };
  await loadScript('${dataJsRelPath}');
  window.__FIGURE_DATA = window.module.exports;` : '// no data.js for this figure'}

  // helpers.js inlined at gallery-generation time so require('d3')/require('jsdom')
  // inside it resolve via the shim above.
  {
    const module = { exports: {} };
${helpersSrc}
    window.__HELPERS = module.exports;
  }

  window.module = { exports: {} };
  await loadScript('${figureJsRelPath || '../src/' + name + '/figure.js'}');

  const fn = window.module.exports;
  if (typeof fn !== 'function') {
    document.body.innerHTML += '<p class="err">figure.js did not export a function</p>';
    return;
  }

  const svgHtml = fn();
  document.body.insertAdjacentHTML('beforeend', svgHtml);

  // Notify parent gallery frame (for auto-sizing iframes)
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
}

main().catch(function(err) {
  console.error('[live-preview] ${name}:', err);
  document.body.innerHTML += '<p class="err">Error: ' + err.message + '</p>';
});
</script>
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
 * Generate a live-reload iframe preview gallery.
 *
 * Each figure page loads figure.js directly from the source tree via a
 * <script> tag, so refreshing the browser picks up edits without re-running
 * the generator.  d3.min.js is copied once into previewDir; helpers.js is
 * inlined into every figure page at generation time.
 *
 * @param {string}   srcDir      Directory containing figure modules (e.g. figures/d3/src)
 * @param {string}   previewDir  Output directory for the preview HTML files
 * @param {object}   options
 * @param {string}   [options.fontCSS]    CSS injected into every page (e.g. @font-face blocks)
 * @param {string}   [options.title]      Gallery title shown in the header
 * @param {string[]} [options.figures]    Explicit list of figure names (default: auto-discover)
 * @returns {{ ok: number, total: number, errors: Array<{name, message}> }}
 */
function generateLivePreviews(srcDir, previewDir, options = {}) {
  const { fontCSS = '', title = 'd3figurer gallery', figures: figureNames } = options;
  const names = figureNames || discoverFigures(srcDir);

  fs.mkdirSync(previewDir, { recursive: true });

  // Copy d3.min.js into previewDir (browsers can't follow node_modules symlinks)
  const d3Root = findPkgRoot(require.resolve('d3'));
  fs.copyFileSync(
    path.join(d3Root, 'dist', 'd3.min.js'),
    path.join(previewDir, 'd3.min.js'),
  );

  // Read helpers.js source once — inlined into every figure page
  const helpersSrc = fs.readFileSync(path.join(srcDir, 'shared', 'helpers.js'), 'utf8');

  // Build styles JSON (strip function-valued properties — they can't serialise)
  const styles = (() => { try { return require(path.join(srcDir, 'shared', 'styles.js')); } catch (_) { return {}; } })();
  const stylesJson = JSON.stringify(
    Object.fromEntries(Object.entries(styles).filter(([, v]) => typeof v !== 'function')),
  );

  const flagsJson = loadFlagsJson();

  const errors  = [];
  const entries = [];

  for (const name of names) {
    const stem = flatName(name);
    const figDir = path.join(srcDir, name);
    const customSvgsJson = JSON.stringify(loadFigureCustomSvgs(figDir, previewDir));
    const dataJsPath = path.join(figDir, 'data.js');
    const dataJsRelPath = fs.existsSync(dataJsPath)
      ? path.relative(previewDir, dataJsPath).replace(/\\/g, '/')
      : null;

    const figureJsRelPath = path.relative(previewDir, path.join(figDir, 'figure.js')).replace(/\\/g, '/');
    const html = buildLiveFigureHtml(name, { fontCSS, helpersSrc, stylesJson, flagsJson, customSvgsJson, dataJsRelPath, figureJsRelPath });
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
 *
 * Connects to the already-running Chrome instance (started by server.sh),
 * loads preview/index.html, and checks each figure's iframe for:
 *   - An <svg> element (figure rendered successfully)
 *   - No .err element (no "did not export a function" etc.)
 *   - No browser console errors
 *
 * Requires server.sh to be running (Chrome must be on chromeUrl).
 *
 * @param {string}   previewDir   Directory written by generateLivePreviews
 * @param {string[]} figureNames  Figure names to check
 * @param {object}   options
 * @param {string}   [options.chromeUrl]  Chrome DevTools URL (default: 'http://127.0.0.1:9230')
 * @returns {Promise<{ ok: number, total: number, errors: Array<{name, message}> }>}
 */
async function checkLivePreviews(previewDir, figureNames, options = {}) {
  const { chromeUrl = 'http://127.0.0.1:9230' } = options;
  const puppeteer = require('puppeteer');

  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: chromeUrl });
  } catch (e) {
    throw new Error(`Cannot connect to Chrome at ${chromeUrl} — is server.sh running? (${e.message})`);
  }

  // Check each figure page individually — more reliable than the gallery iframe approach
  // because file:// URLs don't trigger networkidle0 for nested iframes.
  const errors = [];

  for (const name of figureNames) {
    const stem    = flatName(name);
    const figUrl  = 'file://' + path.join(previewDir, `${stem}.html`).replace(/\\/g, '/');
    const page    = await browser.newPage();
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

    try {
      await page.goto(figUrl, { waitUntil: 'networkidle0', timeout: 15000 });
      // Wait for the async main() inside the figure page to finish rendering
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

module.exports = { generateLivePreviews, checkLivePreviews };
