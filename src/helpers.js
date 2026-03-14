'use strict';
/**
 * Generic SVG helpers for building server-side D3 figures.
 *
 * Exported as require('d3figurer').helpers so project-level helpers.js files
 * can pull these in with one line and extend with project-specific additions:
 *
 *   const d3helpers = require('d3figurer').helpers;
 *   module.exports = Object.assign({}, d3helpers, { myProjectHelper });
 */

const { JSDOM } = require('jsdom');
const d3 = require('d3');

/**
 * Create a D3 SVG backed by jsdom.
 * Returns { svg, document } where svg is the D3 selection and document is the
 * jsdom Document — pass document.body.innerHTML as the figure's return value.
 *
 * @param {number} W          - SVG width in px
 * @param {number} H          - SVG height in px
 * @param {string} background - background fill colour (default '#ffffff')
 *
 * Usage:
 *   const { svg, document } = makeSVG(900, 600);
 *   // ... build figure ...
 *   return document.body.innerHTML;
 */
function makeSVG(W, H, background = '#ffffff') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const document = dom.window.document;
  const svg = d3.select(document.body)
    .append('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', W).attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`);
  svg.append('rect').attr('width', W).attr('height', H).attr('fill', background);
  return { svg, document };
}

/**
 * Add an SVG arrowhead marker to a <defs> selection.
 *
 * @param {d3.Selection} defs  - the <defs> D3 selection (svg.append('defs'))
 * @param {string}       id    - marker id, referenced as url(#id)
 * @param {string}       color - fill colour
 * @param {string}       dir   - 'fwd' → (default) or 'back' ←
 * @param {number}       size  - markerWidth / markerHeight (default 6)
 *
 * Usage:
 *   const defs = svg.append('defs');
 *   addMarker(defs, 'arr', '#888');           // gray forward arrow, size 6
 *   addMarker(defs, 'red', '#e4003b', 'fwd', 5);
 *   addMarker(defs, 'back', '#e4003b', 'back', 5);
 */
function addMarker(defs, id, color, dir = 'fwd', size = 6) {
  const m = defs.append('marker')
    .attr('id', id)
    .attr('viewBox', '0 0 10 10')
    .attr('refX', dir === 'fwd' ? 9 : 1)
    .attr('refY', 5)
    .attr('markerWidth', size)
    .attr('markerHeight', size)
    .attr('orient', 'auto');
  m.append('path')
    .attr('d', dir === 'fwd' ? 'M 0 0 L 10 5 L 0 10 z' : 'M 10 0 L 0 5 L 10 10 z')
    .attr('fill', color);
}

/**
 * Append an MDI (Material Design Icons) SVG path icon scaled from its 24×24 viewBox.
 * Returns the D3 selection for further chaining.
 *
 * @param {d3.Selection} parent   - D3 selection to append to
 * @param {string}       pathData - SVG path d attribute (from a 24×24 icon set)
 * @param {number}       cx       - icon centre x
 * @param {number}       cy       - icon centre y
 * @param {number}       size     - rendered size in SVG px
 * @param {string}       fill     - fill colour
 * @param {number}       opacity  - opacity 0–1 (omit to leave unset)
 *
 * Usage:
 *   addIcon(svg, MDI_PATH, 120, 80, 36, '#888', 0.7);
 */
function addIcon(parent, pathData, cx, cy, size, fill, opacity) {
  const el = parent.append('path')
    .attr('d', pathData)
    .attr('transform', `translate(${cx - size / 2}, ${cy - size / 2}) scale(${size / 24})`)
    .attr('fill', fill);
  if (opacity !== undefined) el.attr('opacity', opacity);
  return el;
}

module.exports = { makeSVG, addMarker, addIcon };
