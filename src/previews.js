'use strict';
/**
 * previews.js — generate and check static figure preview galleries.
 *
 * Each figure is rendered server-side (via figure.js + jsdom) and embedded as
 * inline SVG, so the resulting HTML files are fully self-contained — no browser
 * require() shims, no d3.min.js copy, no iframes loading remote scripts.
 *
 * Public API:
 *   generatePreviews(srcDir, previewDir, options) → { ok, total, errors }
 *   checkPreviews(previewDir, figureNames)        → { ok, total, errors }
 *   discoverFigures(srcDir)                       → string[]
 *   flatName(name)                                → string
 */

const fs   = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recursively find all figure names (dirs containing figure.js, skipping 'shared'). */
function discoverFigures(dir, prefix = '') {
  const names = [];
  for (const entry of fs.readdirSync(dir)) {
    if (entry === 'shared') continue;
    const full = path.join(dir, entry);
    if (!fs.statSync(full).isDirectory()) continue;
    const name = prefix ? `${prefix}/${entry}` : entry;
    if (fs.existsSync(path.join(full, 'figure.js'))) {
      names.push(name);
    } else {
      names.push(...discoverFigures(full, name));
    }
  }
  return names;
}

/** Convert a figure name like 'diagram/transformer' to a flat filename stem. */
function flatName(name) {
  return name.replace(/\//g, '_');
}

/** Call figure.js in Node (server-side jsdom) and return its SVG string. */
function renderInlineSvg(srcDir, name) {
  try {
    const figPath = path.join(srcDir, name, 'figure.js');
    try { delete require.cache[require.resolve(figPath)]; } catch (_) {}
    return { svg: require(figPath)(), error: null };
  } catch (e) {
    const msg = e.message.slice(0, 80).replace(/</g, '&lt;');
    return {
      svg: `<svg viewBox="0 0 500 80" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="80" fill="#1a0808"/>
  <text x="12" y="26" fill="#e4003b" font-size="13" font-family="monospace">Error: ${name}</text>
  <text x="12" y="50" fill="#aaa"    font-size="11" font-family="monospace">${msg}</text>
</svg>`,
      error: e.message,
    };
  }
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildFigureHtml(name, svg, options = {}) {
  const { fontCSS = '' } = options;
  const stem = flatName(name);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
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
</style>
</head>
<body>
<h2>${name}</h2>
${svg}
<script>
(function() {
  // Hide chrome when embedded in gallery iframe
  if (window.self !== window.top) {
    document.querySelector('h2').style.display = 'none';
    document.body.style.padding = '0';
  }
  var svg = document.querySelector('svg');
  if (!svg) return;
  var w = parseFloat(svg.getAttribute('width'))  || svg.viewBox.baseVal.width  || 900;
  var h = parseFloat(svg.getAttribute('height')) || svg.viewBox.baseVal.height || 500;
  window.parent.postMessage({ type: 'figureReady', name: '${stem}', width: w, height: h }, '*');
})();
</script>
</body>
</html>`;
}

function buildIndexHtml(entries, options = {}) {
  const { fontCSS = '', title = 'd3figurer gallery' } = options;
  const cards = entries.map(({ stem, name, error }) => `
  <div class="card${error ? ' has-error' : ''}" data-name="${stem}">
    <div class="card-header">
      <span class="card-name">${name}</span>
      <a class="card-open" href="${stem}.html" target="_blank">open ↗</a>
    </div>
    <div class="card-body" id="body-${stem}">
      <iframe src="${stem}.html" scrolling="no" title="${name}"></iframe>
    </div>
  </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
${fontCSS}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Montserrat', system-ui, Arial, sans-serif; background: #f0f0f0; }
header { background: #e4003b; color: white; padding: 12px 24px;
         position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
header h1 { font-size: 16px; font-weight: 700; }
header span { font-size: 12px; opacity: .75; }
#filter-bar { background: white; border-bottom: 1px solid #ddd;
              padding: 8px 24px; display: flex; gap: 12px; align-items: center; }
#filter { padding: 5px 10px; border: 1px solid #ccc; border-radius: 4px;
          font-family: inherit; font-size: 13px; width: 200px; }
#count { font-size: 11px; color: #aaa; margin-left: auto; }
main { padding: 16px 24px; display: grid;
       grid-template-columns: repeat(auto-fill, minmax(520px, 1fr)); gap: 16px; }
.card { background: white; border-radius: 8px;
        box-shadow: 0 1px 4px rgba(0,0,0,.12); overflow: hidden; }
.card.has-error .card-header { background: #fff0f0; }
.card-header { padding: 8px 14px; background: #fafafa; border-bottom: 1px solid #eee;
               display: flex; align-items: baseline; gap: 10px; }
.card-name { font-size: 12px; font-weight: 700; color: #333; font-family: monospace; }
.card-open { margin-left: auto; font-size: 10px; color: #bbb; text-decoration: none; }
.card-open:hover { color: #e4003b; }
.card-body iframe { display: block; width: 100%; height: 200px; border: none; }
.hidden { display: none !important; }
</style>
</head>
<body>
<header>
  <h1>${title}</h1>
  <span>${entries.length} figures</span>
</header>
<div id="filter-bar">
  <input id="filter" type="text" placeholder="filter figures…" oninput="applyFilter()">
  <span id="count"></span>
</div>
<main id="grid">${cards}</main>
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
  document.getElementById('count').textContent =
    (q ? n + ' / ' : '') + document.querySelectorAll('.card').length + ' figures';
}
applyFilter();
</script>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a preview gallery for all figures in srcDir.
 *
 * Each figure is rendered server-side and embedded as inline SVG — no browser
 * JS shimming needed.
 *
 * @param {string}   srcDir     Directory containing figure modules
 * @param {string}   previewDir Output directory for HTML files
 * @param {object}   options
 * @param {string}   [options.fontCSS]  CSS injected into every page (e.g. @font-face blocks)
 * @param {string}   [options.title]    Gallery title shown in the header
 * @param {string[]} [options.figures]  Explicit list of figure names (default: auto-discover)
 * @returns {{ ok: number, total: number, errors: Array<{name, message}> }}
 */
function generatePreviews(srcDir, previewDir, options = {}) {
  const { fontCSS = '', title = 'd3figurer gallery', figures: figureNames } = options;
  const names = figureNames || discoverFigures(srcDir);

  fs.mkdirSync(previewDir, { recursive: true });

  const entries = [];
  const errors  = [];

  for (const name of names) {
    const stem = flatName(name);
    const { svg, error } = renderInlineSvg(srcDir, name);
    if (error) errors.push({ name, message: error });
    fs.writeFileSync(
      path.join(previewDir, `${stem}.html`),
      buildFigureHtml(name, svg, { fontCSS }),
      'utf8',
    );
    entries.push({ stem, name, error });
  }

  fs.writeFileSync(
    path.join(previewDir, 'index.html'),
    buildIndexHtml(entries, { fontCSS, title }),
    'utf8',
  );

  return { ok: names.length - errors.length, total: names.length, errors };
}

/**
 * Verify that preview HTML files were generated correctly.
 *
 * Since previews use inline SVG (no browser JS rendering), this is a simple
 * file-based check — no Chrome/puppeteer needed.
 *
 * @param {string}   previewDir Directory written by generatePreviews
 * @param {string[]} figureNames List of figure names to check
 * @returns {{ ok: number, total: number, errors: Array<{name, message}> }}
 */
function checkPreviews(previewDir, figureNames) {
  const errors = [];
  for (const name of figureNames) {
    const stem     = flatName(name);
    const htmlPath = path.join(previewDir, `${stem}.html`);
    try {
      const content = fs.readFileSync(htmlPath, 'utf8');
      if (!content.includes('<svg')) {
        errors.push({ name, message: 'no <svg> in generated HTML' });
      }
    } catch (e) {
      errors.push({ name, message: `file missing: ${e.message}` });
    }
  }
  const ok = figureNames.length - errors.length;
  return { ok, total: figureNames.length, errors };
}

module.exports = { generatePreviews, checkPreviews, discoverFigures, flatName };
