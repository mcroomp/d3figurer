/**
 * FigurerServer — persistent render daemon
 *
 * Pays the cold-start cost (load jsdom/D3/Chromium) ONCE, then stays warm.
 * Uses a single shared browser page; all renders/checks serialised via queue.
 *
 * HTTP API:
 *   GET  /          → { ready: true, figures: [...names] }
 *   DELETE /        → graceful shutdown
 *   POST /render    → { figure, outputPath, reload? }
 *   POST /check     → { figure, screenshotPath?, reload? }
 */

import http          from 'http';
import path          from 'path';
import fs            from 'fs';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';

// ── PDF metadata normalisation ─────────────────────────────────────────────
function patchPdfMeta(s) {
  const fix = (val, target) => target.padEnd(val.length, ' ');
  const DATE = 'D:20000101000000Z';
  const ISO  = '2000-01-01T00:00:00Z';
  const NAME = 'd3figurer';
  return s
    .replace(/\/CreationDate(\s*)\(([^)]*)\)/g, (_, w, v) => `/CreationDate${w}(${fix(v, DATE)})`)
    .replace(/\/ModDate(\s*)\(([^)]*)\)/g,      (_, w, v) => `/ModDate${w}(${fix(v, DATE)})`)
    .replace(/\/Creator(\s*)\(([^)]*)\)/g,      (_, w, v) => `/Creator${w}(${fix(v, NAME)})`)
    .replace(/\/Producer(\s*)\(([^)]*)\)/g,     (_, w, v) => `/Producer${w}(${fix(v, NAME)})`)
    .replace(/(<xmp:CreateDate>)([^<]*)(<\/xmp:CreateDate>)/g,    (_, o, v, c) => `${o}${fix(v, ISO)}${c}`)
    .replace(/(<xmp:ModifyDate>)([^<]*)(<\/xmp:ModifyDate>)/g,    (_, o, v, c) => `${o}${fix(v, ISO)}${c}`)
    .replace(/(<xmp:MetadataDate>)([^<]*)(<\/xmp:MetadataDate>)/g,(_, o, v, c) => `${o}${fix(v, ISO)}${c}`)
    .replace(/(<xmp:CreatorTool>)([^<]*)(<\/xmp:CreatorTool>)/g,  (_, o, v, c) => `${o}${fix(v, NAME)}${c}`)
    .replace(/(<pdf:Producer>)([^<]*)(<\/pdf:Producer>)/g,        (_, o, v, c) => `${o}${fix(v, NAME)}${c}`)
    .replace(/pdf:Producer='([^']*)'/g, (_, v) => `pdf:Producer='${fix(v, NAME)}'`)
    .replace(/(xapMM|xmpMM):(DocumentID|InstanceID)='uuid:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'/g,
      (_, ns, prop) => `${ns}:${prop}='uuid:00000000-0000-0000-0000-000000000000'`)
    .replace(/\/ID\s*\[<[0-9a-fA-F]+>\s*<[0-9a-fA-F]+>\]/g, full =>
      full.replace(/<([0-9a-fA-F]+)>/g, (_, h) => `<${'0'.repeat(h.length)}>`));
}

function reprocessPdf(pdfPath) {
  const tmp = pdfPath + '.tmp';
  spawnSync('gs', [
    '-dBATCH', '-dNOPAUSE', '-dQUIET',
    '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4', '-dDocumentMetadata=false', '-dCompressPages=false',
    `-sOutputFile=${tmp}`,
    '-f', pdfPath,
    '-c', '[ /Creator (d3figurer) /Producer (d3figurer) /CreationDate (D:20000101000000Z) /ModDate (D:20000101000000Z) /DOCINFO pdfmark',
  ], { timeout: 30000 });
  fs.renameSync(tmp, pdfPath);
  try {
    const raw = fs.readFileSync(pdfPath);
    fs.writeFileSync(pdfPath, Buffer.from(patchPdfMeta(raw.toString('binary')), 'binary'));
  } catch (_) {}
}

// ── Serial queue ───────────────────────────────────────────────────────────
function makeQueue() {
  let tail = Promise.resolve();
  return fn => {
    const next = tail.then(fn);
    tail = next.catch(() => {});
    return next;
  };
}

class FigurerServer {
  constructor(options = {}) {
    this.options = {
      port:          9229,
      srcDir:        null,
      fontCSS:       '',
      idleMinutes:   parseInt(process.env.IDLE_SHUTDOWN_AFTER || '10', 10),
      chromeOptions: {
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
      ...options,
    };
    this._server       = null;
    this._browser      = null;
    this._page         = null;
    this._ownsBrowser  = false;
    this._figureCache  = {};
    this._enqueue      = makeQueue();
    this._lastActivity = Date.now();
    this._idleTimer    = null;
  }

  // ── Figure module loading ─────────────────────────────────────────────────
  async _loadFigureModules() {
    const { srcDir } = this.options;
    if (!srcDir) return {};
    const cache = {};

    // Pre-load shared deps so globalThis.d3, __d3fig_helpers, __d3fig_styles are set
    const helpersSrc = path.join(srcDir, 'shared', 'helpers.js');
    const stylesSrc  = path.join(srcDir, 'shared', 'styles.js');
    if (fs.existsSync(helpersSrc)) await import(pathToFileURL(helpersSrc).href);
    if (fs.existsSync(stylesSrc))  await import(pathToFileURL(stylesSrc).href);
    globalThis.__d3fig_assets = {};
    try {
      const { default: flagsModule } = await import('country-flag-icons/string/3x2');
      globalThis.__d3fig_assets.flags = flagsModule;
    } catch (_) {}

    const walk = async (dir, prefix) => {
      for (const entry of fs.readdirSync(dir)) {
        if (entry === 'shared') continue;
        const entryPath = path.join(dir, entry);
        if (!fs.statSync(entryPath).isDirectory()) continue;
        const name    = prefix ? `${prefix}/${entry}` : entry;
        const figPath = path.join(entryPath, 'figure.js');
        if (fs.existsSync(figPath)) {
          const svgFiles = fs.readdirSync(entryPath).filter(f => f.endsWith('.svg'));
          if (svgFiles.length > 0) {
            const flags = {};
            for (const f of svgFiles) {
              try { flags[path.basename(f, '.svg')] = fs.readFileSync(path.join(entryPath, f), 'utf8'); } catch (_) {}
            }
            globalThis.__CUSTOM_FLAGS = flags;
          }
          // Load data.js side effect (sets globalThis.__d3fig_data)
          const dataPath = path.join(entryPath, 'data.js');
          if (fs.existsSync(dataPath)) {
            await import(pathToFileURL(dataPath).href);
          }
          try {
            globalThis.__d3fig_figure = undefined;
            await import(pathToFileURL(figPath).href);
            if (globalThis.__d3fig_figure) {
              cache[name] = { fn: globalThis.__d3fig_figure, data: globalThis.__d3fig_data };
            } else {
              process.stderr.write(`  Warning: ${name}: __d3fig_figure not set\n`);
            }
          } catch (e) {
            process.stderr.write(`  Warning: failed to load ${name}: ${e.message}\n`);
          }
          if (globalThis.__CUSTOM_FLAGS) globalThis.__CUSTOM_FLAGS = undefined;
        } else {
          await walk(entryPath, name);
        }
      }
    };

    await walk(srcDir, '');
    return cache;
  }

  // ── Shared page prep: reload module → build HTML → setContent ────────────
  async _prepPage(figure, reload) {
    if (!this._figureCache[figure]) {
      throw Object.assign(new Error(`Unknown figure: ${figure}`), { status: 404 });
    }
    if (reload && this.options.srcDir) {
      const t       = Date.now();
      const figPath = path.join(this.options.srcDir, figure, 'figure.js');
      const dataPath = path.join(this.options.srcDir, figure, 'data.js');
      try {
        // Reload data first
        if (fs.existsSync(dataPath)) {
          await import(pathToFileURL(dataPath).href + '?t=' + t);
        }
        // Reload figure
        globalThis.__d3fig_figure = undefined;
        await import(pathToFileURL(figPath).href + '?t=' + t);
        if (!globalThis.__d3fig_figure) throw new Error('__d3fig_figure not set after reload');
        this._figureCache[figure] = { fn: globalThis.__d3fig_figure, data: globalThis.__d3fig_data };
      } catch (e) {
        throw Object.assign(new Error(`Failed to reload ${figure}: ${e.message}`), { status: 500 });
      }
    }
    const { fn, data } = this._figureCache[figure];
    const svgHtml = fn({ data, S: globalThis.__d3fig_styles, d3: globalThis.d3, assets: globalThis.__d3fig_assets });
    const svgW    = parseInt((svgHtml.match(/width="(\d+)"/)  || [, 900])[1]);
    const svgH    = parseInt((svgHtml.match(/height="(\d+)"/) || [, 600])[1]);
    const html    = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${this.options.fontCSS || ''}*{margin:0;padding:0;box-sizing:border-box}body{background:white}svg{display:block}</style></head><body>${svgHtml}</body></html>`;
    await this._page.setViewport({ width: svgW, height: svgH, deviceScaleFactor: 1 });
    await this._page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    return { svgW, svgH, svgHtml };
  }

  async start() {
    const { default: puppeteer } = await import('puppeteer');
    const t0  = Date.now();
    const lap = label => process.stderr.write(`  ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
    process.stderr.write('d3figurer: starting up...\n');

    this._figureCache = await this._loadFigureModules();
    lap(`${Object.keys(this._figureCache).length} figure modules loaded`);

    const CHROME_URL = process.env.CHROME_URL || null;
    if (CHROME_URL) {
      try {
        this._browser     = await puppeteer.connect({ browserURL: CHROME_URL, protocolTimeout: 30000 });
        this._ownsBrowser = false;
        lap(`connected to Chrome at ${CHROME_URL}`);
      } catch (e) {
        process.stderr.write(`  Could not connect to ${CHROME_URL}: ${e.message} — launching own\n`);
        this._browser     = await puppeteer.launch(this.options.chromeOptions);
        this._ownsBrowser = true;
        lap('Chrome launched (own)');
      }
    } else {
      this._browser     = await puppeteer.launch(this.options.chromeOptions);
      this._ownsBrowser = true;
      lap('Chrome launched');
    }

    this._page = await this._browser.newPage();
    lap('page ready');

    if (this.options.idleMinutes > 0) {
      this._idleTimer = setInterval(() => {
        if (Date.now() - this._lastActivity > this.options.idleMinutes * 60_000) {
          process.stderr.write(`d3figurer: idle ${this.options.idleMinutes}m — shutting down\n`);
          this.stop().then(() => process.exit(0));
        }
      }, 60_000);
    }

    this._server = http.createServer((req, res) => this._handleRequest(req, res));
    await new Promise((resolve, reject) => {
      this._server.listen(this.options.port, '127.0.0.1', err => err ? reject(err) : resolve());
    });
    lap(`listening on :${this.options.port}`);
    process.stderr.write('d3figurer: ready\n');
    return this;
  }

  _handleRequest(req, res) {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: true, figures: Object.keys(this._figureCache) }));
      return;
    }
    if (req.method === 'DELETE' && req.url === '/') {
      res.writeHead(200); res.end('shutting down\n');
      const done = this._ownsBrowser
        ? this._browser.close()
        : this._page.close().then(() => this._browser.disconnect());
      done.then(() => this._server.close(() => process.exit(0)));
      return;
    }
    const withBody = handler => {
      let body = '';
      req.on('data', d => { body += d; });
      req.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch (_) {
          res.writeHead(400); res.end(JSON.stringify({ error: 'bad JSON' })); return;
        }
        this._enqueue(() => handler(parsed).catch(err => {
          if (!res.headersSent) {
            res.writeHead(err.status || 500);
            res.end(JSON.stringify({ error: err.message }));
          }
        }));
      });
    };
    if (req.method === 'POST' && req.url === '/render') {
      withBody(async ({ figure, outputPath, format = 'pdf', reload }) => {
        this._lastActivity = Date.now();
        const { svgW, svgH, svgHtml } = await this._prepPage(figure, reload);
        if (format === 'svg') {
          fs.writeFileSync(outputPath, svgHtml, 'utf8');
        } else if (format === 'png') {
          const buf = await this._page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: svgW, height: svgH } });
          fs.writeFileSync(outputPath, buf);
        } else {
          await this._page.pdf({
            path: outputPath, width: `${svgW}px`, height: `${svgH}px`,
            printBackground: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
          });
          reprocessPdf(outputPath);
        }
        res.writeHead(200); res.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    if (req.method === 'POST' && req.url === '/load-url') {
      withBody(async ({ url, screenshotPath }) => {
        this._lastActivity = Date.now();
        const failed = [];
        const onFail = request => failed.push(request.url());
        this._page.on('requestfailed', onFail);
        try {
          await this._page.goto(url, { waitUntil: 'load', timeout: 10000 });
        } finally {
          this._page.off('requestfailed', onFail);
        }
        if (screenshotPath) {
          const buf = await this._page.screenshot({ type: 'png', fullPage: true });
          fs.writeFileSync(screenshotPath, buf);
        }
        res.writeHead(200); res.end(JSON.stringify({ ok: failed.length === 0, failedRequests: failed }));
      });
      return;
    }
    if (req.method === 'POST' && req.url === '/check') {
      withBody(async ({ figure, screenshotPath, reload }) => {
        this._lastActivity = Date.now();
        const { svgW, svgH } = await this._prepPage(figure, reload);
        const analysis = await this._page.evaluate((W, H) => {
          const allNodes = Array.from(document.querySelectorAll('svg text'))
            .map(el => {
              const r = el.getBoundingClientRect();
              return { text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
                x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom,
                skip: el.hasAttribute('data-skip-check') };
            })
            .filter(t => t.text && t.w > 1 && t.h > 1);
          const nodes    = allNodes.filter(t => !t.skip);
          const MIN_GAP_X = 8;
          const MIN_GAP_Y = 3;
          const overlaps = [], tooClose = [];
          for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
              const a = nodes[i], b = nodes[j];
              const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x);
              const oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
              if (ox > 2 && oy > 2) {
                overlaps.push({ a: a.text, b: b.text,
                  overlapX: Math.round(ox), overlapY: Math.round(oy),
                  overlapPx: Math.round(ox * oy),
                  aPos: [Math.round(a.x), Math.round(a.y)],
                  bPos: [Math.round(b.x), Math.round(b.y)] });
              } else {
                const gx = Math.max(0, -ox), gy = Math.max(0, -oy);
                if (gx < MIN_GAP_X && gy < MIN_GAP_Y)
                  tooClose.push({ a: a.text, b: b.text,
                    gapX: Math.round(gx), gapY: Math.round(gy),
                    gapPx: Math.round(Math.max(gx, gy)),
                    aPos: [Math.round(a.x), Math.round(a.y)],
                    bPos: [Math.round(b.x), Math.round(b.y)] });
              }
            }
          }
          const clipped = allNodes
            .filter(t => t.r > W + 2 || t.b > H + 2 || t.x < -2 || t.y < -2)
            .map(t => ({
              text: t.text,
              edge: t.x < -2 ? 'left' : t.r > W + 2 ? 'right' : t.y < -2 ? 'top' : 'bottom',
              overflowPx: Math.round(Math.max(t.r - W, t.b - H, -t.x, -t.y)),
            }));
          const OVERFLOW_TOL = 3;
          const boxes = Array.from(document.querySelectorAll('svg rect')).map(el => {
            const r = el.getBoundingClientRect(), fill = el.getAttribute('fill');
            if (r.width < 20 || r.height < 20) return null;
            if (el.hasAttribute('data-skip-check')) return null;
            if (!fill || fill === 'none') return null;
            return { x: r.left, y: r.top, r: r.right, b: r.bottom, area: r.width * r.height };
          }).filter(Boolean);
          const boxOverflows = [];
          for (const t of allNodes) {
            const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
            const containers = boxes.filter(b => cx >= b.x && cx <= b.r && cy >= b.y && cy <= b.b);
            if (!containers.length) continue;
            const box = containers.reduce((a, b) => a.area <= b.area ? a : b);
            const oR = t.r - box.r, oL = box.x - t.x, oB = t.b - box.b, oT = box.y - t.y;
            const maxO = Math.max(oR, oL, oB, oT);
            if (maxO > OVERFLOW_TOL) {
              const edge = oR > OVERFLOW_TOL ? 'right' : oL > OVERFLOW_TOL ? 'left'
                         : oB > OVERFLOW_TOL ? 'bottom' : 'top';
              boxOverflows.push({ text: t.text, edge, overflowPx: Math.round(maxO),
                textPos: [Math.round(t.x), Math.round(t.y)] });
            }
          }
          const rectIntrusions = [];
          for (const t of allNodes) {
            const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
            const isInsideAny = boxes.some(b => cx >= b.x && cx <= b.r && cy >= b.y && cy <= b.b);
            if (isInsideAny) continue;
            for (const box of boxes) {
              const ox = Math.min(t.r, box.r) - Math.max(t.x, box.x);
              const oy = Math.min(t.b, box.b) - Math.max(t.y, box.y);
              if (ox > OVERFLOW_TOL && oy > OVERFLOW_TOL) {
                const edge = t.r > box.x && t.x < box.x ? 'right'
                           : t.x < box.r && t.r > box.r ? 'left'
                           : t.b > box.y && t.y < box.y ? 'bottom' : 'top';
                rectIntrusions.push({ text: t.text, edge,
                  overlapX: Math.round(ox), overlapY: Math.round(oy),
                  textPos: [Math.round(t.x), Math.round(t.y)] });
              }
            }
          }
          const labelledBoxes = {};
          Array.from(document.querySelectorAll('svg rect[data-box]')).forEach(el => {
            const id = el.getAttribute('data-box');
            const r  = el.getBoundingClientRect();
            labelledBoxes[id] = { x: r.left, y: r.top, r: r.right, b: r.bottom };
          });
          const outsideBox = [];
          const TOL_BOX = 2;
          Array.from(document.querySelectorAll('svg text[data-inside]')).forEach(el => {
            const id  = el.getAttribute('data-inside');
            const box = labelledBoxes[id];
            const txt = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60);
            if (!box) {
              outsideBox.push({ text: txt, boxId: id, message: `box "${id}" not found` });
              return;
            }
            const r = el.getBoundingClientRect();
            const overflow = Math.max(box.x - r.left, r.right - box.r, box.y - r.top, r.bottom - box.b);
            if (overflow > TOL_BOX) {
              const edge = (box.x - r.left)  > TOL_BOX ? 'left'
                         : (r.right - box.r) > TOL_BOX ? 'right'
                         : (box.y - r.top)   > TOL_BOX ? 'top' : 'bottom';
              outsideBox.push({ text: txt, boxId: id, edge,
                overflowPx: Math.round(overflow),
                textPos: [Math.round(r.left), Math.round(r.top)] });
            }
          });
          return { textCount: allNodes.length, checkedCount: nodes.length,
            overlaps, tooClose, clipped, boxOverflows, rectIntrusions, outsideBox };
        }, svgW, svgH);
        if (screenshotPath) {
          const buf = await this._page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: svgW, height: svgH } });
          fs.writeFileSync(screenshotPath, buf);
        }
        res.writeHead(200); res.end(JSON.stringify({ ok: true, svgW, svgH, ...analysis }));
      });
      return;
    }
    res.writeHead(404); res.end();
  }

  async stop() {
    if (this._idleTimer) { clearInterval(this._idleTimer); this._idleTimer = null; }
    if (this._server)   { await new Promise(r => this._server.close(r)); this._server = null; }
    if (this._browser) {
      const done = this._ownsBrowser
        ? this._browser.close()
        : this._page.close().then(() => this._browser.disconnect());
      await done.catch(() => {});
      this._browser = null; this._page = null;
    }
  }
}

export default FigurerServer;

// Exported for unit testing only — not part of public API
export const _internals = { patchPdfMeta, makeQueue };
