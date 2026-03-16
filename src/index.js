/**
 * D3Figurer - Server-side D3.js figure generation
 */

import FigurerServer from './server.js';
import FigurerClient from './client.js';
import StandaloneRenderer from './standalone.js';
import { generatePreviews, checkPreviews, discoverFigures, flatName } from './previews.js';
import { generateLivePreviews, checkLivePreviews } from './live-previews.js';
import { checkAllAndReport } from './checker.js';
import { makeSVG, addMarker, addIcon } from './helpers.js';

class D3Figurer {
  constructor(options = {}) {
    this.options = {
      port: 9229,
      srcDir: null,
      fontCSS: '',
      chromeOptions: {
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
      ...options,
    };
    this.server = null;
    this.client = null;
  }

  async startServer(port = this.options.port) {
    if (this.server) throw new Error('Server already running');
    this.server = new FigurerServer({
      port,
      srcDir:        this.options.srcDir,
      fontCSS:       this.options.fontCSS,
      chromeOptions: this.options.chromeOptions,
    });
    await this.server.start();
    return this.server;
  }

  async stopServer() {
    if (this.server) { await this.server.stop(); this.server = null; }
  }

  getClient(port = this.options.port) {
    if (!this.client) this.client = new FigurerClient({ port });
    return this.client;
  }

  async render(figureName, outputPath, options = {}) {
    const client          = this.getClient();
    const serverAvailable = await client.isServerAvailable();
    if (serverAvailable) return client.render(figureName, outputPath, options);
    const standalone = new StandaloneRenderer({
      srcDir: this.options.srcDir, fontCSS: this.options.fontCSS, chromeOptions: this.options.chromeOptions,
    });
    return standalone.render(figureName, outputPath, options);
  }

  async renderBatch(figures, options = {}) {
    const client          = this.getClient();
    const serverAvailable = await client.isServerAvailable();
    if (serverAvailable) return client.renderBatch(figures, options);
    const standalone = new StandaloneRenderer({
      srcDir: this.options.srcDir, fontCSS: this.options.fontCSS, chromeOptions: this.options.chromeOptions,
    });
    const results = [];
    for (const figure of figures) {
      try {
        await standalone.render(figure.name, figure.output, options);
        results.push({ name: figure.name, success: true });
      } catch (error) {
        results.push({ name: figure.name, success: false, error: error.message });
      }
    }
    return results;
  }

  async checkFigure(figureName, options = {}) {
    const client = this.getClient();
    if (!await client.isServerAvailable()) throw new Error('Figure checking requires server mode.');
    return client.checkFigure(figureName, options);
  }
}

export default D3Figurer;
export {
  FigurerClient,
  generatePreviews,
  checkPreviews,
  generateLivePreviews,
  checkLivePreviews,
  checkAllAndReport,
  discoverFigures,
  flatName,
  makeSVG,
  addMarker,
  addIcon,
};
