import { makeSVG, addMarker, addIcon } from '../../src/helpers.js';
import S from './styles.js';

/**
 * Append a text element with standard gallery Montserrat styling.
 * Returns the D3 selection for further chaining.
 *
 * Kept here (not in src/helpers) because it bakes in gallery-specific
 * font (S.FONT) and default text colour (S.TEXT).
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

export { makeSVG, addMarker, addIcon, addText };
