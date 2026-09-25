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
const CHART_LINE = '#D9E1E8';
const CHART_ACCENT = '#3E9BC1';

function escapeXml(s){
  return String(s).replace(/[<>&]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
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
