import { makeSVG, addMarker, addIcon } from '../../src/helpers.js';
import * as d3 from 'd3';
import S from './styles.js';

// ── Project-specific helpers ──────────────────────────────────────────────────
// addText stays here: it bakes in the gallery's Montserrat font (S.FONT) and
// default text colour (S.TEXT). It is not generic enough for src/helpers.js.

/**
 * Append a text element with standard Montserrat styling.
 * Returns the D3 selection for further chaining.
 *
 * @param {d3.Selection} parent  - D3 selection to append to (svg or a <g>)
 * @param {number}       x       - x position
 * @param {number}       y       - y position
 * @param {string}       text    - text content
 * @param {number}       size    - font-size in SVG px
 * @param {number}       weight  - font-weight (default 400)
 * @param {string}       fill    - fill color (default S.TEXT)
 * @param {string}       anchor  - text-anchor: 'start'|'middle'|'end' (default 'middle')
 * @param {boolean}      italic  - set font-style:italic (default false)
 *
 * Usage:
 *   addText(svg, 500, 40, 'Title', 28, 700, S.RED);
 *   addText(g, x, y, label, 20, 400, S.GRAY, 'start', true);
 */
function addText(parent, x, y, text, size, weight, fill, anchor, italic) {
  const el = parent.append('text')
    .attr('x', x).attr('y', y)
    .attr('text-anchor', anchor || 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT)
    .attr('font-size', size)
    .attr('font-weight', weight || 400)
    .attr('fill', fill || S.TEXT);
  if (italic) el.attr('font-style', 'italic');
  el.text(text);
  return el;
}

/**
 * Append a block of multi-line text with flexible anchor and origin.
 * Returns a D3 <g> selection containing all <text> elements.
 *
 * @param {d3.Selection} parent  - D3 selection to append to
 * @param {number}       x       - anchor x
 * @param {number}       y       - anchor y
 * @param {string|string[]} lines - one or more lines of text
 * @param {number}       size    - font-size in SVG px
 * @param {number}       weight  - font-weight (default 400)
 * @param {string}       fill    - fill color (default S.TEXT)
 * @param {string}       origin  - two-part string: vertical-horizontal
 *                                 vertical:   'top' | 'middle' | 'bottom'
 *                                 horizontal: 'left' | 'center' | 'right'
 *                                 e.g. 'top-center', 'middle-left', 'bottom-right'
 *                                 Defaults to 'top-left'.
 * @param {number}       lineH   - line height in px (default size * 1.4)
 * @param {boolean}      italic  - set font-style:italic (default false)
 *
 * Usage:
 *   addTextBlock(svg, CX, cy, ['Line one', 'Line two'], 11, 700, '#fff', 'middle-center');
 *   addTextBlock(svg, x, y, 'Single line', 9, 400, S.TEXT, 'top-left', 14, true);
 */
function addTextBlock(parent, x, y, lines, size, weight, fill, origin, lineH, italic) {
  const linesArr = Array.isArray(lines) ? lines : [lines];
  const N   = linesArr.length;
  const LH  = lineH != null ? lineH : Math.round(size * 1.4);

  const parts   = (origin || 'top-left').split('-');
  const valign  = parts.find(p => p === 'top' || p === 'middle' || p === 'bottom') || 'top';
  const halign  = parts.find(p => p === 'left' || p === 'center' || p === 'right') || 'left';
  const anchor  = halign === 'center' ? 'middle' : halign === 'right' ? 'end' : 'start';
  const firstY  = valign === 'middle' ? y - (N - 1) * LH / 2
                : valign === 'bottom' ? y - (N - 1) * LH : y;

  const g = parent.append('g');
  linesArr.forEach((line, i) => {
    const el = g.append('text')
      .attr('x', x).attr('y', firstY + i * LH)
      .attr('text-anchor', anchor)
      .attr('dominant-baseline', 'middle')
      .attr('font-family', S.FONT)
      .attr('font-size', size)
      .attr('font-weight', weight || 400)
      .attr('fill', fill || S.TEXT)
      .text(line);
    if (italic) el.attr('font-style', 'italic');
  });
  return g;
}

globalThis.d3 = d3;
globalThis.__d3fig_helpers = { makeSVG, addMarker, addText, addTextBlock, addIcon };
Object.assign(globalThis, globalThis.__d3fig_helpers);
export { makeSVG, addMarker, addText, addTextBlock, addIcon };
