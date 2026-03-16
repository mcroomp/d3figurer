globalThis.__d3fig_figure = function({ data, S, d3, assets }) {

  // ── Layout ────────────────────────────────────────────────────────────────
  const W = 980, H = 900;          // canvas size
  const CX = 490;                  // horizontal centre of the diagram

  // Usuario box
  const USER_X = CX - 130;        // usuario box left edge
  const USER_Y = 20;               // usuario box top edge
  const USER_W = 260;              // usuario box width
  const USER_H = 80;               // usuario box height

  // Arrows between Usuario and agent container
  const ARROW_Y_TOP = 100;         // y where arrows leave the usuario box (bottom edge)
  const ARROW_Y_BOT = 162;         // y where arrows enter the agent container

  // Agent outer container
  const AGENT_X = 16;              // agent container left edge
  const AGENT_Y = 162;             // agent container top edge (= ARROW_Y_BOT)
  const AGENT_W = 948;             // agent container width
  const AGENT_H = 510;             // agent container height

  // Memoria sidebar (left)
  const MX = 26, MY = 194;        // top-left corner of Memoria box
  const MW = 212, MH = 456;       // width / height of Memoria box

  // Conocimiento sidebar (right)
  const KX = 742, KY = 194;      // top-left corner of Conocimiento box
  const KW = 212, KH = 456;      // width / height of Conocimiento box

  // Centre cycle phase boxes: x span 360–620 (width 260), centred at CX
  const PHASE_X = 360;             // left edge of phase boxes
  const PHASE_W = 260;             // width of each phase box

  const P1_Y = 180, P1_H = 94;    // Percibir box: top y, height
  // P2_Y is derived: P1_Y + P1_H + 28
  const P2_H = 148;                // Razonar box height
  // P3_Y is derived: P2_Y + P2_H + 28
  const P3_H = 94;                 // Actuar box height

  const PHASE_GAP = 28;            // vertical gap (with arrow) between phase boxes

  // Observe loop-back path (right side)
  const LOOP_X = 700;              // x of the vertical segment of the loop-back path

  // Herramientas section
  const TOOLS_LABEL_Y = 696;       // y of the "HERRAMIENTAS" section label
  const TOOL_W = 208, TOOL_H = 96; // each tool card width / height
  const TOOL_GAP = (W - 4 * TOOL_W - 2 * 20) / 3; // gap computed from W and card count
  const TOOL_START_X = 20;         // x of the first tool card
  const TOOL_Y = 710;              // y of tool cards top edge

  const { svg, document } = makeSVG(W, H);

  // DATA — loaded from data.js (edit that file to customise the figure)
  const { tools, misc } = data;

  // ── Defs ──────────────────────────────────────────────────────────────────
  const defs = svg.append('defs');
  addMarker(defs, 'ag', S.GRAY_MID);
  addMarker(defs, 'ar', S.RED);

  const grad = defs.append('linearGradient')
    .attr('id', 'llmGrad').attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '100%').attr('y2', '100%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', S.RED);
  grad.append('stop').attr('offset', '100%').attr('stop-color', S.RED_DARK);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function rect(x, y, w, h, fill, stroke, sw, dash, rx) {
    const r = svg.append('rect').attr('x', x).attr('y', y)
      .attr('width', w).attr('height', h).attr('rx', rx !== undefined ? rx : 8)
      .attr('fill', fill || S.WHITE).attr('stroke', stroke || 'none').attr('stroke-width', sw || 0);
    if (dash) r.attr('stroke-dasharray', dash);
    return r;
  }

  function line(x1, y1, x2, y2, stroke, sw, dash, marker) {
    const l = svg.append('line')
      .attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
      .attr('stroke', stroke || S.GRAY_MID).attr('stroke-width', sw || 2);
    if (dash) l.attr('stroke-dasharray', dash);
    if (marker) l.attr('marker-end', `url(#${marker})`);
  }

  function badge(cx, cy, n) {
    svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 16).attr('fill', S.RED);
    addText(svg, cx, cy, String(n), 20, 700, S.WHITE);
  }

  // ── USUARIO ────────────────────────────────────────────────────────────────
  rect(USER_X, USER_Y, USER_W, USER_H, S.GRAY_LIGHT, S.GRAY_MID, 1.5, null, 8).attr('data-box', 'usuario');
  addText(svg, CX, USER_Y + 24, misc.user_label, 28, 700, S.GRAY_DARK).attr('data-inside', 'usuario');
  addText(svg, CX, USER_Y + 56, misc.user_sublabel, 20, 400, S.TEXT_LIGHT, 'middle', true).attr('data-inside', 'usuario');

  // Down arrow
  line(CX - 10, ARROW_Y_TOP, CX - 10, ARROW_Y_BOT, S.GRAY_MID, 2, null, 'ag');
  addText(svg, CX - 22, 132, misc.arrow_down, 18, 400, S.GRAY_MID, 'end', true);

  // Dashed red arrow up
  svg.append('path')
    .attr('d', `M ${CX + 10},${ARROW_Y_BOT} L ${CX + 10},${ARROW_Y_TOP}`)
    .attr('fill', 'none').attr('stroke', S.RED).attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3').attr('marker-end', 'url(#ar)');
  addText(svg, CX + 22, 132, misc.arrow_up, 18, 400, S.RED, 'start', true);

  // ── AGENT CONTAINER ────────────────────────────────────────────────────────
  rect(AGENT_X, AGENT_Y, AGENT_W, AGENT_H, S.WHITE, S.RED, 1.5, '7,4', 10);
  addText(svg, AGENT_X + 22, AGENT_Y + 20, misc.agent_label, 22, 700, S.RED, 'start');

  // ── MEMORIA sidebar (left) ─────────────────────────────────────────────────
  rect(MX, MY, MW, MH, '#fef7f8', S.RED, 1.5, '5,3', 8).attr('data-box', 'memoria');
  addText(svg, MX + MW / 2, MY + 28, misc.memory_title, 24, 700, S.RED).attr('data-inside', 'memoria');

  // Short-term sub-box — 22px spacing (was 18) for font-17 items to have 5px gap
  rect(MX + 8, MY + 52, MW - 16, 164, S.GRAY_LIGHT, 'none', 0, null, 5).attr('data-box', 'mem-short');
  addText(svg, MX + MW / 2, MY + 80, misc.memory_short_title, 22, 700, S.GRAY_DARK).attr('data-skip-check', '1').attr('data-inside', 'mem-short');
  addText(svg, MX + MW / 2, MY + 104, misc.memory_short_1, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'mem-short');
  addText(svg, MX + MW / 2, MY + 126, misc.memory_short_2, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'mem-short');
  addText(svg, MX + MW / 2, MY + 148, misc.memory_short_3, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'mem-short');
  addText(svg, MX + MW / 2, MY + 170, misc.memory_short_4, 16, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'mem-short');

  // Long-term sub-box — 22px spacing (was 18)
  rect(MX + 8, MY + 230, MW - 16, 164, S.GRAY_LIGHT, 'none', 0, null, 5).attr('data-box', 'mem-long');
  addText(svg, MX + MW / 2, MY + 258, misc.memory_long_title, 22, 700, S.GRAY_DARK).attr('data-skip-check', '1').attr('data-inside', 'mem-long');
  addText(svg, MX + MW / 2, MY + 282, misc.memory_long_1, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'mem-long');
  addText(svg, MX + MW / 2, MY + 304, misc.memory_long_2, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'mem-long');
  addText(svg, MX + MW / 2, MY + 326, misc.memory_long_3, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'mem-long');
  addText(svg, MX + MW / 2, MY + 348, misc.memory_long_4, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'mem-long');

  // Dashed connector: memory → LLM
  line(MX + MW, MY + 200, 360, MY + 200, S.RED, 1, '4,3');

  // ── CONOCIMIENTO sidebar (right) ───────────────────────────────────────────
  rect(KX, KY, KW, KH, '#fef7f8', S.RED, 1.5, '5,3', 8).attr('data-box', 'conocimiento');
  addText(svg, KX + KW / 2, KY + 28, misc.knowledge_title, 24, 700, S.RED).attr('data-inside', 'conocimiento');

  // RAG sub-box — 22px spacing (was 18)
  rect(KX + 8, KY + 52, KW - 16, 164, S.GRAY_LIGHT, 'none', 0, null, 5).attr('data-box', 'con-rag');
  addText(svg, KX + KW / 2, KY + 80, misc.rag_title, 22, 700, S.GRAY_DARK).attr('data-skip-check', '1').attr('data-inside', 'con-rag');
  addText(svg, KX + KW / 2, KY + 104, misc.rag_1, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'con-rag');
  addText(svg, KX + KW / 2, KY + 126, misc.rag_2, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'con-rag');
  addText(svg, KX + KW / 2, KY + 148, misc.rag_3, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'con-rag');
  addText(svg, KX + KW / 2, KY + 170, misc.rag_4, 16, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'con-rag');

  // Docs sub-box — 22px spacing (was 18)
  rect(KX + 8, KY + 230, KW - 16, 164, S.GRAY_LIGHT, 'none', 0, null, 5).attr('data-box', 'con-docs');
  addText(svg, KX + KW / 2, KY + 258, misc.docs_title, 22, 700, S.GRAY_DARK).attr('data-skip-check', '1').attr('data-inside', 'con-docs');
  addText(svg, KX + KW / 2, KY + 282, misc.docs_1, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'con-docs');
  addText(svg, KX + KW / 2, KY + 304, misc.docs_2, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'con-docs');
  addText(svg, KX + KW / 2, KY + 326, misc.docs_3, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'con-docs');
  addText(svg, KX + KW / 2, KY + 348, misc.docs_4, 17, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'con-docs');

  // Dashed connector: LLM → knowledge
  line(620, MY + 200, KX, MY + 200, S.RED, 1, '4,3');

  // ── CENTRE CYCLE ── 3 numbered phases ──────────────────────────────────────
  // Phase boxes: x=360–620 (w=260), centred at CX=490

  // 1. PERCIBIR
  rect(PHASE_X, P1_Y, PHASE_W, P1_H, S.GRAY_LIGHT, S.GRAY_MID, 1.5, null, 8).attr('data-box', 'phase1');
  badge(PHASE_X + 20, P1_Y + P1_H / 2, 1);
  addText(svg, CX + 8, P1_Y + 34, misc.phase1_title, 26, 700, S.TEXT).attr('data-inside', 'phase1');
  addText(svg, CX + 8, P1_Y + 64, misc.phase1_sub, 18, 400, S.GRAY, 'middle', true).attr('data-inside', 'phase1');

  line(CX, P1_Y + P1_H, CX, P1_Y + P1_H + PHASE_GAP, S.GRAY_MID, 2, null, 'ag');

  // 2. RAZONAR
  const p2y = P1_Y + P1_H + PHASE_GAP; // 302
  rect(PHASE_X, p2y, PHASE_W, P2_H, 'url(#llmGrad)', 'none', 0, null, 10).attr('data-box', 'phase2');
  badge(PHASE_X + 20, p2y + P2_H / 2, 2);
  addText(svg, CX + 8, p2y + 32, misc.phase2_title, 26, 700, S.WHITE).attr('data-inside', 'phase2');
  addText(svg, CX + 8, p2y + 64, misc.phase2_sub1, 18, 400, 'rgba(255,255,255,0.88)', 'middle', true).attr('data-inside', 'phase2');
  addText(svg, CX + 8, p2y + 90, misc.phase2_sub2, 18, 400, 'rgba(255,255,255,0.72)', 'middle', true).attr('data-inside', 'phase2');
  addText(svg, CX + 8, p2y + 116, misc.phase2_sub3, 18, 400, 'rgba(255,255,255,0.72)', 'middle', true).attr('data-inside', 'phase2');

  line(CX, p2y + P2_H, CX, p2y + P2_H + PHASE_GAP, S.GRAY_MID, 2, null, 'ag');

  // 3. ACTUAR
  const p3y = p2y + P2_H + PHASE_GAP; // 506
  rect(PHASE_X, p3y, PHASE_W, P3_H, '#fff5f7', S.RED, 1.5, null, 8).attr('data-box', 'phase3');
  badge(PHASE_X + 20, p3y + P3_H / 2, 3);
  addText(svg, CX + 8, p3y + 34, misc.phase3_title, 26, 700, S.RED).attr('data-skip-check', '1').attr('data-inside', 'phase3');
  addText(svg, CX + 8, p3y + 64, misc.phase3_sub, 19, 400, S.GRAY, 'middle', true).attr('data-skip-check', '1').attr('data-inside', 'phase3');

  // ── OBSERVE loop-back (right gap) ─────────────────────────────────────────
  svg.append('path')
    .attr('d', `M 620,${p3y + P3_H/2} L ${LOOP_X},${p3y + P3_H/2} L ${LOOP_X},${P1_Y + P1_H/2} L 620,${P1_Y + P1_H/2}`)
    .attr('fill', 'none')
    .attr('stroke', S.GRAY_MID).attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3')
    .attr('marker-end', 'url(#ag)');
  svg.append('text')
    .attr('transform', `translate(${LOOP_X + 16}, ${(P1_Y + p3y + P3_H) / 2}) rotate(90)`)
    .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
    .attr('font-family', S.FONT).attr('font-size', 18).attr('font-style', 'italic')
    .attr('fill', S.GRAY_MID)
    .text(misc.loop_label);

  // ── ACTUAR → TOOLS arrow ───────────────────────────────────────────────────
  line(CX, p3y + P3_H, CX, 682, S.RED, 2, null, 'ar');
  addText(svg, CX + 10, 652, misc.actions_label, 18, 400, S.RED, 'start', true);

  // ── HERRAMIENTAS ──────────────────────────────────────────────────────────
  addText(svg, CX, TOOLS_LABEL_Y, misc.tools_title, 20, 700, S.GRAY_MID);

  tools.forEach((t, i) => {
    const tx = TOOL_START_X + i * (TOOL_W + TOOL_GAP);
    const tcx = tx + TOOL_W / 2;
    const boxId = `tool-${i}`;
    rect(tx, TOOL_Y, TOOL_W, TOOL_H, S.GRAY_LIGHT, S.GRAY_MID, 1, null, 7).attr('data-box', boxId);
    addText(svg, tcx, TOOL_Y + 38, t.label, 18, 700, S.GRAY_DARK).attr('data-inside', boxId);  // was 22 — "Ejecución de Código" clips at 22
    addText(svg, tcx, TOOL_Y + 66, t.sub, 16, 400, S.GRAY, 'middle', true).attr('data-inside', boxId);
  });

  return document.body.innerHTML;
};
