globalThis.__d3fig_figure = function({ data, S, d3, assets }) {
  // ── Layout ──────────────────────────────────────────────────────────────
  const W = 1200, H = 700;              // canvas size (SVG pixels)
  const X_LEFT    = 90;                  // x coordinate of leftmost chart edge
  const X_RIGHT   = 1140;               // x coordinate of rightmost chart edge
  const AREA_TOP  = 280;                // y of top edge of stacked area chart
  const AREA_BOT  = 620;                // y of bottom edge of stacked area chart
  const TIMELINE_Y = 280;              // y of horizontal timeline bar
  const LEVEL_Y   = { 1: 238, 2: 172, 3: 100 }; // y centre for each event label level
  const LEGEND_X  = 65;                // x of legend row (left edge)
  const LEGEND_Y  = 652;               // y of legend row
  const FONT_EVENT_TITLE = 18;         // font size for event title labels
  const FONT_EVENT_SUB   = 16;         // font size for event subtitle labels
  const FONT_AREA_LABEL  = 14;         // font size for era labels inside area bands
  const FONT_AREA_SUB    = 12;         // font size for era sublabels inside area bands
  const FONT_AXIS        = 18;         // font size for x-axis year ticks
  const FONT_BAND_VERT   = 17;         // font size for rotated band paradigm labels
  const FONT_LEGEND      = 16;         // font size for legend text

  const { svg, document } = makeSVG(W, H);

  // DATA — loaded from data.js (edit that file to customise the figure)
  const { events, areaData, areaLabels, misc } = data;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCALES AND GEOMETRY (change xScale range or areaTop/Bottom to resize)
  // ═══════════════════════════════════════════════════════════════════════════

  // Piecewise scale:
  //   Pre-1945 (Ada Lovelace era): short linear section (PREAMBLE_WIDTH px)
  //   1945–2028 (AI era): log scale, recent years expanded
  const PREAMBLE_WIDTH = 120;
  const LOG_START      = X_LEFT + PREAMBLE_WIDTH;  // x where AI-era log scale begins
  const END_YEAR       = 2040;
  const _xLog = d3.scaleLog()
    .domain([END_YEAR - 2026, END_YEAR - 1945])  // [14, 95]
    .range([X_RIGHT, LOG_START]);
  const _xPre = d3.scaleLinear()
    .domain([1843, 1945])
    .range([X_LEFT, LOG_START]);
  const xScale = year => year < 1945 ? _xPre(year) : _xLog(END_YEAR - year);
  const areaTop   = AREA_TOP;
  const areaBottom = AREA_BOT;
  const yScale    = d3.scaleLinear().domain([0, 100]).range([areaBottom, areaTop]);
  const timelineY = TIMELINE_Y;
  const levelY    = LEVEL_Y;

  // Linear interpolation of bu% at any year from areaData
  function getBuAt(year) {
    const d = areaData;
    const before = d.filter(p => p.year <= year).pop();
    const after  = d.find(p => p.year > year);
    if (!before) return after.bu;
    if (!after)  return before.bu;
    const t = (year - before.year) / (after.year - before.year);
    return before.bu + t * (after.bu - before.bu);
  }

  // ── 1. STACKED AREA CHART ─────────────────────────────────────────────────

  const buArea = d3.area()
    .x(d => xScale(d.year)).y0(areaBottom).y1(d => yScale(d.bu))
    .curve(d3.curveCatmullRom.alpha(0.5));

  svg.append('path').datum(areaData).attr('d', buArea)
    .attr('fill', '#F39C12').attr('fill-opacity', 0.80);

  const tdArea = d3.area()
    .x(d => xScale(d.year)).y0(d => yScale(d.bu)).y1(areaTop)
    .curve(d3.curveCatmullRom.alpha(0.5));

  svg.append('path').datum(areaData).attr('d', tdArea)
    .attr('fill', '#85C1E9').attr('fill-opacity', 0.80);

  // ── 2. WHITE DOTTED VERTICAL GUIDE LINES (events → area chart) ───────────

  events.forEach(ev => {
    const cx = xScale(ev.year);
    svg.append('line')
      .attr('x1', cx).attr('y1', timelineY + 6)
      .attr('x2', cx).attr('y2', areaBottom)
      .attr('stroke', 'rgba(255,255,255,0.55)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4');
  });

  // ── 3. ERA LABELS INSIDE AREA (auto-positioned at colour midpoint) ────────

  areaLabels.forEach(al => {
    const cx  = xScale(al.year);
    const bu  = getBuAt(al.year);
    const divY = yScale(bu);
    // Vertical midpoint of the relevant coloured band, with optional dy stagger
    const yPos = al.color === 'blue'
      ? (divY + areaTop)    / 2   // blue  = top-down, above dividing line
      : (areaBottom + divY) / 2;  // orange = bottom-up, below dividing line
    const ey = yPos + (al.dy || 0);  // effective y after stagger

    svg.append('text')
      .attr('x', cx).attr('y', ey - 10)  // 10px above effective centre (was 6)
      .attr('text-anchor', 'middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_AREA_LABEL).attr('font-weight', 700)  // was 18
      .attr('fill', S.WHITE)
      .text(al.label);

    if (al.sub) {
      svg.append('text')
        .attr('x', cx).attr('y', ey + 12)  // 12px below effective centre (was 8)
        .attr('text-anchor', 'middle')
        .attr('font-family', S.FONT).attr('font-size', FONT_AREA_SUB).attr('font-style', 'italic')  // was 15
        .attr('fill', S.WHITE)
        .text(al.sub);
    }
  });

  // ── 4. X AXIS TICKS AND LABELS ────────────────────────────────────────────

  [1843, 1950, 1970, 1990, 2010, 2020, 2026].forEach(yr => {
    const tx = xScale(yr);
    svg.append('line')
      .attr('x1', tx).attr('y1', areaBottom).attr('x2', tx).attr('y2', areaBottom + 6)
      .attr('stroke', S.GRAY).attr('stroke-width', 1);
    svg.append('text')
      .attr('x', tx).attr('y', areaBottom + 16).attr('text-anchor', 'middle')
      .attr('font-family', S.FONT).attr('font-size', FONT_AXIS).attr('fill', S.GRAY)
      .text(yr);
  });

  // ── 5. TIMELINE BAR AND ARROW ─────────────────────────────────────────────

  const tlX1 = xScale(1843), tlX2 = xScale(2026);
  svg.append('line')
    .attr('x1', tlX1).attr('y1', timelineY).attr('x2', tlX2).attr('y2', timelineY)
    .attr('stroke', S.GRAY_MID).attr('stroke-width', 2.5);
  svg.append('polygon')
    .attr('points', `${tlX2},${timelineY - 7} ${tlX2 + 14},${timelineY} ${tlX2},${timelineY + 7}`)
    .attr('fill', S.GRAY_MID);

  // ── 6. EVENT DOTS ON TIMELINE ─────────────────────────────────────────────

  events.forEach(ev => {
    const isRecent = ev.year >= 2017;
    svg.append('circle')
      .attr('cx', xScale(ev.year)).attr('cy', timelineY)
      .attr('r', isRecent ? 8 : 6)
      .attr('fill', isRecent ? S.RED_DARK : S.RED);
  });

  // ── 7 & 8. EVENT LABELS — 45° rotated, left side anchored to stem ──────────
  // A vertical stem rises from each dot to a level-dependent height.
  // The label is anchored (text-anchor="start") at the stem top and rotates
  // -45° so text flows upper-right.  Because all labels go in the same
  // direction, two parallel 45° lines with different starting heights can
  // never intersect — the level system guarantees zero overlap.

  const STEM_H = { 1: 27, 2: 55, 3: 75 };  // stem height above timeline per level

  events.forEach(ev => {
    const cx      = xScale(ev.year);
    const stemH   = STEM_H[ev.lv] || STEM_H[1];
    const stemTop = timelineY - stemH;

    // Vertical stem from dot up to anchor
    if (stemH > 14) {
      svg.append('line')
        .attr('x1', cx).attr('y1', timelineY - 8)
        .attr('x2', cx).attr('y2', stemTop)
        .attr('stroke', S.GRAY_MID).attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
    }

    // Rotated label: left side of text anchored at stem top
    const g = svg.append('g')
      .attr('transform', `rotate(-45, ${cx}, ${stemTop})`);

    const textEl = g.append('text')
      .attr('x', cx).attr('y', stemTop)
      .attr('text-anchor', 'start')
      .attr('font-family', S.FONT)
      .attr('data-skip-check', '1');

    textEl.append('tspan')
      .attr('font-size', FONT_EVENT_TITLE).attr('font-weight', 700)
      .attr('fill', S.TEXT)
      .text(ev.title);

    if (ev.sub) {
      const subTspan = textEl.append('tspan')
        .attr('font-size', FONT_EVENT_SUB).attr('font-weight', 300)
        .attr('fill', S.TEXT_LIGHT);
      if (ev.lines === 2) {
        subTspan.attr('x', cx).attr('dx', 8).attr('dy', FONT_EVENT_TITLE + 2).text(ev.sub);
      } else {
        subTspan.text('  ' + ev.sub);
      }
    }
  });

  // ── 9. BAND PARADIGM LABELS (left margin, rotated) ───────────────────────
  // Positions derived from area midpoints at year ~1990 (a balanced midpoint)
  // Blue (top-down) midpoint ≈ y=329, orange (bottom-up) midpoint ≈ y=464

  // Band paradigm labels — shortened to avoid rotated bounding-box overlap
  // (full phrases were ~200px tall when rotated, overlapping each other)
  svg.append('text')
    .attr('transform', 'translate(22, 360) rotate(-90)')
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_BAND_VERT).attr('font-weight', 700)
    .attr('fill', '#2E86C1')
    .text(misc.band_symbolic);

  svg.append('text')
    .attr('transform', 'translate(22, 565) rotate(-90)')
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_BAND_VERT).attr('font-weight', 700)
    .attr('fill', '#D68910')
    .text(misc.band_connectionist);

  // ── 10. LEGEND ─────────────────────────────────────────────────────────────

  svg.append('rect').attr('x', LEGEND_X).attr('y', LEGEND_Y).attr('width', 20).attr('height', 16)
    .attr('fill', '#F39C12').attr('fill-opacity', 0.80);
  svg.append('text').attr('x', LEGEND_X + 26).attr('y', LEGEND_Y + 8).attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_LEGEND).attr('fill', S.TEXT)
    .text(misc.legend_connectionist);

  const blueX = LEGEND_X + 490;
  svg.append('rect').attr('x', blueX).attr('y', LEGEND_Y).attr('width', 20).attr('height', 16)
    .attr('fill', '#85C1E9').attr('fill-opacity', 0.80);
  svg.append('text').attr('x', blueX + 26).attr('y', LEGEND_Y + 8).attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', FONT_LEGEND).attr('fill', S.TEXT)
    .text(misc.legend_symbolic);

  return document.body.innerHTML;
};
