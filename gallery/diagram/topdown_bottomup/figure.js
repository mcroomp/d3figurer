// ── Tabler Icons (MIT License, tabler.io) — inner SVG path strings, 24×24 viewBox ──
// Colours are applied at render time via tablerSvg(); paths are colour-neutral.
const PATHS = {
  bank: `
    <path d="M3 21l18 0"/>
    <path d="M3 10l18 0"/>
    <path d="M5 6l7 -3l7 3"/>
    <path d="M4 10l0 11"/>
    <path d="M20 10l0 11"/>
    <path d="M8 14l0 3"/>
    <path d="M12 14l0 3"/>
    <path d="M16 14l0 3"/>`,

  scroll: `
    <path d="M14 3v4a1 1 0 0 0 1 1h4"/>
    <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2"/>
    <path d="M9 17h6"/>
    <path d="M9 13h6"/>`,

  gear: `
    <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065"/>
    <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>`,

  math: `
    <path d="M4 5a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -14"/>
    <path d="M8 8a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1l0 -1"/>
    <path d="M8 14l0 .01"/>
    <path d="M12 14l0 .01"/>
    <path d="M16 14l0 .01"/>
    <path d="M8 17l0 .01"/>
    <path d="M12 17l0 .01"/>
    <path d="M16 17l0 .01"/>`,

  database: `
    <path d="M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3"/>
    <path d="M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2"/>
    <path d="M7 8l0 .01"/>
    <path d="M7 16l0 .01"/>`,

  network: `
    <path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
    <path d="M8 20.1a9 9 0 0 1 -5 -7.1"/>
    <path d="M16 20.1a9 9 0 0 0 5 -7.1"/>
    <path d="M6.2 5a9 9 0 0 1 11.4 0"/>`,

  barchart: `
    <path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6"/>
    <path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10"/>
    <path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14"/>
    <path d="M4 20h14"/>`,

  // brain + small zoom-in magnifier overlaid in bottom-right corner
  brain_mag: `
    <g transform="scale(0.72) translate(1,0)">
      <path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8"/>
      <path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8"/>
      <path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5"/>
      <path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0"/>
      <path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5"/>
      <path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10"/>
    </g>
    <g transform="translate(12,12) scale(0.55)">
      <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/>
      <path d="M7 10l6 0"/>
      <path d="M10 7l0 6"/>
      <path d="M21 21l-6 -6"/>
    </g>`,
};

function tablerSvg(inner, strokeColor, bgColor) {
  const bgEl = bgColor
    ? `<rect x="1" y="1" width="22" height="22" rx="4" fill="${bgColor}"/>`
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"` +
    ` fill="none" stroke="${strokeColor}" stroke-width="1.8"` +
    ` stroke-linecap="round" stroke-linejoin="round">${bgEl}${inner}</svg>`
  );
}

globalThis.__d3fig_figure = function({ data, S, d3, assets }) {
  const { left: LD, right: RD } = data;

  // ── Layout ──────────────────────────────────────────────────────────────────
  const W   = 900;
  const BH  = 50;    // normal box height
  const BHS = 64;    // box-with-subtitle height (when sub is present)
  const AG  = 26;    // arrow gap between boxes
  const ISZ = 38;    // icon size (rendered outside boxes)

  // Heights are derived: tall box when a sub-label is present
  const LEFT  = LD.boxes.map(b => ({ ...b, h: b.sub ? BHS : BH }));
  const RIGHT = RD.boxes.map(b => ({ ...b, h: b.sub ? BHS : BH }));

  const leftH = LEFT.reduce((s, b) => s + b.h, 0) + (LEFT.length - 1) * AG;

  const SAW  = 40;
  const SAP  = 8;
  const LX   = SAW + SAP;         // left box x
  const BW   = 320;               // box width (slimmer to leave room for outside icons)
  const RX   = W - SAW - SAP - BW; // right box x
  const ICGP = 6;                 // gap between box edge and icon

  const HY  = 10;
  const HH  = 64;
  const BY  = HY + HH + 8;

  const panelBot = BY + leftH;
  const H = panelBot + 28;

  const { svg, document } = makeSVG(W, H);

  // ── Book colors ──────────────────────────────────────────────────────────────
  const HDR_L    = S.GRAY_DARK;   // '#555555' — left header fill
  const HDR_R    = S.RED;         // '#e4003b' — right header fill
  const STR_L    = S.GRAY;        // '#787878' — left box stroke
  const STR_R    = '#b80030';     // darker red — right box stroke
  const BOX_F_L  = '#f5f5f5';     // left box fill
  const BOX_F_R  = '#fff5f7';     // right box fill (very light red)
  const ICN_ST_L = S.GRAY_DARK;   // '#555555' — left icon stroke
  const ICN_BG_L = '#e8e8e8';     // left icon bg
  const ICN_ST_R = '#b80030';     // right icon stroke
  const ICN_BG_R = '#fde8ed';     // right icon bg (light red)
  const ARR_C    = S.GRAY_DARK;   // '#555555' — connector arrows
  const SIDE_C   = S.RED;         // '#e4003b' — side block arrows
  const TEXT_H   = S.TEXT;        // '#333333'
  const TEXT_S   = S.GRAY;        // '#787878'
  const FONT     = S.FONT;

  // ── Defs: single standard right-pointing arrowhead (orient="auto" handles rotation) ──
  const defs = svg.append('defs');
  defs.append('marker').attr('id', 'arr')
    .attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5)
    .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M 0 0 L 10 5 L 0 10 z').attr('fill', ARR_C);

  // ── Helper: embed a Tabler icon as a nested <svg> ─────────────────────────
  let _iconSeq = 0;
  function appendIcon(parentSel, key, x, y, sz, strokeC, bgC) {
    const svgStr     = tablerSvg(PATHS[key], strokeC, bgC);
    const vbMatch    = svgStr.match(/viewBox=["']([^"']+)["']/);
    const viewBox    = vbMatch ? vbMatch[1] : '0 0 24 24';
    const innerMatch = svgStr.match(/<svg[^>]*>([\s\S]*?)<\/svg>\s*$/);
    if (!innerMatch) return;

    const pfx = `ic${_iconSeq++}_`;
    let inner = innerMatch[1]
      .replace(/\bid="([^"]+)"/g,    `id="${pfx}$1"`)
      .replace(/\bhref="#([^"]+)"/g, `href="#${pfx}$1"`)
      .replace(/url\(#([^)]+)\)/g,   `url(#${pfx}$1)`);

    const ns = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(ns, 'svg');
    el.setAttribute('x',       x);
    el.setAttribute('y',       y);
    el.setAttribute('width',   sz);
    el.setAttribute('height',  sz);
    el.setAttribute('viewBox', viewBox);

    // Copy top-level SVG attributes (stroke, fill, stroke-width, etc.)
    const attrMatch = svgStr.match(/<svg([^>]*)>/);
    if (attrMatch) {
      const attrRe = /(\S+)="([^"]*)"/g;
      let m;
      while ((m = attrRe.exec(attrMatch[1])) !== null) {
        const [, name, val] = m;
        if (!['xmlns','viewBox','x','y','width','height'].includes(name))
          el.setAttribute(name, val);
      }
    }

    el.innerHTML = inner;
    parentSel.node().appendChild(el);
  }

  // ── Helper: draw a content box (text only — icons rendered outside) ──────
  function drawBox(x, y, w, b, strokeC, fillC) {
    const cx     = x + w / 2;
    const labelY = b.sub ? y + b.h * 0.34 : y + b.h / 2;

    svg.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', b.h)
      .attr('rx', 9).attr('fill', fillC).attr('stroke', strokeC).attr('stroke-width', 2);

    svg.append('text').attr('x', cx).attr('y', labelY)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-family', FONT).attr('font-size', 15).attr('font-weight', 700)
      .attr('fill', TEXT_H).text(b.label);

    if (b.sub) {
      svg.append('text').attr('x', cx).attr('y', y + b.h * 0.67)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('font-family', FONT).attr('font-size', 12).attr('font-weight', 400)
        .attr('fill', TEXT_S).attr('font-style', 'italic').text(b.sub);
    }
  }

  // ── Helper: render icons outside a box ───────────────────────────────────
  // side 'right': icons placed to the right of the box at (x + w + ICGP)
  // side 'left':  icons placed to the left  of the box at (x - ICGP - totalW)
  function drawIcons(icons, boxX, boxW, boxY, boxH, side, strokeC, bgC) {
    if (!icons || icons.length === 0) return;
    const totalW = icons.length * ISZ + (icons.length - 1) * 4;
    const startX = side === 'right'
      ? boxX + boxW + ICGP
      : boxX - ICGP - totalW;
    const iconY = boxY + (boxH - ISZ) / 2;
    icons.forEach((key, j) => {
      appendIcon(svg, key, startX + j * (ISZ + 4), iconY, ISZ, strokeC, bgC);
    });
  }

  // ── Connector arrows (down / up) ─────────────────────────────────────────
  // Both use marker 'arr' (right-pointing); orient="auto" rotates to match line direction.
  function arrowDn(cx, y1, y2) {
    // Line goes downward: orient rotates marker 90° → points down ✓
    svg.append('line').attr('x1', cx).attr('y1', y1 + 2).attr('x2', cx).attr('y2', y2 - 5)
      .attr('stroke', ARR_C).attr('stroke-width', 2.5).attr('marker-end', 'url(#arr)');
  }
  function arrowUp(cx, y1, y2) {
    // Line goes upward (from y2 toward y1, i.e. decreasing SVG y): orient rotates 270° → points up ✓
    svg.append('line').attr('x1', cx).attr('y1', y2 - 2).attr('x2', cx).attr('y2', y1 + 5)
      .attr('stroke', ARR_C).attr('stroke-width', 2.5).attr('marker-end', 'url(#arr)');
  }

  // ── Side block arrow ──────────────────────────────────────────────────────
  function sideArrow(cx, y1, y2, dir, label) {
    const aw = 14, ahead = 16;
    const bodyY1 = dir === 'down' ? y1 : y2;
    const bodyY2 = dir === 'down' ? y2 - ahead : y1 + ahead;
    const tipY   = dir === 'down' ? y2 + 4 : y1 - 4;

    svg.append('rect')
      .attr('x', cx - aw).attr('y', Math.min(bodyY1, bodyY2))
      .attr('width', aw * 2).attr('height', Math.abs(bodyY2 - bodyY1))
      .attr('fill', SIDE_C).attr('opacity', 0.82);
    const tx1 = cx - aw * 1.8, tx2 = cx + aw * 1.8;
    const pts = `${tx1},${bodyY2} ${tx2},${bodyY2} ${cx},${tipY}`;
    svg.append('polygon').attr('points', pts).attr('fill', SIDE_C).attr('opacity', 0.82);
    const midY = (y1 + y2) / 2;
    svg.append('text').attr('x', cx).attr('y', midY)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-family', FONT).attr('font-size', 11).attr('font-weight', 700)
      .attr('fill', 'white')
      .attr('transform', `rotate(${dir === 'down' ? -90 : 90},${cx},${midY})`)
      .text(label);
  }

  // ── Column headers ─────────────────────────────────────────────────────────
  svg.append('rect').attr('x', LX).attr('y', HY).attr('width', BW).attr('height', HH)
    .attr('rx', 10).attr('fill', HDR_L);
  svg.append('text').attr('x', LX + BW / 2).attr('y', HY + 22)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', FONT).attr('font-size', 17).attr('font-weight', 700)
    .attr('fill', 'white').text(LD.header);
  svg.append('text').attr('x', LX + BW / 2).attr('y', HY + 45)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', FONT).attr('font-size', 13).attr('font-weight', 400)
    .attr('fill', 'rgba(255,255,255,0.82)').text(LD.subheader);

  svg.append('rect').attr('x', RX).attr('y', HY).attr('width', BW).attr('height', HH)
    .attr('rx', 10).attr('fill', HDR_R);
  svg.append('text').attr('x', RX + BW / 2).attr('y', HY + 22)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', FONT).attr('font-size', 17).attr('font-weight', 700)
    .attr('fill', 'white').text(RD.header);
  svg.append('text').attr('x', RX + BW / 2).attr('y', HY + 45)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', FONT).attr('font-size', 13).attr('font-weight', 400)
    .attr('fill', 'rgba(255,255,255,0.82)').text(RD.subheader);

  // ── Left panel ────────────────────────────────────────────────────────────
  const drawConnector = (dir, cx, y1, y2) =>
    dir === 'down' ? arrowDn(cx, y1, y2) : arrowUp(cx, y1, y2);

  let ly = BY;
  LEFT.forEach((b, i) => {
    drawBox(LX, ly, BW, b, STR_L, BOX_F_L);
    drawIcons(b.icons, LX, BW, ly, b.h, 'right', ICN_ST_L, ICN_BG_L);
    if (i < LEFT.length - 1) drawConnector(LD.arrowDir, LX + BW / 2, ly + b.h, ly + b.h + AG);
    ly += b.h + AG;
  });

  // ── Right panel ───────────────────────────────────────────────────────────
  let ry = BY;
  RIGHT.forEach((b, i) => {
    drawBox(RX, ry, BW, b, STR_R, BOX_F_R);
    drawIcons(b.icons, RX, BW, ry, b.h, 'left', ICN_ST_R, ICN_BG_R);
    if (i < RIGHT.length - 1) drawConnector(RD.arrowDir, RX + BW / 2, ry + b.h, ry + b.h + AG);
    ry += b.h + AG;
  });
  // Arrow from data cloud up to bottom of last RIGHT box
  drawConnector(RD.arrowDir, RX + BW / 2, ry - AG, ry);

  // ── Data cloud (remaining height below RIGHT boxes) ───────────────────────
  const cloudTop = ry;
  const cloudH   = panelBot - cloudTop;

  // No background rect — words float on the figure background.

  // ── Word + icon cloud: filled ellipse via Fermat (sunflower) spiral ────────
  // Words are placed inside an ellipse centred above the label.
  // Label sits below the ellipse with a clear gap.
  const LABEL_H  = 18;                          // reserved height for label at bottom
  const cloudCX  = RX + BW / 2;
  const EX       = BW  * 0.44;                  // ellipse semi-axis x
  const EY       = (cloudH - LABEL_H - 6) / 2;  // semi-axis y fills available height
  const cloudCY  = cloudTop + EY + 2;            // centre: just below top edge
  const GA       = Math.PI * (3 - Math.sqrt(5)); // golden angle ≈ 137.5°

  // Interleave icons every ~6 words in the spiral sequence
  const ISZ_C    = 20;
  const CLOUD_ICONS = ['barchart', 'network', 'database', 'gear', 'math', 'scroll', 'bank'];
  const totalSlots = RD.cloudWords.length + CLOUD_ICONS.length;

  let wordIdx = 0, icSlot = 0;
  for (let i = 0; i < totalSlots; i++) {
    const t     = (i + 0.5) / totalSlots;
    const r     = Math.sqrt(t);
    const theta = i * GA;
    const px    = cloudCX + r * EX * Math.cos(theta);
    const py    = cloudCY + r * EY * Math.sin(theta);

    // Place an icon every 6th slot (offset by 3 so they start mid-ring)
    if ((i + 3) % 6 === 0 && icSlot < CLOUD_ICONS.length) {
      appendIcon(svg, CLOUD_ICONS[icSlot++], px - ISZ_C / 2, py - ISZ_C / 2,
        ISZ_C, ICN_ST_R, ICN_BG_R);
    } else if (wordIdx < RD.cloudWords.length) {
      const sz = Math.max(10, Math.round(17 - r * 5));
      const op = 0.38 + (1 - r) * 0.25;
      svg.append('text')
        .attr('x', px).attr('y', py)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('font-family', FONT).attr('font-size', sz).attr('font-weight', 400)
        .attr('fill', S.RED).attr('opacity', op)
        .text(RD.cloudWords[wordIdx++]);
    }
  }

  // Label below the ellipse — clear gap from words
  svg.append('text').attr('x', cloudCX).attr('y', cloudTop + cloudH - 4)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'auto')
    .attr('font-family', FONT).attr('font-size', 13).attr('font-weight', 700)
    .attr('fill', TEXT_H).text(RD.cloud);

  // ── Side block arrows ─────────────────────────────────────────────────────
  const arrowTop = BY + BH / 2;
  const arrowBot = panelBot - BH / 2;
  sideArrow(SAW / 2,     arrowTop, arrowBot, LD.arrowDir, LD.sideLabel);
  sideArrow(W - SAW / 2, arrowTop, arrowBot, RD.arrowDir, RD.sideLabel);

  return document.body.innerHTML;
};
