/**
 * StandaloneRenderer - Direct rendering without server
 * 
 * For cases where you don't want to run a persistent server.
 * Each render launches Chrome fresh (slower but simpler).
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

function reprocessPdf(pdfPath) {
  // 1. Patch metadata strings in-place (may corrupt xref byte offsets).
  const FIXED_PDF = '(D:20000101000000Z)';
  const FIXED_ISO = '2000-01-01T00:00:00Z';
  const FIXED_CREATOR = '(d3figurer)';
  let buf;
  try { buf = fs.readFileSync(pdfPath); } catch (_) { return; }
  const str = buf.toString('binary');
  const patched = str
    .replace(/\/CreationDate\s*\([^)]*\)/g, `/CreationDate ${FIXED_PDF}`)
    .replace(/\/ModDate\s*\([^)]*\)/g,      `/ModDate ${FIXED_PDF}`)
    .replace(/\/Creator\s*\((?:[^)\\]|\\.)*\)/g,  `/Creator ${FIXED_CREATOR}`)
    .replace(/\/Producer\s*\((?:[^)\\]|\\.)*\)/g, `/Producer ${FIXED_CREATOR}`)
    .replace(/<xmp:CreateDate>[^<]*<\/xmp:CreateDate>/g,
             `<xmp:CreateDate>${FIXED_ISO}</xmp:CreateDate>`)
    .replace(/<xmp:ModifyDate>[^<]*<\/xmp:ModifyDate>/g,
             `<xmp:ModifyDate>${FIXED_ISO}</xmp:ModifyDate>`)
    .replace(/<xmp:MetadataDate>[^<]*<\/xmp:MetadataDate>/g,
             `<xmp:MetadataDate>${FIXED_ISO}</xmp:MetadataDate>`)
    .replace(/<xmp:CreatorTool>[^<]*<\/xmp:CreatorTool>/g,
             `<xmp:CreatorTool>d3figurer</xmp:CreatorTool>`)
    .replace(/<pdf:Producer>[^<]*<\/pdf:Producer>/g,
             `<pdf:Producer>d3figurer</pdf:Producer>`);
  if (patched !== str) fs.writeFileSync(pdfPath, Buffer.from(patched, 'binary'));

  // 2. Ghostscript rebuilds the xref table cleanly so XeTeX can parse it,
  //    preserving the patched Info dict from step 1.
  const tmp = pdfPath + '.tmp';
  spawnSync('gs', [
    '-dBATCH', '-dNOPAUSE', '-dQUIET',
    '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4', '-dDocumentMetadata=false',
    `-sOutputFile=${tmp}`,
    '-f', pdfPath,
    '-c', '[ /Creator (d3figurer) /Producer (d3figurer) /DOCINFO pdfmark',
  ], { timeout: 30000 });
  fs.renameSync(tmp, pdfPath);
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