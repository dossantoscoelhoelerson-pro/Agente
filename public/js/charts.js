// Gráficos do painel da Etapa 3 (adendo rodada 3, seção 1b): SVG puro,
// sem biblioteca externa, mesma filosofia vanilla do resto do projeto.
// Uma única série cada (o resultado desta organização), por isso sem
// legenda -- o título de cada card já identifica a série (ver skill de
// dataviz: legenda só é necessária a partir de 2 séries). Cor única sobre
// traços finos e recessivos, rótulos sempre em texto, nunca só cor. As
// cores vêm da paleta oficial (adendo rodada 4, seção 2) -- o dado do
// gráfico é "tecnologia/posição", por isso o marcador usa Azul Digital;
// texto e traços estruturais usam Azul Profundo. SVG é gerado como string
// (sem acesso a variáveis CSS), por isso os hex ficam fixos aqui -- mantidos
// em paridade com public/css/styles.css.
const CHART_INK = '#123F63';
const CHART_INK_SOFT = '#4D6F8A';
const CHART_LINE = '#D9E1E8';
const CHART_ACCENT = '#3E9BC1';

function escapeXml(s){
  return String(s).replace(/[<>&]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
}

// Gráfico de posição das duas dimensões (Capacidade Digital x Capacidade
// Organizacional), estilo do gráfico de dispersão da Figura 4 do artigo de
// referência. xIdx/yIdx são o índice (0-3) do nível de cada dimensão, ou
// null se não foi possível extrair do texto do resultado.
function renderDimensionScatter(container, { xLabels, yLabels, xIdx, yIdx }){
  // padL maior que o necessário para os rótulos curtos de Capacidade
  // Digital -- alguns rótulos de Capacidade Organizacional são bem mais
  // longos ("Planejando mudança", "Mudando lentamente") e, com um padL
  // apertado, o texto (ancorado à direita, crescendo para a esquerda)
  // ultrapassava x=0 do viewBox e ficava cortado (bug real, pego ao usar
  // este gráfico numa coluna mais estreita a partir da rodada 7).
  const W = 340, H = 300, padL = 118, padB = 46, padT = 16, padR = 16;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = 4;
  const cellW = plotW / n, cellH = plotH / n;

  let grid = '';
  for(let i = 0; i <= n; i++){
    const x = padL + i * cellW;
    grid += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT+plotH}" stroke="${CHART_LINE}" stroke-width="1"/>`;
    const y = padT + i * cellH;
    grid += `<line x1="${padL}" y1="${y}" x2="${padL+plotW}" y2="${y}" stroke="${CHART_LINE}" stroke-width="1"/>`;
  }

  let xTicks = '', yTicks = '';
  xLabels.forEach((lbl, i) => {
    const x = padL + (i + 0.5) * cellW;
    xTicks += `<text x="${x}" y="${padT+plotH+18}" font-size="10" fill="${CHART_INK_SOFT}" text-anchor="middle">${escapeXml(lbl)}</text>`;
  });
  yLabels.forEach((lbl, i) => {
    const y = padT + plotH - (i + 0.5) * cellH;
    yTicks += `<text x="${padL-8}" y="${y+3}" font-size="10" fill="${CHART_INK_SOFT}" text-anchor="end">${escapeXml(lbl)}</text>`;
  });

  let point = '';
  if(xIdx !== null && xIdx !== undefined && yIdx !== null && yIdx !== undefined){
    const cx = padL + (xIdx + 0.5) * cellW;
    const cy = padT + plotH - (yIdx + 0.5) * cellH;
    point = `<circle cx="${cx}" cy="${cy}" r="8" fill="${CHART_ACCENT}" stroke="white" stroke-width="2"><title>Capacidade Digital: ${escapeXml(xLabels[xIdx])} / Capacidade Organizacional: ${escapeXml(yLabels[yIdx])}</title></circle>`;
  }

  const axisLabels = `
    <text x="${padL+plotW/2}" y="${H-4}" font-size="11" fill="${CHART_INK}" text-anchor="middle" font-weight="600">Capacidade Digital</text>
    <text x="14" y="${padT+plotH/2}" font-size="11" fill="${CHART_INK}" text-anchor="middle" font-weight="600" transform="rotate(-90 14 ${padT+plotH/2})">Capacidade Organizacional</text>
  `;

  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Posição nas duas dimensões">${grid}${xTicks}${yTicks}${point}${axisLabels}</svg>`;
  container.innerHTML = svg;
  if(xIdx === null || xIdx === undefined || yIdx === null || yIdx === undefined){
    const note = document.createElement('div');
    note.className = 'chart-empty-note';
    note.textContent = 'Não encontrei as duas dimensões no texto do resultado do DEXi -- o ponto não pôde ser posicionado.';
    container.appendChild(note);
  }
}

// Radar/polar dos 7 grupos intermediários (A1-A4, B1-B3), estilo da Figura
// 5 do artigo de referência. groups: [{label, idx: 0-3 ou null}].
function renderGroupRadar(container, groups){
  // W/H maiores que o raio*2 dão espaço para os rótulos mais longos (ex.
  // "Modelo de Negócio", "Cultura Organizacional") não serem cortados pela
  // borda do viewBox -- ajuste de espaçamento, mesma lógica visual de antes.
  const W = 500, H = 420, cx = W/2, cy = H/2, maxR = 100;
  const n = groups.length;
  const angleFor = (i) => (Math.PI * 2 * i / n) - Math.PI / 2;
  const pointFor = (i, level) => {
    const r = maxR * ((level + 1) / 4);
    const a = angleFor(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  let rings = '';
  for(let lvl = 0; lvl < 4; lvl++){
    const r = maxR * ((lvl + 1) / 4);
    let pts = '';
    for(let i = 0; i <= n; i++){
      const a = angleFor(i % n);
      pts += `${cx + r*Math.cos(a)},${cy + r*Math.sin(a)} `;
    }
    rings += `<polygon points="${pts}" fill="none" stroke="${CHART_LINE}" stroke-width="1"/>`;
  }

  let axes = '', labels = '';
  groups.forEach((g, i) => {
    const a = angleFor(i);
    const ox = cx + maxR * Math.cos(a), oy = cy + maxR * Math.sin(a);
    axes += `<line x1="${cx}" y1="${cy}" x2="${ox}" y2="${oy}" stroke="${CHART_LINE}" stroke-width="1"/>`;
    const lx = cx + (maxR + 26) * Math.cos(a), ly = cy + (maxR + 26) * Math.sin(a);
    const anchor = Math.cos(a) > 0.2 ? 'start' : (Math.cos(a) < -0.2 ? 'end' : 'middle');
    labels += `<text x="${lx}" y="${ly}" font-size="10.5" fill="${CHART_INK}" text-anchor="${anchor}">${escapeXml(g.label)}</text>`;
  });

  const known = groups.filter((g) => g.idx !== null && g.idx !== undefined);
  let polygon = '', dots = '';
  if(known.length >= 3){
    let pts = '';
    groups.forEach((g, i) => {
      const lvl = (g.idx === null || g.idx === undefined) ? 0 : g.idx;
      const [px, py] = pointFor(i, lvl);
      pts += `${px},${py} `;
    });
    polygon = `<polygon points="${pts}" fill="${CHART_ACCENT}" fill-opacity="0.18" stroke="${CHART_ACCENT}" stroke-width="2"/>`;
    groups.forEach((g, i) => {
      const has = g.idx !== null && g.idx !== undefined;
      const [px, py] = pointFor(i, has ? g.idx : 0);
      if(has){
        dots += `<circle cx="${px}" cy="${py}" r="4.5" fill="${CHART_ACCENT}"><title>${escapeXml(g.label)}: ${escapeXml(g.levelLabel || '')}</title></circle>`;
      } else {
        dots += `<circle cx="${px}" cy="${py}" r="4.5" fill="white" stroke="${CHART_INK_SOFT}" stroke-width="1.5" stroke-dasharray="2,2"><title>${escapeXml(g.label)}: não identificado no texto do resultado</title></circle>`;
      }
    });
  }

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Posição por grupo">${rings}${axes}${polygon}${dots}${labels}</svg>`;
  if(known.length < 3){
    const note = document.createElement('div');
    note.className = 'chart-empty-note';
    note.textContent = 'Não encontrei níveis suficientes dos grupos no texto do resultado do DEXi para desenhar o radar.';
    container.appendChild(note);
  }
}

// Indicador circular de posição na escala + selo de classificação (adendo
// rodada 5, item 1.3 -- referência: mockup em orbe_identidade_visual_e_
// mockup.png, que usa um anel circular de percentual). Deliberadamente NÃO
// desenha um número de percentual: o preenchimento do anel é só a posição
// do nível oficial dentro da própria escala de 4 níveis (idx/(total-1)),
// nunca um percentual calculado -- o único texto mostrado é o rótulo do
// nível, que já vem do resultado oficial do DEXi (nunca inventado aqui).
function wrapGaugeLabel(text){
  const words = String(text || '').split(' ');
  const lines = [];
  let cur = '';
  words.forEach((w) => {
    if((cur + ' ' + w).trim().length > 12 && cur){ lines.push(cur); cur = w; }
    else cur = (cur ? cur + ' ' : '') + w;
  });
  if(cur) lines.push(cur);
  return lines.slice(0, 2);
}

function renderLevelGauge(container, { levelLabel, idx, total }){
  const size = 140, stroke = 12, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const known = idx !== null && idx !== undefined && total > 1;
  const frac = known ? idx / (total - 1) : 0;
  const dash = circumference * frac;

  const lines = known ? wrapGaugeLabel(levelLabel) : ['—'];
  const lineHeight = 15;
  const startY = cy - ((lines.length - 1) * lineHeight) / 2 + 4;
  const text = lines.map((l, i) => `<tspan x="${cx}" y="${startY + i * lineHeight}">${escapeXml(l)}</tspan>`).join('');

  const svg = `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Posição na escala de classificação">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${CHART_LINE}" stroke-width="${stroke}" />
      ${known ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${CHART_ACCENT}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${dash} ${circumference}" transform="rotate(-90 ${cx} ${cy})" />` : ''}
      <text text-anchor="middle" font-size="13" font-weight="600" fill="${CHART_INK}">${text}</text>
    </svg>`;
  container.innerHTML = svg;
}
