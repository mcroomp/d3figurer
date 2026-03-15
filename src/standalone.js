/**
 * StandaloneRenderer - Direct rendering without server
 * 
 * For cases where you don't want to run a persistent server.
 * Each render launches Chrome fresh (slower but simpler).
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

// ── PDF metadata normalisation ─────────────────────────────────────────────
// All replacements pad to the original value length so no byte offsets change.
// Called once on the GS output; the GS pdfmark (-c) already sets Info dict
// fields so dates/creator are deterministic before this runs.
function patchPdfMeta(s) {
  const fix = (val, target) => target.padEnd(val.length, ' ');
  const DATE = 'D:20000101000000Z';
  const ISO  = '2000-01-01T00:00:00Z';
  const NAME = 'd3figurer';
  return s
    // ── Info dict string values ──────────────────────────────────────────
    .replace(/\/CreationDate(\s*)\(([^)]*)\)/g, (_, w, v) => `/CreationDate${w}(${fix(v, DATE)})`)
    .replace(/\/ModDate(\s*)\(([^)]*)\)/g,      (_, w, v) => `/ModDate${w}(${fix(v, DATE)})`)
    .replace(/\/Creator(\s*)\(([^)]*)\)/g,      (_, w, v) => `/Creator${w}(${fix(v, NAME)})`)
    .replace(/\/Producer(\s*)\(([^)]*)\)/g,     (_, w, v) => `/Producer${w}(${fix(v, NAME)})`)
    // ── XMP element text content ─────────────────────────────────────────
    .replace(/(<xmp:CreateDate>)([^<]*)(<\/xmp:CreateDate>)/g,    (_, o, v, c) => `${o}${fix(v, ISO)}${c}`)
    .replace(/(<xmp:ModifyDate>)([^<]*)(<\/xmp:ModifyDate>)/g,    (_, o, v, c) => `${o}${fix(v, ISO)}${c}`)
    .replace(/(<xmp:MetadataDate>)([^<]*)(<\/xmp:MetadataDate>)/g,(_, o, v, c) => `${o}${fix(v, ISO)}${c}`)
    .replace(/(<xmp:CreatorTool>)([^<]*)(<\/xmp:CreatorTool>)/g,  (_, o, v, c) => `${o}${fix(v, NAME)}${c}`)
    .replace(/(<pdf:Producer>)([^<]*)(<\/pdf:Producer>)/g,        (_, o, v, c) => `${o}${fix(v, NAME)}${c}`)
    // ── XMP attribute style ──────────────────────────────────────────────
    .replace(/pdf:Producer='([^']*)'/g, (_, v) => `pdf:Producer='${fix(v, NAME)}'`)
    // ── XMP DocumentID / InstanceID (UUID always 36 chars) ───────────────
    .replace(/(xapMM|xmpMM):(DocumentID|InstanceID)='uuid:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'/g,
      (_, ns, prop) => `${ns}:${prop}='uuid:00000000-0000-0000-0000-000000000000'`)
    // ── /ID array in trailer (zero hex inside <>, preserve all whitespace) ─
    .replace(/\/ID\s*\[<[0-9a-fA-F]+>\s*<[0-9a-fA-F]+>\]/g, full =>
      full.replace(/<([0-9a-fA-F]+)>/g, (_, h) => `<${'0'.repeat(h.length)}>`));
}

function reprocessPdf(pdfPath) {
  // Ghostscript rewrites the Puppeteer PDF as PDF 1.4, which XeTeX requires.
  // The pdfmark sets Info dict fields; patchPdfMeta normalises everything else
  // afterwards using same-length replacements so the rebuilt xref stays valid.
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

class StandaloneRenderer {
  constructor(options = {}) {
    this.options = {
      srcDir: null,
      fontCSS: '',     // raw CSS injected into the page <style> block; empty = browser default
      chromeOptions: {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ]
      },
      ...options
    };
  }

  /**
   * Load a figure module
   */
  loadFigure(figureName) {
    if (!this.options.srcDir) {
      throw new Error('srcDir required for loading figures');
    }
    
    const figDir = path.join(this.options.srcDir, figureName);
    const figPath = path.join(figDir, 'figure.js');
    
    if (!fs.existsSync(figPath)) {
      throw new Error(`Figure not found: ${figPath}`);
    }

    // Inject any bundled .svg resource files
    const svgFiles = fs.readdirSync(figDir).filter(f => f.endsWith('.svg'));
    if (svgFiles.length > 0) {
      const flags = {};
      for (const f of svgFiles) {
        try { 
          flags[path.basename(f, '.svg')] = fs.readFileSync(path.join(figDir, f), 'utf8'); 
        } catch (_) {}
      }
      global.window = { __CUSTOM_FLAGS: flags };
    }

    let figure;
    try {
      delete require.cache[require.resolve(figPath)]; // Allow hot reloading
      figure = require(figPath);
    } finally {
      if (global.window) { 
        global.window = undefined; 
      }
    }
    
    return figure;
  }

  /**
   * Render a figure to PDF/PNG
   */
  async render(figureName, outputPath, options = {}) {
    const { format = 'pdf' } = options;
    
    // Load figure and generate SVG
    const figure = this.loadFigure(figureName);
    const svgHtml = figure();
    
    // Extract dimensions
    const wMatch = svgHtml.match(/width="(\d+)"/);
    const hMatch = svgHtml.match(/height="(\d+)"/);
    const svgW = wMatch ? parseInt(wMatch[1]) : 900;
    const svgH = hMatch ? parseInt(hMatch[1]) : 600;
    
    // Create HTML wrapper
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${this.options.fontCSS || ''}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; }
  svg { display: block; }
</style>
</head>
<body>${svgHtml}</body>
</html>`;

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch(this.options.chromeOptions);
    const page = await browser.newPage();
    
    try {
      await page.setViewport({ width: svgW, height: svgH, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
      
      if (format === 'pdf') {
        await page.pdf({
          path: outputPath,
          width: `${svgW}px`,
          height: `${svgH}px`,
          printBackground: true,
          margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
        });
        reprocessPdf(outputPath);
      } else if (format === 'png') {
        await page.screenshot({
          path: outputPath,
          fullPage: true,
          omitBackground: false,
        });
      }
      
    } finally {
      await page.close();
      await browser.close();
    }
    
    return { success: true, figure: figureName, outputPath };
  }
}

module.exports = StandaloneRenderer;