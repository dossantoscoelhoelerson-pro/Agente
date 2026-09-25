// Cockpit de Evolução Digital (adendo rodada 6) -- substitui o painel de
// interpretação das rodadas 3-5 (Diagnóstico/Dimensões/Atributos/Evolução/
// Relatórios) por três seções que são três MOMENTOS METODOLÓGICOS
// diferentes da jornada, não só três páginas:
//
//   Panorama  "Onde estamos?"        -- visualizar o diagnóstico
//   Insights  "O que isso significa?" -- interpretar e explorar
//   Roadmap   "O que vamos fazer?"    -- transformar em ação
//
// Continua 100% em cima da mesma base de dados (state.panel, extraído do
// resultado oficial do DEXi via ensurePanel() em app.js -- nunca
// recalculado aqui) e da mesma identidade visual ORBE -- nenhuma
// infraestrutura nova além do necessário para Panorama+Insights (nota
// técnica do adendo, seção 0). O Roadmap é implementado como estado de
// sessão (igual a todo o resto da aplicação hoje -- nada persiste entre
// sessões); revisões de 3/6/12 meses, comparação com avaliação anterior e
// retomar este roadmap numa visita futura precisariam de um banco de dados
// + identificação de organização entre sessões -- mudança estrutural
// deliberadamente NÃO implementada nesta rodada (ver .persistence-note
// dentro de screenRoadmap(), e a conversa com o usuário).

Object.assign(state, {
  cockpitSection: 'panorama', // 'panorama' | 'insights' | 'roadmap'

  // Insights
  synthesis: null, synthesisLoading: false, synthesisError: '', // {interpretacao, possibilidades}
  insightsChat: [], insightsThinking: false, insightsError: '',
  attributeDetail: {},  // attrId -> {possibilidades, loading, error}
  selectedAttrId: null, // abre o overlay de exploração de atributo

  // Panorama
  metaLevel: null, // nível-alvo escolhido pelo usuário nesta sessão (Atual x Meta) -- nunca persistido/inventado
  exploreFilters: { grupo: '', nivel: '', busca: '' },

  // Roadmap (só em memória da sessão -- ver nota no topo do arquivo)
  roadmapItems: [],
  roadmapSuggestions: [],
  roadmapGenerating: false,
  roadmapGenerateError: '',
  roadmapNewActionOpen: false,
  roadmapOpenActionId: null,
  roadmapActionChats: {},
  roadmapActionThinking: {},
  roadmapActionErrors: {},
});

let roadmapIdSeq = 1;

// Chamado por screenUpload() (app.js) sempre que uma nova avaliação é
// carregada -- garante que nada de uma organização anterior vaze para a
// próxima sessão de Cockpit.
function resetCockpitState(){
  state.cockpitSection = 'panorama';
  state.synthesis = null; state.synthesisLoading = false; state.synthesisError = '';
  state.insightsChat = []; state.insightsThinking = false; state.insightsError = '';
  state.attributeDetail = {}; state.selectedAttrId = null;
  state.metaLevel = null;
  state.exploreFilters = { grupo: '', nivel: '', busca: '' };
  state.roadmapItems = []; state.roadmapSuggestions = [];
  state.roadmapGenerating = false; state.roadmapGenerateError = '';
  state.roadmapNewActionOpen = false; state.roadmapOpenActionId = null;
  state.roadmapActionChats = {}; state.roadmapActionThinking = {}; state.roadmapActionErrors = {};
}

// Disparado por ensurePanel() (app.js) assim que o resultado oficial do
// DEXi é extraído com sucesso -- a síntese de Insights carrega em segundo
// plano, pronta quando o usuário chegar lá, sem ele precisar esperar.
function onPanelReady(){
  ensureSynthesis();
}

// Usado por downloadPanelPdf() (app.js) -- o PDF reaproveita a seção
// "Centro de aprendizado" já existente no documento para mostrar as ações
// do Roadmap (rodada 6 substitui o conceito por ações, não mais temas de
// estudo) -- nenhuma mudança necessária em server/exportPdf.js.
function pdfTemasFromRoadmap(){
  return state.roadmapItems.map((a) => ({ tema: a.titulo, porque: a.objetivo, pontoLabel: a.origemLabel }));
}

function attrById(id){ return ATTRS.find((a) => a.id === id); }

// ---------- tooltip flutuante compartilhado (heatmap + sunburst) ----------

function ensureVizTooltipEl(){
  let t = document.getElementById('vizTooltip');
  if(!t){
    t = document.createElement('div');
    t.id = 'vizTooltip';
    t.className = 'viz-tooltip';
    document.body.appendChild(t);
  }
  return t;
}
function showVizTooltip(ev, html){
  const t = ensureVizTooltipEl();
  t.innerHTML = html;
  t.classList.add('visible');
  moveVizTooltip(ev);
}
function moveVizTooltip(ev){
  const t = ensureVizTooltipEl();
  t.style.left = (ev.clientX + 16) + 'px';
  t.style.top = (ev.clientY + 16) + 'px';
}
function hideVizTooltip(){
  ensureVizTooltipEl().classList.remove('visible');
}

// ---------- navegação persistente ----------

// Troca de seção centralizada -- sempre fecha qualquer overlay aberto
// (exploração de atributo/ação), senão ele continua no DOM sobre a seção
// nova, bloqueando cliques nela (bug real, pego ao testar "+ Adicionar ao
// Roadmap" dentro do overlay de atributo).
function goToSection(id){
  state.cockpitSection = id;
  state.selectedAttrId = null;
  state.roadmapOpenActionId = null;
  render();
}

function cockpitNav(){
  const items = [
    { id: 'panorama', step: 1, label: 'Panorama', sub: 'Onde estamos?' },
    { id: 'insights', step: 2, label: 'Insights', sub: 'O que significa?' },
    { id: 'roadmap', step: 3, label: 'Roadmap', sub: 'O que fazer?' },
  ];
  const nav = el('div', { class: 'cockpit-nav' });
  items.forEach((it) => {
    const active = state.cockpitSection === it.id;
    nav.appendChild(el('button', {
      class: 'cockpit-nav-item' + (active ? ' active' : ''),
      onclick: () => { goToSection(it.id); },
    }, [
      el('span', { class: 'cni-step', text: String(it.step) }),
      el('span', { text: it.label }),
      el('span', { class: 'cni-sub', text: ' · ' + it.sub }),
    ]));
  });
  nav.appendChild(el('button', { class: 'cockpit-chat-trigger', text: '💬 Converse com seu diagnóstico', onclick: () => {
    goToSection('insights');
    setTimeout(() => { const inputEl = document.getElementById('insightsChatInput'); if(inputEl) inputEl.focus(); }, 30);
  } }));
  return nav;
}

// ---------- roteador da tela (chamado por app.js/render()) ----------

function screenReport(){
  const c = el('div', { class: 'cockpit' });
  c.appendChild(cockpitNav());

  if(state.panelError){
    c.appendChild(el('div', { class: 'error-box', text: state.panelError }));
    c.appendChild(el('button', { class: 'btn secondary small', text: 'Tentar novamente', style: 'margin:10px 0 24px;', onclick: () => { state.panelError = ''; ensurePanel(); } }));
  }
  if(state.panel && !state.panel.consistencia.completo){
    const parts = [];
    if(state.panel.consistencia.atributosFaltando.length) parts.push('sem resposta na coleta: ' + state.panel.consistencia.atributosFaltando.join(', '));
    if(state.panel.consistencia.atributosInvalidos.length) parts.push('valor fora das 4 alternativas oficiais: ' + state.panel.consistencia.atributosInvalidos.join(', '));
    c.appendChild(el('div', { class: 'error-box', text: 'Divergência de consistência encontrada — ' + parts.join(' · ') }));
  }

  if(state.panelLoading && !state.panel){
    c.appendChild(el('div', { class: 'cockpit-card', style: 'text-align:center; padding:70px 20px;' }, [
      el('span', { class: 'spinner' }), el('span', { text: ' Analisando o resultado do DEXi...', style: 'margin-left:10px; color:var(--ink-soft);' }),
    ]));
  } else if(state.cockpitSection === 'insights'){
    c.appendChild(screenInsights());
  } else if(state.cockpitSection === 'roadmap'){
    c.appendChild(screenRoadmap());
  } else {
    c.appendChild(screenPanorama());
  }

  if(state.selectedAttrId){
    c.appendChild(attributeDetailOverlay());
  }
  if(state.roadmapOpenActionId){
    c.appendChild(actionDetailOverlay());
  }

  if(!state.panel && !state.panelLoading && !state.panelError){
    // mesmo padrão de reentrância do resto do projeto (ver comentário em
    // ensurePanel, app.js) -- setTimeout evita duplicar o DOM.
    setTimeout(ensurePanel, 0);
  }
  return c;
}

// ==========================================================================
// PANORAMA -- "Onde estamos?"
// ==========================================================================

function screenPanorama(){
  const c = el('div');

  // 1. Estado da organização -- abertura, sem tabela, resultado como
  // elemento dominante. Contexto da organização mostrado literalmente como
  // foi escrito na coleta (nunca decomposto em setor/porte/local por IA --
  // isso arriscaria inventar um dado que o texto livre não garante).
  const hero = el('div', { class: 'cockpit-hero' });
  hero.appendChild(el('div', { class: 'cockpit-hero-eyebrow', text: state.orgName }));
  hero.appendChild(el('h1', { class: 'cockpit-hero-title', text: 'Diagnóstico de Maturidade Digital' }));
  if(state.orgContext){
    hero.appendChild(el('p', { class: 'cockpit-hero-sub', text: state.orgContext }));
  }
  hero.appendChild(el('div', { class: 'cockpit-hero-meta' }, [
    el('span', {}, [document.createTextNode('Avaliado em '), el('b', { text: formatToday() })]),
    el('span', {}, [el('b', { text: '34' }), document.createTextNode(' atributos')]),
    el('span', {}, [el('b', { text: '2' }), document.createTextNode(' capacidades')]),
    el('span', {}, [el('b', { text: '17' }), document.createTextNode(' atributos agregados')]),
  ]));
  const heroActions = el('div', { class: 'cockpit-hero-actions' });
  heroActions.appendChild(el('button', { class: 'btn secondary small', text: state.pdfExporting ? 'Gerando PDF…' : '📄 Relatório DEXi', disabled: state.pdfExporting, onclick: downloadPanelPdf }));
  heroActions.appendChild(el('button', { class: 'btn secondary small', text: '💬 Conversar com a IA', onclick: () => { goToSection('insights'); } }));
  heroActions.appendChild(el('button', { class: 'btn secondary small', text: 'Nova avaliação', onclick: startNewEvaluation }));
  hero.appendChild(heroActions);
  if(state.pdfExportError){
    hero.appendChild(el('div', { class: 'error-box', style: 'margin-top:12px;', text: state.pdfExportError }));
  }
  c.appendChild(hero);

  // Estado geral -> Perfil -> Estrutura -> Leitura geral -> Árvore de
  // atributos -> Capacidades -> Explorar -> Zoom no diagnóstico -> Insights.
  // 2. Resultado + perfil geral (duas faixas qualitativas), num único
  // cartão coeso.
  c.appendChild(sectionOverview());

  // 3. Estrutura do diagnóstico (sunburst) -- "como o resultado é formado?"
  c.appendChild(sectionSunburst());

  // 4. Leitura geral -- o que já está estruturado / espaços de evolução /
  // pontos de atenção, com contagens reais.
  c.appendChild(sectionLeituraGeral());

  // 5. Árvore de atributos.
  c.appendChild(sectionAttributeTree());

  // 6. Capacidades -- grupos de cada dimensão como barras qualitativas.
  c.appendChild(sectionCapacidadesBars());

  // 7. Explore seu diagnóstico -- tabela navegável.
  c.appendChild(sectionExplorar());

  // 8. Zoom no diagnóstico (heatmap) -- "selecione um atributo para
  // entender como ele aparece no resultado."
  c.appendChild(sectionHeatmap());

  // 1.9 Transição para Insights.
  const bridge = el('div', { class: 'cockpit-bridge' });
  bridge.appendChild(el('div', { class: 'cockpit-bridge-title', text: 'Quer entender o que está por trás desses resultados?' }));
  const bridgeActions = el('div', { class: 'cockpit-bridge-actions' });
  bridgeActions.appendChild(el('button', { class: 'btn', text: 'Explorar Insights →', onclick: () => { goToSection('insights'); } }));
  bridgeActions.appendChild(el('button', { class: 'btn secondary', text: 'Conversar com a IA', onclick: () => { goToSection('insights'); setTimeout(() => { const i = document.getElementById('insightsChatInput'); if(i) i.focus(); }, 30); } }));
  bridge.appendChild(bridgeActions);
  c.appendChild(bridge);

  return c;
}

// Reinicia a sessão inteira -- coleta, resultado do DEXi e todo o estado do
// Cockpit -- para começar uma nova avaliação sem recarregar a página.
function startNewEvaluation(){
  state.screen = 'intro'; state.idx = 0; state.answers = {}; state.registro = {}; state.chatLogs = {};
  state.explanations = {}; state.explainErrors = {};
  state.orgName = ''; state.orgContext = ''; state.dexiText = ''; state.collectionSourceLoaded = false;
  state.panel = null; state.panelError = '';
  resetCockpitState();
  render();
}

function formatToday(){
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Seção consolidada única (adendo rodada 7, seção 3): resultado geral + as
// duas capacidades, tudo num único cartão coeso em vez de 2-3 cartões
// grandes empilhados -- é a mudança que reduz a "sensação de dispersão"
// diagnosticada pelo pesquisador. Contém o resultado oficial (indicador
// circular + escala) e, logo abaixo, o mapa das capacidades e os dois
// radares lado a lado (item 2 do adendo -- Capacidade Digital e Capacidade
// Organizacional separadas, nunca mais misturadas num único radar de 7
// grupos).
function sectionOverview(){
  const card = el('div', { class: 'cockpit-card cockpit-overview' });

  const nivelLabel = state.panel && state.panel.nivelFinalLabel;
  const idx = (DEXI_MODEL && state.panel && state.panel.nivelFinal) ? DEXI_MODEL.root.niveis.indexOf(state.panel.nivelFinal) : null;

  const row = el('div', { class: 'cockpit-result-row' });
  const gaugeBox = el('div', { class: 'status-gauge' });
  row.appendChild(gaugeBox);
  const textBox = el('div', { style: 'flex:1; min-width:220px;' });
  textBox.appendChild(el('div', { class: 'block-label', text: 'Maturidade Digital' }));
  textBox.appendChild(el('div', { class: 'cockpit-result-title', text: nivelLabel || 'Não identificado no texto carregado' }));
  if(DEXI_MODEL){
    const track = el('div', { class: 'scale-track' });
    DEXI_MODEL.root.niveisExibicao.forEach((lbl, i) => {
      track.appendChild(el('div', { class: 'scale-seg' + (i === idx ? ' scale-seg-active' : ''), text: lbl }));
    });
    textBox.appendChild(track);
  }
  textBox.appendChild(el('button', { class: 'cockpit-result-link', text: 'Como chegamos aqui? →', style: 'margin-top:14px;', onclick: () => { goToSection('insights'); } }));
  row.appendChild(textBox);
  card.appendChild(row);
  if(DEXI_MODEL){
    renderLevelGauge(gaugeBox, { levelLabel: nivelLabel, idx, total: DEXI_MODEL.root.niveis.length });
  }

  card.appendChild(el('div', { class: 'cockpit-overview-divider' }));
  card.appendChild(el('div', { class: 'cockpit-card-title', text: 'Perfil geral' }));
  card.appendChild(el('div', { class: 'cockpit-section-question', text: 'Como as capacidades Digital e Organizacional se posicionam no diagnóstico?', style: 'display:block; margin-bottom:16px;' }));

  if(DEXI_MODEL){
    const dimDigital = DEXI_MODEL.dimensoes.find((d) => d.id === 'CAP.DIGITAL');
    const dimOrg = DEXI_MODEL.dimensoes.find((d) => d.id === 'CAP.ORGANIZACIONAL');
    card.appendChild(qualitativeTrack('Capacidade Digital', dimDigital, state.panel ? state.panel.capDigital : null));
    card.appendChild(qualitativeTrack('Capacidade Organizacional', dimOrg, state.panel ? state.panel.capOrganizacional : null));
  } else {
    card.appendChild(el('div', { class: 'chart-empty-note', text: 'Carregando...' }));
  }
  return card;
}

// Perfil geral (rodada 9): uma faixa qualitativa horizontal por capacidade,
// nunca um radar/eixos múltiplos nem uma escala numérica de 0-100 -- só a
// posição real dentro da própria escala de 4 níveis, mesmo padrão visual já
// usado para o resultado geral (.scale-track/.scale-seg).
function qualitativeTrack(label, dim, nivelAtual){
  const wrap = el('div', { class: 'cockpit-qual-track' });
  const idx = (dim && nivelAtual) ? dim.niveis.indexOf(nivelAtual) : null;
  const head = el('div', { class: 'cockpit-qual-track-head' });
  head.appendChild(el('div', { class: 'cockpit-qual-track-label', text: label }));
  head.appendChild(el('div', { class: 'cockpit-qual-track-level', text: (idx !== null && idx >= 0) ? dim.niveisExibicao[idx] : 'não identificado' }));
  wrap.appendChild(head);
  const track = el('div', { class: 'scale-track' });
  (dim ? dim.niveisExibicao : []).forEach((lbl, i) => {
    track.appendChild(el('div', { class: 'scale-seg' + (i === idx ? ' scale-seg-active' : ''), text: lbl }));
  });
  wrap.appendChild(track);
  return wrap;
}

// 1.4 -- heatmap D3: Capacidade -> Grupo -> Atributo. Clicar numa célula
// abre a exploração daquele atributo (overlay global, funciona a partir de
// qualquer seção -- ver attributeDetailOverlay()).
function sectionHeatmap(){
  const card = el('div', { class: 'cockpit-card on-paper' });
  const head = el('div', { class: 'cockpit-section-head' });
  head.appendChild(el('div', { class: 'cockpit-card-title', text: 'Explore os detalhes do diagnóstico', style: 'margin-bottom:0;' }));
  card.appendChild(head);
  card.appendChild(el('div', { class: 'cockpit-section-question', text: 'Selecione um atributo para entender como ele aparece no resultado.', style: 'display:block; margin-bottom:14px;' }));

  const wrap = el('div', { class: 'cockpit-heatmap-wrap' });
  card.appendChild(wrap);

  if(DEXI_MODEL){
    renderHeatmap(wrap, (attrId) => { state.selectedAttrId = attrId; render(); });
  } else {
    wrap.appendChild(el('div', { class: 'chart-empty-note', text: 'Carregando...' }));
  }

  const legend = el('div', { class: 'heatmap-legend' });
  legend.appendChild(document.createTextNode('Posição na própria escala do atributo:'));
  ['#DCEEF5', '#8FCBE0', '#3E9BC1', '#123F63'].forEach((color, i) => {
    legend.appendChild(el('span', { class: 'heatmap-legend-swatch', style: `background:${color};` }));
  });
  legend.appendChild(document.createTextNode('mais baixo → mais alto · clique numa célula para explorar'));
  card.appendChild(legend);
  return card;
}

function renderHeatmap(container, onCellClick){
  container.innerHTML = '';
  if(typeof d3 === 'undefined' || !DEXI_MODEL) return;
  const grupos = DEXI_MODEL.grupos;
  const cell = 26, gap = 5, labelW = 180, rowH = cell + 12, topPad = 26;
  const attrsByGroup = grupos.map((g) => ATTRS.filter((a) => a.grupoTop === g.id));
  const maxCols = Math.max(1, ...attrsByGroup.map((l) => l.length));
  const W = labelW + maxCols * (cell + gap);
  const H = grupos.length * rowH + topPad + 12;

  const colorScale = d3.scaleLinear().domain([0, 1, 2, 3]).range(['#DCEEF5', '#8FCBE0', '#3E9BC1', '#123F63']).interpolate(d3.interpolateRgb);

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%')
    .attr('role', 'img').attr('aria-label', 'Mapa de calor dos 34 atributos, agrupados por grupo e capacidade');

  let lastDim = null;
  grupos.forEach((g, gi) => {
    const y = gi * rowH + topPad;
    if(g.dimensaoId !== lastDim){
      lastDim = g.dimensaoId;
      const dim = DEXI_MODEL.dimensoes.find((d) => d.id === g.dimensaoId);
      svg.append('text').attr('x', 0).attr('y', y - 10).attr('class', 'heatmap-group-label').text(dim ? dim.label : '');
    }
    svg.append('text').attr('x', 0).attr('y', y + cell * 0.68).attr('class', 'heatmap-row-label').text(g.label);
    attrsByGroup[gi].forEach((a, ai) => {
      const val = state.answers[a.id];
      const idx = val ? a.niveis.indexOf(val) : null;
      const x = labelW + ai * (cell + gap);
      svg.append('rect')
        .attr('class', 'heatmap-cell')
        .attr('x', x).attr('y', y).attr('width', cell).attr('height', cell).attr('rx', 6)
        .attr('fill', idx === null ? '#E7E3DA' : colorScale(idx))
        .on('mouseenter', (ev) => showVizTooltip(ev, `<b>${escapeXml(humanizeAttrId(a.id))}</b>${idx !== null ? escapeXml(a.niveisExibicao[idx]) : 'sem resposta'}`))
        .on('mousemove', moveVizTooltip)
        .on('mouseleave', hideVizTooltip)
        .on('click', () => onCellClick(a.id));
    });
  });
}

// 1.5 -- sunburst D3 com drill-down: Maturidade Digital -> Capacidade ->
// Grupo -> Atributo, hierarquia real (nunca inventada).
function sectionSunburst(){
  const card = el('div', { class: 'cockpit-card on-paper' });
  card.appendChild(el('div', { class: 'cockpit-card-title', text: 'Estrutura do diagnóstico' }));
  const wrap = el('div', { class: 'sunburst-wrap' });
  card.appendChild(wrap);
  if(DEXI_MODEL){
    renderSunburst(wrap, (attrId) => { state.selectedAttrId = attrId; render(); });
  } else {
    wrap.appendChild(el('div', { class: 'chart-empty-note', text: 'Carregando...' }));
  }
  return card;
}

// Fonte única da hierarquia real do diagnóstico (Maturidade Digital ->
// Capacidade -> Grupo -> Atributo), usada pelo sunburst e pelas duas árvores
// (adendo rodada 7) -- cada nó carrega `idx` (posição 0-3 na própria escala
// de 4 níveis, ou null se não identificado), usado para a coloração
// vermelho->verde das árvores; o sunburst ignora `idx` e continua colorindo
// por capacidade, como já era.
function buildDiagnosisTreeData(){
  return {
    id: 'ROOT', label: 'Maturidade Digital',
    idx: (DEXI_MODEL && state.panel && state.panel.nivelFinal) ? DEXI_MODEL.root.niveis.indexOf(state.panel.nivelFinal) : null,
    levelLabel: state.panel ? state.panel.nivelFinalLabel : null,
    children: DEXI_MODEL.dimensoes.map((dim) => {
      const nivel = dim.id === 'CAP.DIGITAL' ? (state.panel && state.panel.capDigital) : (state.panel && state.panel.capOrganizacional);
      const dimLevel = dim.id === 'CAP.DIGITAL' ? (state.panel && state.panel.capDigitalLabel) : (state.panel && state.panel.capOrganizacionalLabel);
      const gruposOfDim = DEXI_MODEL.grupos.filter((g) => g.dimensaoId === dim.id);
      return {
        id: dim.id, label: dim.label, idx: nivel ? dim.niveis.indexOf(nivel) : null, levelLabel: dimLevel || null,
        children: gruposOfDim.map((g) => {
          const found = state.panel ? state.panel.grupos.find((pg) => pg.id === g.id) : null;
          return {
            id: g.id, label: g.label, idx: found ? g.niveis.indexOf(found.nivel) : null, levelLabel: found ? found.nivelLabel : null,
            children: ATTRS.filter((a) => a.grupoTop === g.id).map((a) => {
              const val = state.answers[a.id];
              const idx = val ? a.niveis.indexOf(val) : null;
              return { id: a.id, label: humanizeAttrId(a.id), idx, levelLabel: idx !== null ? a.niveisExibicao[idx] : null, isAttr: true };
            }),
          };
        }),
      };
    }),
  };
}

function renderSunburst(container, onLeafClick){
  container.innerHTML = '';
  if(typeof d3 === 'undefined') return;
  const data = buildDiagnosisTreeData();
  const root = d3.hierarchy(data).sum((d) => (d.children ? 0 : 1));
  const size = 440, radius = size / 2 - 6;
  d3.partition().size([2 * Math.PI, radius])(root);

  const color = d3.scaleOrdinal().domain(['CAP.DIGITAL', 'CAP.ORGANIZACIONAL']).range(['#3E9BC1', '#123F63']);

  const arcGen = d3.arc()
    .startAngle((d) => d.x0).endAngle((d) => d.x1)
    .padAngle(0.004).padRadius(radius / 2)
    .innerRadius((d) => d.y0).outerRadius((d) => Math.max(d.y0, d.y1 - 1));

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`)
    .attr('width', Math.min(size, 440)).attr('height', Math.min(size, 440))
    .attr('role', 'img').attr('aria-label', 'Estrutura hierárquica do diagnóstico');

  svg.selectAll('path')
    .data(root.descendants().filter((d) => d.depth > 0))
    .join('path')
    .attr('class', 'sunburst-path')
    .attr('d', arcGen)
    .attr('fill', (d) => {
      let n = d; while(n.depth > 1) n = n.parent;
      return color(n.data.id);
    })
    .attr('fill-opacity', (d) => 1 - (d.depth - 1) * 0.22)
    .on('mouseenter', (ev, d) => showVizTooltip(ev, `<b>${escapeXml(d.data.label)}</b>${d.data.levelLabel ? escapeXml(d.data.levelLabel) : 'não identificado'}`))
    .on('mousemove', moveVizTooltip)
    .on('mouseleave', hideVizTooltip)
    .on('click', (ev, d) => { if(d.data.isAttr) onLeafClick(d.data.id); });

  svg.append('text').attr('class', 'sunburst-center-label').attr('y', -4).text(state.panel && state.panel.nivelFinalLabel || 'Maturidade Digital');
  svg.append('text').attr('class', 'sunburst-center-sub').attr('y', 13).text('resultado oficial');
}

// Gradiente vermelho -> amarelo -> verde por nível real (0-3), usado só
// pelas duas árvores abaixo (adendo rodada 7, seção 1: "exceção pontual e
// funcional" à paleta de marca -- sinaliza nível qualitativo, nunca
// substitui a paleta no resto da interface). Reaproveita os próprios tons
// oficiais (--red/--yellow/--green) como paradas do gradiente, em vez de
// inventar cores novas -- cinza neutro (--line) para "sem dado".
const TREE_COLOR_STOPS = ['#D96F72', '#F7C84B', '#43B7AA'];
function treeLevelColor(idx){
  if(idx === null || idx === undefined) return '#D9E1E8';
  return d3.scaleLinear().domain([0, 1.5, 3]).range(TREE_COLOR_STOPS).interpolate(d3.interpolateRgb)(idx);
}

// 1 -- árvore de atributos: dendrograma horizontal da hierarquia real
// (Maturidade Digital -> Capacidade -> Grupo -> Atributo), nós coloridos
// pelo gradiente acima. 4 -- árvore de oportunidades: MESMA estrutura e
// MESMOS dados, só a apresentação visual muda (emphasizeWeak=true) -- nós/
// ligações fracos (nível 0-1) ficam maiores/mais saturados, nós fortes
// ficam discretos -- nunca uma priorização calculada à parte, só ênfase
// visual sobre o nível real já mostrado na árvore de atributos.
function renderDiagnosisTree(container, { onLeafClick, emphasizeWeak }){
  container.innerHTML = '';
  if(typeof d3 === 'undefined' || !DEXI_MODEL) return;
  const data = buildDiagnosisTreeData();
  const root = d3.hierarchy(data);
  const leafCount = root.leaves().length;
  const nodeH = 16;
  const height = Math.max(340, leafCount * nodeH);
  const width = 820;
  const marginLeft = 150, labelRoom = 150;
  d3.tree().size([height - 20, width - marginLeft - labelRoom])(root);

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%')
    .attr('role', 'img').attr('aria-label', emphasizeWeak ? 'Árvore de oportunidades' : 'Árvore de atributos');
  const g = svg.append('g').attr('transform', `translate(${marginLeft},10)`);

  const isWeak = (d) => d.idx !== null && d.idx !== undefined && d.idx <= 1;

  g.selectAll('path.tree-link')
    .data(root.links())
    .join('path')
    .attr('class', 'tree-link')
    .attr('d', d3.linkHorizontal().x((d) => d.y).y((d) => d.x))
    .attr('fill', 'none')
    .attr('stroke', (d) => treeLevelColor(d.target.data.idx))
    .attr('stroke-opacity', (d) => (emphasizeWeak ? (isWeak(d.target.data) ? 0.9 : 0.12) : 0.55))
    .attr('stroke-width', (d) => (emphasizeWeak && isWeak(d.target.data) ? 2.4 : 1.2));

  const node = g.selectAll('g.tree-node')
    .data(root.descendants())
    .join('g')
    .attr('class', 'tree-node')
    .attr('transform', (d) => `translate(${d.y},${d.x})`)
    .style('cursor', (d) => (d.data.isAttr ? 'pointer' : 'default'))
    .on('mouseenter', (ev, d) => showVizTooltip(ev, `<b>${escapeXml(d.data.label)}</b>${d.data.levelLabel ? escapeXml(d.data.levelLabel) : 'não identificado'}`))
    .on('mousemove', moveVizTooltip)
    .on('mouseleave', hideVizTooltip)
    .on('click', (ev, d) => { if(d.data.isAttr) onLeafClick(d.data.id); });

  node.append('circle')
    .attr('r', (d) => {
      if(!emphasizeWeak) return d.children ? 5 : 4;
      if(d.children) return 5;
      return isWeak(d.data) ? 6.5 : 3;
    })
    .attr('fill', (d) => treeLevelColor(d.data.idx))
    .attr('opacity', (d) => (emphasizeWeak && !d.children && !isWeak(d.data) ? 0.3 : 1));

  node.filter((d) => !d.children).append('text')
    .attr('class', 'tree-leaf-label')
    .attr('x', 9).attr('dy', '0.32em')
    .attr('opacity', (d) => (emphasizeWeak && !isWeak(d.data) ? 0.4 : 1))
    .text((d) => d.data.label);

  node.filter((d) => d.children).append('text')
    .attr('class', 'tree-branch-label')
    .attr('x', -9).attr('text-anchor', 'end').attr('dy', '0.32em')
    .text((d) => d.data.label);
}

// Partição honesta e real dos 34 atributos pela posição na PRÓPRIA escala
// (mesma leitura já usada em pontosDestaqueLists()) em três grupos que
// somam exatamente 34 -- nunca uma classificação adicional inventada pela
// IA: nível mais alto = "já estruturado", nível mais baixo = "atenção", os
// dois níveis do meio = "espaço de evolução" (já tem alguma base, ainda não
// chegou ao topo da própria escala).
function attributeLevelBuckets(){
  const fortes = [], atencao = [], meio = [];
  ATTRS.forEach((a) => {
    const val = state.answers[a.id];
    if(!val) return;
    const idx = a.niveis.indexOf(val);
    if(idx === a.niveis.length - 1) fortes.push(a);
    else if(idx === 0) atencao.push(a);
    else meio.push(a);
  });
  return { fortes, atencao, meio };
}

// 4 -- Leitura geral: três blocos de leitura rápida, com contagens reais
// (nunca um texto interpretativo da IA aqui -- essa camada é do Insights).
function sectionLeituraGeral(){
  const card = el('div', { class: 'cockpit-card on-paper' });
  card.appendChild(el('div', { class: 'cockpit-card-title', text: 'Leitura geral' }));
  const { fortes, meio, atencao } = attributeLevelBuckets();

  const grid = el('div', { class: 'cockpit-leitura-grid' });
  const col = (icon, title, items, cls, actionLabel, onAction) => el('div', { class: 'cockpit-leitura-col ' + cls }, [
    el('div', { class: 'cockpit-leitura-icon', text: icon }),
    el('div', { class: 'cockpit-leitura-title', text: title }),
    el('div', { class: 'cockpit-leitura-count', text: `${items.length} ${items.length === 1 ? 'ponto' : 'pontos'}` }),
    el('button', { class: 'btn secondary small', text: actionLabel, style: 'margin-top:12px;', onclick: onAction }),
  ]);
  const scrollToTree = () => { const t = document.getElementById('cockpitAttrTree'); if(t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  grid.appendChild(col('✓', 'O que já está estruturado', fortes, 'forte', 'Ver detalhes', scrollToTree));
  grid.appendChild(col('◐', 'Espaços de evolução', meio, 'meio', 'Entender', scrollToTree));
  grid.appendChild(col('!', 'Pontos de atenção', atencao, 'atencao', 'Explorar nos Insights', () => goToSection('insights')));
  card.appendChild(grid);
  card.appendChild(el('div', { class: 'note', style: 'margin-top:14px;', text: 'Contagens reais, a partir da posição de cada atributo dentro da própria escala de 4 níveis -- nunca uma classificação adicional calculada pela IA.' }));
  return card;
}

function sectionAttributeTree(){
  const card = el('div', { class: 'cockpit-card on-paper', id: 'cockpitAttrTree' });
  card.appendChild(el('div', { class: 'cockpit-card-title', text: 'Árvore de atributos' }));
  card.appendChild(el('div', { class: 'cockpit-section-question', text: 'Como os 34 atributos se distribuem, do nível mais baixo (vermelho) ao mais alto (verde)?', style: 'display:block; margin-bottom:10px;' }));
  const wrap = el('div', { class: 'cockpit-tree-wrap' });
  card.appendChild(wrap);
  if(DEXI_MODEL){
    renderDiagnosisTree(wrap, { onLeafClick: (attrId) => { state.selectedAttrId = attrId; render(); }, emphasizeWeak: false });
  } else {
    wrap.appendChild(el('div', { class: 'chart-empty-note', text: 'Carregando...' }));
  }
  return card;
}

// 6 -- Capacidades: os grupos de cada dimensão como barras qualitativas
// horizontais (rodada 9 -- substitui os dois radares da rodada 7: menos
// eixos, mais legível, e evita a leitura de "avaliação de 0 a 100" que um
// radar preenchido sugere). O comprimento da barra é só um recurso visual
// de comparação entre categorias -- nunca uma pontuação numérica inventada.
function qualitativeBar(label, idx, totalNiveis, levelLabel){
  const row = el('div', { class: 'qual-bar-row' });
  row.appendChild(el('div', { class: 'qual-bar-label', text: label }));
  const track = el('div', { class: 'qual-bar-track' });
  const frac = (idx !== null && idx !== undefined && idx >= 0) ? (idx + 1) / totalNiveis : 0;
  track.appendChild(el('div', { class: 'qual-bar-fill', style: `width:${Math.round(frac * 100)}%` }));
  row.appendChild(track);
  row.appendChild(el('div', { class: 'qual-bar-level', text: levelLabel || 'não identificado' }));
  return row;
}

function sectionCapacidadesBars(){
  const card = el('div', { class: 'cockpit-card on-paper' });
  card.appendChild(el('div', { class: 'cockpit-card-title', text: 'Capacidades' }));
  card.appendChild(el('div', { class: 'cockpit-section-question', text: 'Como a organização se posiciona nos grupos que formam cada capacidade?', style: 'display:block; margin-bottom:16px;' }));

  const grid = el('div', { class: 'cockpit-bars-grid' });
  const digCol = el('div', { class: 'cockpit-bars-col' });
  digCol.appendChild(el('div', { class: 'cockpit-caps-col-title', text: 'Capacidade Digital' }));
  const orgCol = el('div', { class: 'cockpit-bars-col' });
  orgCol.appendChild(el('div', { class: 'cockpit-caps-col-title', text: 'Capacidade Organizacional' }));

  if(DEXI_MODEL){
    DEXI_MODEL.grupos.filter((g) => g.dimensaoId === 'CAP.DIGITAL').forEach((g) => {
      const found = state.panel ? state.panel.grupos.find((pg) => pg.id === g.id) : null;
      digCol.appendChild(qualitativeBar(g.label, found ? g.niveis.indexOf(found.nivel) : null, g.niveis.length, found ? found.nivelLabel : null));
    });
    DEXI_MODEL.grupos.filter((g) => g.dimensaoId === 'CAP.ORGANIZACIONAL').forEach((g) => {
      const found = state.panel ? state.panel.grupos.find((pg) => pg.id === g.id) : null;
      orgCol.appendChild(qualitativeBar(g.label, found ? g.niveis.indexOf(found.nivel) : null, g.niveis.length, found ? found.nivelLabel : null));
    });
  }
  grid.appendChild(digCol);
  grid.appendChild(orgCol);
  card.appendChild(grid);
  return card;
}

function sectionOpportunityTree(){
  const card = el('div', { class: 'cockpit-card on-paper' });
  card.appendChild(el('div', { class: 'cockpit-card-title', text: 'Árvore de oportunidades' }));
  card.appendChild(el('div', { class: 'cockpit-section-question', text: 'Onde vale focar primeiro? Os pontos em destaque são os de nível mais baixo no resultado real.', style: 'display:block; margin-bottom:10px;' }));
  const wrap = el('div', { class: 'cockpit-tree-wrap' });
  card.appendChild(wrap);
  if(DEXI_MODEL){
    renderDiagnosisTree(wrap, { onLeafClick: (attrId) => { state.selectedAttrId = attrId; render(); }, emphasizeWeak: true });
  } else {
    wrap.appendChild(el('div', { class: 'chart-empty-note', text: 'Carregando...' }));
  }
  return card;
}

// 1.6 -- Atual x Meta: adaptação honesta do "Atual x Referência" do
// adendo. O adendo pede referência REAL (meta definida pela organização ou
// avaliação anterior) -- como não há persistência entre sessões, uma
// avaliação anterior nunca existe aqui; uma META, porém, pode ser definida
// pela própria organização NESTA sessão (escolha explícita do usuário, não
// inventada pela IA nem calculada) -- por isso a seção existe, mas nunca
// pré-seleciona um valor. 1.7 (Evolução histórica) exigiria uma avaliação
// anterior real e por isso não tem equivalente possível sem persistência --
// omitida, não simulada (ver persistence-note no Roadmap).
function sectionMeta(){
  const card = el('div', { class: 'cockpit-card on-paper' });
  card.appendChild(el('div', { class: 'cockpit-card-title', text: 'Atual × Meta' }));
  card.appendChild(el('div', { class: 'cockpit-section-question', text: 'Que nível a organização gostaria de alcançar? (escolha desta sessão, não um cálculo)', style: 'display:block; margin-bottom:8px;' }));

  if(!DEXI_MODEL){ card.appendChild(el('div', { class: 'chart-empty-note', text: 'Carregando...' })); return card; }

  const picker = el('div', { class: 'meta-picker' });
  const select = el('select', { onchange: (e) => { state.metaLevel = e.target.value || null; render(); } });
  select.appendChild(el('option', { value: '', text: '— sem meta definida —' }));
  DEXI_MODEL.root.niveis.forEach((lvl, i) => {
    select.appendChild(el('option', { value: lvl, selected: state.metaLevel === lvl, text: DEXI_MODEL.root.niveisExibicao[i] }));
  });
  picker.appendChild(select);
  card.appendChild(picker);

  if(state.metaLevel){
    const idxAtual = state.panel && state.panel.nivelFinal ? DEXI_MODEL.root.niveis.indexOf(state.panel.nivelFinal) : null;
    const idxMeta = DEXI_MODEL.root.niveis.indexOf(state.metaLevel);
    const compare = el('div', { class: 'meta-compare' });
    compare.appendChild(el('div', { class: 'meta-compare-item' }, [
      el('div', { class: 'meta-compare-label', text: 'Atual' }),
      el('div', { class: 'meta-compare-value', text: (state.panel && state.panel.nivelFinalLabel) || 'não identificado' }),
    ]));
    compare.appendChild(el('div', { class: 'meta-compare-arrow', text: '→' }));
    compare.appendChild(el('div', { class: 'meta-compare-item' }, [
      el('div', { class: 'meta-compare-label', text: 'Meta' }),
      el('div', { class: 'meta-compare-value', text: DEXI_MODEL.root.niveisExibicao[idxMeta] }),
    ]));
    card.appendChild(compare);
    if(idxAtual !== null && idxMeta <= idxAtual){
      card.appendChild(el('div', { class: 'note', style: 'margin-top:14px;', text: 'A meta escolhida já foi alcançada ou está abaixo do nível atual.' }));
    }
  }
  return card;
}

// 1.8 -- exploração com filtros (grupo/nível) e busca por texto.
function sectionExplorar(){
  const card = el('div', { class: 'cockpit-card on-paper' });
  card.appendChild(el('div', { class: 'cockpit-card-title', text: 'Explore seu diagnóstico' }));

  const filters = el('div', { class: 'explore-filters' });
  const grupoSelect = el('select', { onchange: (e) => { state.exploreFilters.grupo = e.target.value; render(); } });
  grupoSelect.appendChild(el('option', { value: '', text: 'Todos os grupos' }));
  if(DEXI_MODEL){
    DEXI_MODEL.grupos.forEach((g) => grupoSelect.appendChild(el('option', { value: g.id, selected: state.exploreFilters.grupo === g.id, text: g.label })));
  }
  filters.appendChild(grupoSelect);

  const nivelSelect = el('select', { onchange: (e) => { state.exploreFilters.nivel = e.target.value; render(); } });
  nivelSelect.appendChild(el('option', { value: '', text: 'Todos os níveis' }));
  ['0', '1', '2', '3'].forEach((v, i) => {
    nivelSelect.appendChild(el('option', { value: v, selected: state.exploreFilters.nivel === v, text: ['Mais baixo da própria escala', 'Médio-baixo', 'Médio-alto', 'Mais alto da própria escala'][i] }));
  });
  filters.appendChild(nivelSelect);

  const search = el('input', { type: 'text', placeholder: 'Buscar um atributo...', value: state.exploreFilters.busca });
  search.addEventListener('input', (e) => { state.exploreFilters.busca = e.target.value; render(); });
  filters.appendChild(search);
  card.appendChild(filters);

  const busca = state.exploreFilters.busca.trim().toLowerCase();
  const matched = ATTRS.filter((a) => {
    if(state.exploreFilters.grupo && a.grupoTop !== state.exploreFilters.grupo) return false;
    if(state.exploreFilters.nivel !== ''){
      const val = state.answers[a.id];
      const idx = val ? a.niveis.indexOf(val) : -1;
      if(String(idx) !== state.exploreFilters.nivel) return false;
    }
    if(busca && !humanizeAttrId(a.id).toLowerCase().includes(busca)) return false;
    return true;
  });

  if(!matched.length){
    card.appendChild(el('div', { class: 'explore-empty', text: 'Nenhum atributo encontrado com esses filtros.' }));
    return card;
  }

  // Tabela navegável (rodada 9) -- Capacidade / Grupo / Atributo / Nível,
  // em vez de uma matriz de cards; clicar numa linha abre a mesma
  // exploração de atributo (overlay global).
  const tableWrap = el('div', { class: 'explore-table-wrap' });
  const table = el('table', { class: 'explore-table' });
  const thead = el('thead');
  thead.appendChild(el('tr', {}, ['Capacidade', 'Grupo', 'Atributo', 'Nível'].map((h) => el('th', { text: h }))));
  table.appendChild(thead);
  const tbody = el('tbody');
  matched.slice(0, 60).forEach((a) => {
    const grupo = DEXI_MODEL ? DEXI_MODEL.grupos.find((g) => g.id === a.grupoTop) : null;
    const val = state.answers[a.id];
    const idx = val ? a.niveis.indexOf(val) : -1;
    const label = idx >= 0 && a.niveisExibicao ? a.niveisExibicao[idx] : 'não respondido';
    tbody.appendChild(el('tr', { onclick: () => { state.selectedAttrId = a.id; render(); } }, [
      el('td', { text: a.dimensao }),
      el('td', { text: grupo ? grupo.label : '—' }),
      el('td', { class: 'explore-table-attr', text: humanizeAttrId(a.id) }),
      el('td', { class: 'explore-table-level', text: label }),
    ]));
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  card.appendChild(tableWrap);
  if(matched.length > 60){
    card.appendChild(el('div', { class: 'note', style: 'margin-top:10px;', text: `Mostrando 60 de ${matched.length} resultados -- refine os filtros ou a busca para ver os demais.` }));
  }
  return card;
}

// ==========================================================================
// INSIGHTS -- "O que isso significa?"
// ==========================================================================

async function ensureSynthesis(){
  if(state.synthesis || state.synthesisLoading || !state.panel) return;
  state.synthesisLoading = true;
  state.synthesisError = '';
  render();
  const { fortes, atencao } = pontosDestaqueLists();
  try{
    const res = await fetch('/api/insights/synthesis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: state.orgName, orgContext: state.orgContext,
        nivelFinalLabel: state.panel.nivelFinalLabel, capDigitalLabel: state.panel.capDigitalLabel, capOrganizacionalLabel: state.panel.capOrganizacionalLabel,
        grupos: state.panel.grupos,
        fortes: fortes.map((f) => humanizeAttrId(f.attr.id)), atencao: atencao.map((a) => humanizeAttrId(a.attr.id)),
      }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    state.synthesis = data;
    seedInsightsOpening();
  } catch(err){
    state.synthesisError = 'Não consegui gerar a síntese agora (' + err.message + ').';
  }
  state.synthesisLoading = false;
  render();
}

// A dimensão em pior posição no resultado real -- só para montar os
// próximos passos da mensagem de abertura do consultor (nomes/grupos reais,
// nunca calculados/inventados: é só um "min()" sobre o que já veio do DEXi).
function computeWeakestDimension(){
  if(!DEXI_MODEL || !state.panel) return null;
  const candidatos = DEXI_MODEL.dimensoes
    .map((d) => {
      const nivel = d.id === 'CAP.DIGITAL' ? state.panel.capDigital : state.panel.capOrganizacional;
      return { dim: d, idx: nivel ? d.niveis.indexOf(nivel) : null };
    })
    .filter((x) => x.idx !== null && x.idx >= 0);
  if(!candidatos.length) return null;
  candidatos.sort((a, b) => a.idx - b.idx);
  return candidatos[0].dim;
}

// Abertura contextual do consultor (rodada 9): assim que a síntese carrega,
// a primeira mensagem do chat já parte do resultado (reaproveita
// state.synthesis.interpretacao, já gerado e já natural -- nenhuma chamada
// nova à IA só para o texto de abertura), com caminhos concretos reais
// (grupos da dimensão mais fraca) calculados aqui, nunca inventados. Só
// preenche uma vez -- se o chat já tiver mensagens (usuário já perguntou
// algo, ou uma sessão anterior), não sobrescreve nada.
function seedInsightsOpening(){
  if(state.insightsChat.length || !state.synthesis) return;
  const weakDim = computeWeakestDimension();
  const nextSteps = [];
  if(weakDim && DEXI_MODEL){
    DEXI_MODEL.grupos.filter((g) => g.dimensaoId === weakDim.id).forEach((g) => {
      nextSteps.push({ label: g.label, question: `Como está o grupo ${g.label}?` });
    });
  }
  nextSteps.push({ label: 'Como chegamos aqui?', question: 'Como esse resultado foi formado, do geral até os atributos?' });
  state.insightsChat.push({ role: 'assistant', text: state.synthesis.interpretacao, nextSteps });
}

async function insightsTurn(userMessage){
  userMessage = (userMessage || '').trim();
  if(!userMessage || state.insightsThinking) return;
  state.insightsChat.push({ role: 'user', text: userMessage });
  const historySnapshot = state.insightsChat.slice(0, -1);
  state.insightsThinking = true;
  state.insightsError = '';
  render();
  try{
    const res = await fetch('/api/interpret/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: state.orgName, orgContext: state.orgContext, answers: state.answers,
        registroCompleto: ATTRS.map((a) => state.registro[a.id]).filter(Boolean),
        dexiText: state.dexiText, history: historySnapshot, userMessage,
      }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    state.insightsChat.push({ role: 'assistant', text: data.message, nextSteps: data.nextSteps || [] });
  } catch(err){
    state.insightsError = 'Não consegui gerar a resposta: ' + err.message;
  }
  state.insightsThinking = false;
  render();
}

function screenInsights(){
  const c = el('div');

  const hero = el('div', { class: 'cockpit-hero' });
  hero.appendChild(el('div', { class: 'cockpit-hero-eyebrow', text: 'Insights · O que isso significa?' }));
  hero.appendChild(el('h1', { class: 'cockpit-hero-title', text: 'O que o diagnóstico revela' }));
  c.appendChild(hero);
  c.appendChild(sectionSynthesis());
  c.appendChild(sectionInsightChat());
  c.appendChild(sectionTraceability());
  c.appendChild(sectionForcasAtencao());
  // Árvore de oportunidades -- migrada do Panorama para cá: "onde estão as
  // oportunidades" já é leitura interpretativa (o que significa), não
  // descritiva (o que foi encontrado).
  c.appendChild(sectionOpportunityTree());

  return c;
}

function sectionSynthesis(){
  const card = el('div', { class: 'cockpit-section' });
  const grid = el('div', { class: 'synthesis-grid' });

  const resultadoTxt = state.panel
    ? `${state.panel.nivelFinalLabel || 'não identificado'} — Capacidade Digital: ${state.panel.capDigitalLabel || 'não identificado'}; Capacidade Organizacional: ${state.panel.capOrganizacionalLabel || 'não identificado'}.`
    : 'Resultado ainda não disponível.';
  grid.appendChild(el('div', { class: 'synthesis-block resultado' }, [
    el('div', { class: 'synthesis-block-label', text: 'Resultado' }),
    el('div', { class: 'synthesis-block-text', text: resultadoTxt }),
  ]));

  const interpBlock = el('div', { class: 'synthesis-block interpretacao' });
  interpBlock.appendChild(el('div', { class: 'synthesis-block-label', text: 'Interpretação' }));
  if(state.synthesis){
    interpBlock.appendChild(el('div', { class: 'synthesis-block-text', text: state.synthesis.interpretacao }));
  } else if(state.synthesisLoading){
    interpBlock.appendChild(el('div', { class: 'synthesis-block-text' }, [el('span', { class: 'spinner' }), el('span', { text: ' pensando...', style: 'margin-left:8px;' })]));
  } else if(state.synthesisError){
    interpBlock.appendChild(el('div', { class: 'error-box', text: state.synthesisError }));
    interpBlock.appendChild(el('button', { class: 'btn secondary small', text: 'Tentar novamente', style: 'margin-top:10px;', onclick: ensureSynthesis }));
  }
  grid.appendChild(interpBlock);

  const possBlock = el('div', { class: 'synthesis-block possibilidades' });
  possBlock.appendChild(el('div', { class: 'synthesis-block-label', text: 'Possibilidades' }));
  if(state.synthesis){
    possBlock.appendChild(el('div', { class: 'synthesis-block-text', text: state.synthesis.possibilidades }));
  } else if(state.synthesisLoading){
    possBlock.appendChild(el('div', { class: 'synthesis-block-text' }, [el('span', { class: 'spinner' }), el('span', { text: ' pensando...', style: 'margin-left:8px;' })]));
  }
  grid.appendChild(possBlock);

  card.appendChild(grid);
  return card;
}

function sectionInsightChat(){
  const card = el('div', { class: 'insight-chat-card' });
  card.appendChild(el('div', { class: 'cockpit-card-title', text: 'Vamos entender esse resultado.', style: 'color:var(--green); margin-bottom:4px;' }));
  card.appendChild(el('div', { class: 'cockpit-section-question', text: 'Explore o diagnóstico com um consultor que conhece os resultados, as evidências e a estrutura da avaliação.', style: 'display:block; margin-bottom:16px;' }));

  const suggestions = ['Por que chegamos a esse resultado?', 'Quais são nossos pontos de força?', 'Onde estão nossos pontos de atenção?', 'Explique nossa Capacidade Digital.', 'Explique nossa Capacidade Organizacional.', 'O que podemos explorar a partir daqui?'];
  if(!state.insightsChat.length){
    const chips = el('div', { class: 'insight-chat-suggestions' });
    suggestions.forEach((q) => chips.appendChild(el('button', { class: 'insight-chip', text: q, onclick: () => insightsTurn(q) })));
    card.appendChild(chips);
  }

  if(state.insightsChat.length){
    const chatBox = el('div', { class: 'chat-log', style: 'margin-bottom:16px;' });
    state.insightsChat.forEach((m) => {
      chatBox.appendChild(el('div', { class: 'bubble report-body ' + (m.role === 'assistant' ? 'bubble-agent' : 'bubble-user'), text: m.text }));
      // Caminhos concretos e nomeados (rodada 8+9) -- nunca "como prefere
      // seguir?": chips reais (validados no servidor ou calculados aqui a
      // partir do dado real), clicar já envia a pergunta correspondente.
      if(m.role === 'assistant' && Array.isArray(m.nextSteps) && m.nextSteps.length && !state.insightsThinking){
        const stepsRow = el('div', { class: 'insight-next-steps' });
        m.nextSteps.forEach((s) => stepsRow.appendChild(el('button', { class: 'insight-chip', text: s.label, onclick: () => insightsTurn(s.question) })));
        chatBox.appendChild(stepsRow);
      }
    });
    card.appendChild(chatBox);
  }
  if(state.insightsThinking){
    card.appendChild(el('div', { class: 'bubble bubble-agent' }, [el('span', { class: 'spinner' }), el('span', { text: ' pensando...', style: 'margin-left:8px;' })]));
  } else {
    const inputRow = el('div', { class: 'chat-input-row' });
    const textIn = el('input', { type: 'text', placeholder: 'Pergunte algo sobre o resultado...', id: 'insightsChatInput' });
    textIn.addEventListener('keydown', (e) => { if(e.key === 'Enter' && textIn.value.trim()){ insightsTurn(textIn.value); textIn.value = ''; } });
    const sendBtn = el('button', { class: 'btn chat-send', text: 'Enviar', onclick: () => { if(textIn.value.trim()){ insightsTurn(textIn.value); textIn.value = ''; } } });
    inputRow.appendChild(textIn);
    inputRow.appendChild(sendBtn);
    card.appendChild(inputRow);
  }
  if(state.insightsError){
    card.appendChild(el('div', { class: 'error-box', text: state.insightsError }));
  }
  return card;
}

// 2.3 -- rastreabilidade: cadeia estrutural + um exemplo real e concreto
// (o grupo/atributo mais fraco, se houver) -- nunca um exemplo inventado.
function sectionTraceability(){
  const card = el('div', { class: 'cockpit-section' });
  const head = el('div', { class: 'cockpit-section-head' });
  head.appendChild(el('div', { class: 'cockpit-section-title', text: 'Por que chegamos a esse resultado?' }));
  card.appendChild(head);

  const box = el('div', { class: 'cockpit-card on-paper' });
  const grupoFraco = state.panel && state.panel.grupos.length
    ? state.panel.grupos.slice().sort((a, b) => {
        const ga = DEXI_MODEL.grupos.find((g) => g.id === a.id);
        const gb = DEXI_MODEL.grupos.find((g) => g.id === b.id);
        return ga.niveis.indexOf(a.nivel) - gb.niveis.indexOf(b.nivel);
      })[0]
    : null;
  const { atencao } = pontosDestaqueLists();
  const attrExemplo = grupoFraco ? atencao.find((it) => it.attr.grupoTop === grupoFraco.id) : null;

  const chain = el('div', { class: 'trace-chain' });
  const steps = [
    { label: 'Maturidade Digital', value: (state.panel && state.panel.nivelFinalLabel) || 'não identificado' },
    { label: 'Capacidade', value: grupoFraco ? (DEXI_MODEL.grupos.find((g) => g.id === grupoFraco.id).dimensaoId === 'CAP.DIGITAL' ? 'Capacidade Digital' : 'Capacidade Organizacional') : '—' },
    { label: 'Grupo', value: grupoFraco ? grupoFraco.label + ' (' + grupoFraco.nivelLabel + ')' : '—' },
    { label: 'Atributo', value: attrExemplo ? humanizeAttrId(attrExemplo.attr.id) : '—' },
    { label: 'Resposta', value: attrExemplo ? attrExemplo.label : '—' },
  ];
  steps.forEach((s, i) => {
    chain.appendChild(el('div', { class: 'trace-step' }, [
      el('div', { class: 'trace-dot' }),
      el('div', { class: 'trace-body' }, [
        el('div', { class: 'trace-label', text: s.label }),
        el('div', { class: 'trace-value', text: s.value }),
      ]),
    ]));
    if(i < steps.length - 1) chain.appendChild(el('div', { class: 'trace-connector' }));
  });
  box.appendChild(chain);
  if(!grupoFraco){
    box.appendChild(el('div', { class: 'note', style: 'margin-top:14px;', text: 'Sem pontos de atenção identificados para ilustrar a cadeia com um exemplo concreto.' }));
  }
  box.appendChild(el('button', { class: 'btn secondary small', text: 'Perguntar à IA: por que chegamos a esse resultado? →', style: 'margin-top:16px;', onclick: () => insightsTurn('Por que chegamos a esse resultado? Explique a cadeia completa, da maturidade digital até as respostas da coleta.') }));
  card.appendChild(box);
  return card;
}

// 2.4/2.5 -- cards visuais de pontos fortes e pontos de atenção.
function sectionForcasAtencao(){
  const card = el('div', { class: 'cockpit-section' });
  const { fortes, atencao } = pontosDestaqueLists();

  const head1 = el('div', { class: 'cockpit-section-head' });
  head1.appendChild(el('div', { class: 'cockpit-section-title', text: 'Pontos de força' }));
  head1.appendChild(el('div', { class: 'cockpit-section-question', text: 'Onde já existem capacidades desenvolvidas?' }));
  card.appendChild(head1);
  card.appendChild(insightCardsGrid(fortes.slice(0, 6), 'forte'));

  const head2 = el('div', { class: 'cockpit-section-head', style: 'margin-top:30px;' });
  head2.appendChild(el('div', { class: 'cockpit-section-title', text: 'Pontos de atenção' }));
  head2.appendChild(el('div', { class: 'cockpit-section-question', text: 'Onde existem possibilidades de evolução?' }));
  card.appendChild(head2);
  card.appendChild(insightCardsGrid(atencao.slice(0, 6), 'atencao'));

  return card;
}

function insightCardsGrid(items, cls){
  const grid = el('div', { class: 'insight-cards-grid' });
  if(!items.length){
    grid.appendChild(el('div', { class: 'explore-empty', text: 'Nenhum atributo nesta condição.' }));
    return grid;
  }
  items.forEach(({ attr, label }) => {
    const card = el('div', { class: 'insight-card ' + cls });
    card.appendChild(el('div', { class: 'insight-card-title', text: humanizeAttrId(attr.id) }));
    card.appendChild(el('div', { class: 'insight-card-level', text: 'Resposta registrada: ' + label }));
    const actions = el('div', { class: 'insight-card-actions' });
    actions.appendChild(el('button', { class: 'btn secondary small', text: 'Entender', onclick: () => { state.selectedAttrId = attr.id; render(); } }));
    actions.appendChild(el('button', { class: 'btn secondary small', text: 'Perguntar à IA', onclick: () => { goToSection('insights'); insightsTurn(`Pode explicar melhor o atributo ${humanizeAttrId(attr.id)}, cuja resposta foi "${label}"?`); } }));
    if(cls === 'atencao'){
      actions.appendChild(el('button', { class: 'btn secondary small', text: '+ Roadmap', onclick: () => addManualRoadmapAction(attr) }));
    }
    card.appendChild(actions);
    grid.appendChild(card);
  });
  return grid;
}

// 2.6 -- exploração de um atributo individual (overlay global -- disparado
// pelo heatmap, sunburst, exploração ou cards de força/atenção).
// Guarda de reentrância dedicada (attrId -> em andamento) -- nunca reusar
// state.explaining (flag global do Bloco 2 da Etapa 1, outro contexto) nem
// deixar de checar state.explainErrors[attrId]: sem isso, uma falha (ex.
// sem ANTHROPIC_API_KEY) reagendava a mesma chamada a cada render() daqui
// pra sempre -- mesma classe de bug já corrigida em ensurePanel/
// ensureLearning na rodada 3 (ver comentário lá).
const attrExplainFallbackLoading = {};
async function ensureAttributeExplanationFallback(attrId){
  if(state.explanations[attrId] || state.explainErrors[attrId] || attrExplainFallbackLoading[attrId]) return;
  const attr = attrById(attrId);
  if(!attr) return;
  attrExplainFallbackLoading[attrId] = true;
  try{
    const res = await fetch('/api/collect/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attrId, orgName: state.orgName, orgContext: state.orgContext }) });
    const data = await res.json();
    if(res.ok) state.explanations[attrId] = data.message || '';
    else state.explainErrors[attrId] = data.error || ('Erro ' + res.status);
  } catch(err){
    state.explainErrors[attrId] = err.message;
  }
  attrExplainFallbackLoading[attrId] = false;
  render();
}

async function ensureAttributeExplore(attrId){
  const cache = state.attributeDetail[attrId];
  if(cache && (cache.possibilidades || cache.loading || cache.error)) return;
  state.attributeDetail[attrId] = Object.assign({}, cache, { loading: true, error: '' });
  render();
  const attr = attrById(attrId);
  const val = state.answers[attrId];
  const idx = val ? attr.niveis.indexOf(val) : -1;
  const respostaLabel = idx >= 0 && attr.niveisExibicao ? attr.niveisExibicao[idx] : val;
  const evidenciaConversa = (state.registro[attrId] && state.registro[attrId].conversa) || [];
  try{
    const res = await fetch('/api/insights/attribute-explore', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attrId, orgName: state.orgName, orgContext: state.orgContext, resposta: val, respostaLabel, evidenciaConversa }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    state.attributeDetail[attrId] = { possibilidades: data.possibilidades, loading: false, error: '' };
  } catch(err){
    state.attributeDetail[attrId] = { loading: false, error: 'Não consegui gerar possibilidades agora (' + err.message + ').' };
  }
  render();
}

function attributeDetailOverlay(){
  const attrId = state.selectedAttrId;
  const attr = attrById(attrId);
  const overlay = el('div', { class: 'attr-detail-overlay', onclick: (e) => { if(e.target === overlay){ state.selectedAttrId = null; render(); } } });
  const panel = el('div', { class: 'attr-detail-panel' });
  panel.appendChild(el('button', { class: 'attr-detail-close', text: '×', onclick: () => { state.selectedAttrId = null; render(); } }));

  if(!attr){
    panel.appendChild(el('div', { text: 'Atributo não encontrado.' }));
    overlay.appendChild(panel);
    return overlay;
  }

  const val = state.answers[attrId];
  const idx = val ? attr.niveis.indexOf(val) : -1;
  const label = idx >= 0 && attr.niveisExibicao ? attr.niveisExibicao[idx] : 'não respondido';

  panel.appendChild(el('div', { class: 'attr-detail-eyebrow', text: attr.dimensao + ' · ' + DEXI_MODEL.grupos.find((g) => g.id === attr.grupoTop)?.label }));
  panel.appendChild(el('h2', { class: 'attr-detail-title', text: humanizeAttrId(attr.id) }));
  panel.appendChild(el('div', { class: 'attr-detail-level', text: 'Nível atual: ' + label }));

  panel.appendChild(el('div', { class: 'attr-detail-section' }, [
    el('div', { class: 'attr-detail-section-label', text: 'O que identificamos' }),
    el('div', { class: 'attr-detail-section-text', text: 'Na coleta, a resposta registrada para este atributo foi "' + label + '".' }),
  ]));

  const evidenciaConversa = (state.registro[attrId] && state.registro[attrId].conversa) || [];
  if(evidenciaConversa.length){
    const evBox = el('div', { class: 'attr-detail-section' });
    evBox.appendChild(el('div', { class: 'attr-detail-section-label', text: 'Evidência' }));
    evidenciaConversa.slice(0, 6).forEach((m) => {
      evBox.appendChild(el('div', { class: 'attr-detail-section-text', style: 'margin-bottom:4px;', text: (m.role === 'assistant' ? 'Agente: ' : 'Organização: ') + m.text }));
    });
    panel.appendChild(evBox);
  }

  const meaningBox = el('div', { class: 'attr-detail-section' });
  meaningBox.appendChild(el('div', { class: 'attr-detail-section-label', text: 'O que isso significa' }));
  if(state.explanations[attrId]){
    meaningBox.appendChild(el('div', { class: 'attr-detail-section-text', text: state.explanations[attrId] }));
  } else if(state.explainErrors[attrId]){
    meaningBox.appendChild(el('div', { class: 'error-box', text: 'Não consegui gerar essa explicação agora (' + state.explainErrors[attrId] + ').' }));
    meaningBox.appendChild(el('button', { class: 'btn secondary small', text: 'Tentar novamente', style: 'margin-top:8px;', onclick: () => { delete state.explainErrors[attrId]; ensureAttributeExplanationFallback(attrId); } }));
  } else {
    meaningBox.appendChild(el('div', { class: 'attr-detail-section-text' }, [el('span', { class: 'spinner' }), el('span', { text: ' carregando...', style: 'margin-left:8px;' })]));
    setTimeout(() => ensureAttributeExplanationFallback(attrId), 0);
  }
  panel.appendChild(meaningBox);

  const possBox = el('div', { class: 'attr-detail-section' });
  possBox.appendChild(el('div', { class: 'attr-detail-section-label', text: 'O que podemos explorar' }));
  const cache = state.attributeDetail[attrId];
  if(cache && cache.possibilidades){
    possBox.appendChild(el('div', { class: 'attr-detail-section-text', text: cache.possibilidades }));
  } else if(cache && cache.loading){
    possBox.appendChild(el('div', { class: 'attr-detail-section-text' }, [el('span', { class: 'spinner' }), el('span', { text: ' pensando...', style: 'margin-left:8px;' })]));
  } else if(cache && cache.error){
    possBox.appendChild(el('div', { class: 'error-box', text: cache.error }));
    possBox.appendChild(el('button', { class: 'btn secondary small', text: 'Tentar novamente', style: 'margin-top:8px;', onclick: () => { delete state.attributeDetail[attrId]; ensureAttributeExplore(attrId); } }));
  } else {
    possBox.appendChild(el('div', { class: 'attr-detail-section-text' }, [el('span', { class: 'spinner' }), el('span', { text: ' pensando...', style: 'margin-left:8px;' })]));
    setTimeout(() => ensureAttributeExplore(attrId), 0);
  }
  panel.appendChild(possBox);

  panel.appendChild(el('button', { class: 'btn', text: '+ Adicionar ao Roadmap', style: 'margin-top:22px;', onclick: () => addManualRoadmapAction(attr) }));

  overlay.appendChild(panel);
  return overlay;
}

// ==========================================================================
// ROADMAP -- "O que vamos fazer?"
// ==========================================================================

function addManualRoadmapAction(attr){
  const grupo = DEXI_MODEL.grupos.find((g) => g.id === attr.grupoTop);
  state.roadmapItems.push({
    id: 'a' + (roadmapIdSeq++),
    titulo: 'Evoluir: ' + humanizeAttrId(attr.id),
    origemLabel: grupo ? grupo.label : null,
    objetivo: '',
    responsavel: '',
    prazo: '',
    horizonte: '0-3',
    status: 'nao-iniciada',
    isAiSuggestion: false,
  });
  goToSection('roadmap');
}

async function generateRoadmap(){
  // Não exige state.panel -- buildPontosAtencao() (servidor) já funciona só
  // com as respostas quando a extração do resultado do DEXi falhar (mesmo
  // grau de degradação graciosa do resto do Cockpit, ex. heatmap/exploração,
  // que também não dependem do painel para mostrar dados reais).
  if(state.roadmapGenerating) return;
  state.roadmapGenerating = true;
  state.roadmapGenerateError = '';
  render();
  try{
    const res = await fetch('/api/roadmap/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: state.orgName, orgContext: state.orgContext, answers: state.answers,
        capDigital: state.panel ? state.panel.capDigital : null,
        capOrganizacional: state.panel ? state.panel.capOrganizacional : null,
        grupos: state.panel ? state.panel.grupos : [],
      }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    state.roadmapSuggestions = data.acoes.map((a) => Object.assign({ id: 's' + (roadmapIdSeq++), isAiSuggestion: true, status: 'nao-iniciada', responsavel: '' }, a));
  } catch(err){
    state.roadmapGenerateError = 'Não consegui gerar o roadmap agora (' + err.message + ').';
  }
  state.roadmapGenerating = false;
  render();
}

function acceptRoadmapSuggestion(sugId){
  const idx = state.roadmapSuggestions.findIndex((s) => s.id === sugId);
  if(idx === -1) return;
  const [sug] = state.roadmapSuggestions.splice(idx, 1);
  state.roadmapItems.push(sug);
  render();
}
function dismissRoadmapSuggestion(sugId){
  state.roadmapSuggestions = state.roadmapSuggestions.filter((s) => s.id !== sugId);
  render();
}

async function roadmapActionTurn(actionId, userMessage){
  userMessage = (userMessage || '').trim();
  if(!userMessage || state.roadmapActionThinking[actionId]) return;
  const action = state.roadmapItems.find((a) => a.id === actionId);
  if(!action) return;
  const chat = state.roadmapActionChats[actionId] || (state.roadmapActionChats[actionId] = []);
  chat.push({ role: 'user', text: userMessage });
  const historySnapshot = chat.slice(0, -1);
  state.roadmapActionThinking[actionId] = true;
  state.roadmapActionErrors[actionId] = '';
  render();
  try{
    const res = await fetch('/api/roadmap/action-turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName: state.orgName, action, history: historySnapshot, userMessage }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    chat.push({ role: 'assistant', text: data.message });
  } catch(err){
    state.roadmapActionErrors[actionId] = 'Não consegui gerar a resposta: ' + err.message;
  }
  state.roadmapActionThinking[actionId] = false;
  render();
}

const ROADMAP_STATUS = [
  { id: 'nao-iniciada', label: 'Não iniciada' },
  { id: 'em-andamento', label: 'Em andamento' },
  { id: 'concluida', label: 'Concluída' },
  { id: 'pausada', label: 'Pausada' },
];
const ROADMAP_HORIZONTES = [
  { id: '0-3', label: '0–3 meses' },
  { id: '3-6', label: '3–6 meses' },
  { id: '6-12', label: '6–12 meses' },
];

function screenRoadmap(){
  const c = el('div');

  const hero = el('div', { class: 'cockpit-hero' });
  hero.appendChild(el('div', { class: 'cockpit-hero-eyebrow', text: 'Roadmap · O que vamos fazer?' }));
  hero.appendChild(el('h1', { class: 'cockpit-hero-title', text: 'Transforme os insights em evolução' }));
  hero.appendChild(el('p', { class: 'cockpit-hero-sub', text: 'Organize prioridades, defina ações e acompanhe a evolução da organização ao longo dos próximos meses.' }));
  const actions = el('div', { class: 'cockpit-hero-actions' });
  actions.appendChild(el('button', { class: 'btn', text: '＋ Nova ação', onclick: () => { state.roadmapNewActionOpen = !state.roadmapNewActionOpen; render(); } }));
  actions.appendChild(el('button', { class: 'btn secondary', text: state.roadmapGenerating ? 'Gerando…' : '✨ Criar roadmap com IA', disabled: state.roadmapGenerating, onclick: generateRoadmap }));
  hero.appendChild(actions);
  c.appendChild(hero);

  // Atual x Meta -- migrada do Panorama: "que nível queremos alcançar" já é
  // uma pergunta de gestão/futuro, não de leitura do diagnóstico.
  c.appendChild(sectionMeta());

  if(state.roadmapGenerateError){
    c.appendChild(el('div', { class: 'error-box', text: state.roadmapGenerateError }));
  }
  if(state.roadmapNewActionOpen){
    c.appendChild(newActionForm());
  }

  if(state.roadmapSuggestions.length){
    c.appendChild(sectionRoadmapSuggestions());
  }

  c.appendChild(sectionRoadmapTimeline());

  c.appendChild(el('div', { class: 'persistence-note' }, [
    el('b', { text: 'Revisões de 3/6/12 meses, comparação com avaliação anterior e retomar este roadmap numa visita futura' }),
    document.createTextNode('precisam de um banco de dados simples e de uma forma de identificar a mesma organização entre sessões (não precisa ser login completo -- pode ser um código de acesso por organização). Esta versão do Cockpit guarda o roadmap só durante esta sessão do navegador, igual ao restante da ferramenta hoje -- é uma mudança estrutural deliberadamente deixada para revisão antes de implementar (ver adendo rodada 6, seção 0).'),
  ]));

  return c;
}

function newActionForm(){
  const card = el('div', { class: 'cockpit-card on-paper', style: 'margin-bottom:20px;' });
  card.appendChild(el('div', { class: 'cockpit-card-title', text: 'Nova ação' }));
  const tituloIn = el('input', { type: 'text', placeholder: 'Título da ação' });
  const objetivoIn = el('textarea', { placeholder: 'Objetivo (opcional)', style: 'min-height:70px;' });
  const horizonteSel = el('select', {});
  ROADMAP_HORIZONTES.forEach((h) => horizonteSel.appendChild(el('option', { value: h.id, text: h.label })));
  card.appendChild(el('label', { text: 'Título' }));
  card.appendChild(tituloIn);
  card.appendChild(el('label', { text: 'Objetivo' }));
  card.appendChild(objetivoIn);
  card.appendChild(el('label', { text: 'Horizonte' }));
  card.appendChild(horizonteSel);
  const row = el('div', { class: 'btn-row' });
  row.appendChild(el('button', { class: 'btn', text: 'Adicionar', onclick: () => {
    if(!tituloIn.value.trim()) return;
    state.roadmapItems.push({
      id: 'a' + (roadmapIdSeq++), titulo: tituloIn.value.trim(), origemLabel: null,
      objetivo: objetivoIn.value.trim(), responsavel: '', prazo: '', horizonte: horizonteSel.value,
      status: 'nao-iniciada', isAiSuggestion: false,
    });
    state.roadmapNewActionOpen = false;
    render();
  } }));
  row.appendChild(el('button', { class: 'btn secondary', text: 'Cancelar', onclick: () => { state.roadmapNewActionOpen = false; render(); } }));
  card.appendChild(row);
  return card;
}

function sectionRoadmapSuggestions(){
  const card = el('div', { class: 'cockpit-section' });
  card.appendChild(el('div', { class: 'cockpit-section-title', text: 'Sugestões da IA', style: 'margin-bottom:6px;' }));
  card.appendChild(el('div', { class: 'cockpit-section-question', text: 'Proposta inicial a partir do diagnóstico -- você decide o que entra no roadmap.', style: 'display:block; margin-bottom:14px;' }));
  const list = el('div', { class: 'roadmap-suggestions-list' });
  state.roadmapSuggestions.forEach((s) => {
    const item = el('div', { class: 'roadmap-suggestion-card' });
    item.appendChild(el('div', { class: 'roadmap-ai-tag', text: '✨ Sugestão da IA' }));
    item.appendChild(el('div', { class: 'roadmap-action-title', text: s.titulo }));
    item.appendChild(el('div', { class: 'roadmap-action-meta' }, [
      s.origemLabel ? el('span', { text: 'Origem: ' + s.origemLabel }) : null,
      el('span', { text: 'Horizonte: ' + (ROADMAP_HORIZONTES.find((h) => h.id === s.horizonte) || {}).label }),
      s.indicadorSugerido ? el('span', { text: 'Indicador: ' + s.indicadorSugerido }) : null,
    ].filter(Boolean)));
    item.appendChild(el('div', { class: 'block-explain-text', text: s.objetivo }));
    const actions = el('div', { class: 'roadmap-suggestion-actions' });
    actions.appendChild(el('button', { class: 'btn secondary small', text: 'Adicionar ao roadmap', onclick: () => acceptRoadmapSuggestion(s.id) }));
    actions.appendChild(el('button', { class: 'btn secondary small', text: 'Descartar', onclick: () => dismissRoadmapSuggestion(s.id) }));
    item.appendChild(actions);
    list.appendChild(item);
  });
  card.appendChild(list);
  return card;
}

function sectionRoadmapTimeline(){
  const card = el('div', { class: 'cockpit-section' });
  card.appendChild(el('div', { class: 'cockpit-section-title', text: 'Visão de 12 meses' }));
  const timeline = el('div', { class: 'roadmap-timeline' });
  ROADMAP_HORIZONTES.forEach((h) => {
    const col = el('div', { class: 'roadmap-col' });
    col.appendChild(el('div', { class: 'roadmap-col-title', text: h.label }));
    const items = state.roadmapItems.filter((a) => a.horizonte === h.id);
    if(!items.length){
      col.appendChild(el('div', { class: 'roadmap-col-empty', text: 'Nenhuma ação ainda.' }));
    } else {
      items.forEach((a) => col.appendChild(roadmapActionCard(a)));
    }
    timeline.appendChild(col);
  });
  card.appendChild(timeline);
  return card;
}

function roadmapActionCard(a){
  const statusInfo = ROADMAP_STATUS.find((s) => s.id === a.status) || ROADMAP_STATUS[0];
  const card = el('div', { class: 'roadmap-action-card', onclick: () => { state.roadmapOpenActionId = a.id; render(); } });
  if(a.isAiSuggestion) card.appendChild(el('div', { class: 'roadmap-ai-tag', text: '✨ Sugestão da IA' }));
  card.appendChild(el('div', { class: 'roadmap-action-title', text: a.titulo }));
  const meta = el('div', { class: 'roadmap-action-meta' });
  if(a.origemLabel) meta.appendChild(el('span', { text: 'Origem: ' + a.origemLabel }));
  if(a.responsavel) meta.appendChild(el('span', { text: 'Resp.: ' + a.responsavel }));
  if(a.prazo) meta.appendChild(el('span', { text: 'Prazo: ' + a.prazo }));
  card.appendChild(meta);
  card.appendChild(el('span', { class: 'roadmap-status-badge ' + statusInfo.id, text: statusInfo.label }));
  return card;
}

function actionDetailOverlay(){
  const actionId = state.roadmapOpenActionId;
  const action = state.roadmapItems.find((a) => a.id === actionId);
  const overlay = el('div', { class: 'attr-detail-overlay', onclick: (e) => { if(e.target === overlay){ state.roadmapOpenActionId = null; render(); } } });
  const panel = el('div', { class: 'attr-detail-panel' });
  panel.appendChild(el('button', { class: 'attr-detail-close', text: '×', onclick: () => { state.roadmapOpenActionId = null; render(); } }));

  if(!action){ panel.appendChild(el('div', { text: 'Ação não encontrada.' })); overlay.appendChild(panel); return overlay; }

  if(action.isAiSuggestion) panel.appendChild(el('div', { class: 'roadmap-ai-tag', text: '✨ Sugestão da IA' }));
  panel.appendChild(el('h2', { class: 'attr-detail-title', text: action.titulo }));
  if(action.origemLabel) panel.appendChild(el('div', { class: 'attr-detail-eyebrow', text: 'Origem: ' + action.origemLabel }));

  const body = el('div', { class: 'action-detail-body' });

  const objetivoField = el('div', { class: 'action-detail-field' });
  objetivoField.appendChild(el('label', { text: 'Objetivo' }));
  const objetivoIn = el('textarea', { style: 'min-height:70px; width:100%; font-family:var(--font-body); font-size:14.5px; padding:10px 13px; border:1px solid var(--line); border-radius:9px; background:var(--paper); color:var(--ink);' });
  objetivoIn.value = action.objetivo || '';
  objetivoIn.addEventListener('change', () => { action.objetivo = objetivoIn.value; });
  objetivoField.appendChild(objetivoIn);
  body.appendChild(objetivoField);

  const row = el('div', { style: 'display:grid; grid-template-columns:1fr 1fr; gap:14px;' });
  const respField = el('div', { class: 'action-detail-field' });
  respField.appendChild(el('label', { text: 'Responsável' }));
  const respIn = el('input', { type: 'text', value: action.responsavel || '' });
  respIn.addEventListener('change', () => { action.responsavel = respIn.value; });
  respField.appendChild(respIn);
  row.appendChild(respField);

  const prazoField = el('div', { class: 'action-detail-field' });
  prazoField.appendChild(el('label', { text: 'Prazo' }));
  const prazoIn = el('input', { type: 'text', placeholder: 'ex.: até final do trimestre', value: action.prazo || '' });
  prazoIn.addEventListener('change', () => { action.prazo = prazoIn.value; });
  prazoField.appendChild(prazoIn);
  row.appendChild(prazoField);
  body.appendChild(row);

  const row2 = el('div', { style: 'display:grid; grid-template-columns:1fr 1fr; gap:14px;' });
  const horizonteField = el('div', { class: 'action-detail-field' });
  horizonteField.appendChild(el('label', { text: 'Horizonte' }));
  const horizonteSel = el('select', {});
  ROADMAP_HORIZONTES.forEach((h) => horizonteSel.appendChild(el('option', { value: h.id, selected: action.horizonte === h.id, text: h.label })));
  horizonteSel.addEventListener('change', () => { action.horizonte = horizonteSel.value; render(); });
  horizonteField.appendChild(horizonteSel);
  row2.appendChild(horizonteField);

  const statusField = el('div', { class: 'action-detail-field' });
  statusField.appendChild(el('label', { text: 'Status' }));
  const statusSel = el('select', {});
  ROADMAP_STATUS.forEach((s) => statusSel.appendChild(el('option', { value: s.id, selected: action.status === s.id, text: s.label })));
  statusSel.addEventListener('change', () => { action.status = statusSel.value; render(); });
  statusField.appendChild(statusSel);
  row2.appendChild(statusField);
  body.appendChild(row2);

  if(action.indicadorSugerido){
    body.appendChild(el('div', { class: 'note', text: 'Indicador sugerido pela IA: ' + action.indicadorSugerido }));
  }

  const removeBtn = el('button', { class: 'btn secondary small', text: 'Remover ação', style: 'margin-top:6px;', onclick: () => {
    state.roadmapItems = state.roadmapItems.filter((a) => a.id !== actionId);
    state.roadmapOpenActionId = null;
    render();
  } });
  body.appendChild(removeBtn);

  body.appendChild(el('div', { class: 'attr-detail-section-label', text: 'Conversar sobre esta ação', style: 'margin-top:24px;' }));
  const chat = state.roadmapActionChats[actionId] || [];
  if(chat.length){
    const chatBox = el('div', { class: 'chat-log', style: 'margin:10px 0 14px;' });
    chat.forEach((m) => chatBox.appendChild(el('div', { class: 'bubble report-body ' + (m.role === 'assistant' ? 'bubble-agent' : 'bubble-user'), text: m.text })));
    body.appendChild(chatBox);
  }
  if(state.roadmapActionThinking[actionId]){
    body.appendChild(el('div', { class: 'bubble bubble-agent', style: 'margin-top:10px;' }, [el('span', { class: 'spinner' }), el('span', { text: ' pensando...', style: 'margin-left:8px;' })]));
  } else {
    const inputRow = el('div', { class: 'chat-input-row' });
    const textIn = el('input', { type: 'text', placeholder: 'ex.: como quebrar isso em etapas?' });
    textIn.addEventListener('keydown', (e) => { if(e.key === 'Enter' && textIn.value.trim()){ roadmapActionTurn(actionId, textIn.value); textIn.value = ''; } });
    const sendBtn = el('button', { class: 'btn chat-send', text: 'Enviar', onclick: () => { if(textIn.value.trim()){ roadmapActionTurn(actionId, textIn.value); textIn.value = ''; } } });
    inputRow.appendChild(textIn);
    inputRow.appendChild(sendBtn);
    body.appendChild(inputRow);
  }
  if(state.roadmapActionErrors[actionId]){
    body.appendChild(el('div', { class: 'error-box', text: state.roadmapActionErrors[actionId] }));
  }

  panel.appendChild(body);
  overlay.appendChild(panel);
  return overlay;
}
