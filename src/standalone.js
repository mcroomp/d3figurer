/**
 * StandaloneRenderer - Direct rendering without server
 */

import path          from 'path';
import fs            from 'fs';
import { pathToFileURL } from 'url';

class StandaloneRenderer {
  constructor(options = {}) {
    this.options = {
      srcDir: null,
      fontCSS: '',
      chromeOptions: {
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
      ...options,
    };
  }

  async loadFigure(figureName) {
    if (!this.options.srcDir) throw new Error('srcDir required for loading figures');
    const figDir  = path.join(this.options.srcDir, figureName);
    const figPath = path.join(figDir, 'figure.js');
    if (!fs.existsSync(figPath)) throw new Error(`Figure not found: ${figPath}`);

    const svgFiles = fs.readdirSync(figDir).filter(f => f.endsWith('.svg'));
    if (svgFiles.length > 0) {
      const flags = {};
      for (const f of svgFiles) {
        try { flags[path.basename(f, '.svg')] = fs.readFileSync(path.join(figDir, f), 'utf8'); } catch (_) {}
      }
      global.window = { __CUSTOM_FLAGS: flags };
    }

    try {
      const mod = await import(pathToFileURL(figPath).href + '?t=' + Date.now());
      return mod.default;
    } finally {
      if (global.window) global.window = undefined;
    }
  }

  async render(figureName, outputPath, options = {}) {
    const { format = 'pdf' } = options;
    const figure  = await this.loadFigure(figureName);
    const svgHtml = figure();
    const wMatch  = svgHtml.match(/width="(\d+)"/);
    const hMatch  = svgHtml.match(/height="(\d+)"/);
    const svgW    = wMatch ? parseInt(wMatch[1]) : 900;
    const svgH    = hMatch ? parseInt(hMatch[1]) : 600;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>${this.options.fontCSS || ''}* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: white; } svg { display: block; }</style>
</head><body>${svgHtml}</body></html>`;

    const { default: puppeteer } = await import('puppeteer');
    const browser = await puppeteer.launch(this.options.chromeOptions);
    const page    = await browser.newPage();
    try {
      await page.setViewport({ width: svgW, height: svgH, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
      if (format === 'pdf') {
        await page.pdf({ path: outputPath, width: `${svgW}px`, height: `${svgH}px`,
          printBackground: true, margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } });
      } else if (format === 'png') {
        await page.screenshot({ path: outputPath, fullPage: true, omitBackground: false });
      }
    } finally {
      await page.close();
      await browser.close();
    }
    return { success: true, figure: figureName, outputPath };
  }
}

export default StandaloneRenderer;
