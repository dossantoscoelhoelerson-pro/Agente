// Aplicação de página única, JS vanilla, sem build step -- mesmo estilo do
// protótipo. As únicas diferenças de arquitetura: as chamadas de IA vão para
// o backend próprio (/api/...), nunca direto para a Anthropic, e os
// downloads usam Blob + <a download> puro (fora do claude.ai isso já
// funciona sem nenhuma capability especial).

let ATTRS = [];
let DEXI_MODEL = null; // {root, dimensoes, grupos} -- ver /api/dexi-model

const state = {
  screen: 'loading',
  idx: 0,
  answers: {},
  registro: {},          // attrId -> {id, resposta, conversa}
  chatLogs: {},           // attrId -> [{role, text}] -- Bloco 4 (conversa livre)
  explanations: {},       // attrId -> texto do Bloco 2 (explicação adaptada)
  explainErrors: {},      // attrId -> mensagem de erro do Bloco 2, se falhou
  explaining: false,
  orgName: '',
  orgContext: '',
  editingFromReview: false,
  thinking: false,
  turnInFlight: false,

  dexiText: '',
  collectionSourceLoaded: false, // JSON da coleta foi carregado manualmente (sessão nova)
  uploadError: '',

  // Resultado oficial do DEXi, extraído do texto carregado (ver ensurePanel()
  // abaixo) -- base de dados compartilhada pelas três seções do Cockpit
  // (adendo rodada 6). {nivelFinal, nivelFinalLabel, capDigital,
  // capDigitalLabel, capOrganizacional, capOrganizacionalLabel, grupos, consistencia}
  panel: null,
  panelLoading: false,
  panelError: '',
  pdfExporting: false,
  pdfExportError: '',

  // Caminho 3 da Home ("Já tenho um diagnóstico", adendo rodada 9) -- pula
  // toda a Etapa 1, então não existe registro_completo para essa avaliação.
  // Controla só o texto de aviso discreto em screenUpload(); nunca bloqueia
  // o fluxo.
  skipCollection: false,

  // O resto do estado do Cockpit (Panorama/Insights/Roadmap) é adicionado a
  // este objeto por public/js/cockpit.js, carregado depois deste arquivo --
  // mantém app.js só com o que é comum a toda a aplicação.
};

function el(tag, attrs, children){
  const e = document.createElement(tag);
  if(attrs) for(const k in attrs){
    if(k === 'text') e.textContent = attrs[k];
    else if(k === 'html') e.innerHTML = attrs[k];
    else if(k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else if(attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
  }
  (children||[]).forEach(c => c && e.appendChild(c));
  return e;
}

// Trava de reentrância: uma tela pode, ao ser construída, disparar uma
// chamada assíncrona cujo início síncrono chama render() de novo (ex.
// "state.x = true; render();" antes do primeiro await) -- se isso
// acontecer ainda dentro de uma chamada a render() em andamento, o
// appendChild() de fora conclui depois e duplica o conteúdo no DOM. Os
// pontos de disparo já usam setTimeout para evitar isso, mas esta trava
// garante que nenhum outro caminho volte a introduzir o mesmo bug.
let renderInProgress = false;
let renderPending = false;

// Chave da "página" atual, para saber quando rolar para o topo. Dentro da
// tela de coleta cada atributo conta como uma página própria (idx muda),
// nas demais telas a própria mudança de screen já basta.
function currentPageKey(){
  return state.screen === 'collect' ? 'collect:' + state.idx : state.screen;
}
let lastPageKey = null;

function render(){
  if(renderInProgress){ renderPending = true; return; }
  renderInProgress = true;
  try{
    renderOnce();
  } finally {
    renderInProgress = false;
  }
  if(renderPending){ renderPending = false; render(); }
}

// Etapa 1 = abertura, as 34 perguntas, revisão e conclusão da coleta --
// usa um fundo de página diferente das Etapas 2 e 3 (ver --etapa1-bg em
// public/css/styles.css).
const ETAPA1_SCREENS = ['intro', 'collect', 'review', 'done1'];

function renderOnce(){
  document.body.classList.toggle('etapa-1', ETAPA1_SCREENS.includes(state.screen));
  // Cockpit (adendo rodada 6) usa um layout mais largo que o --wrap de
  // 720px da coleta -- produto/dashboard, não formulário de leitura linear.
  document.body.classList.toggle('cockpit-screen', state.screen === 'report');
  // Home e "Conhecer a ORBE" (adendo rodada 9) usam sidebar fixa própria em
  // vez do cabeçalho sticky simples das demais telas.
  document.body.classList.toggle('home-screen', state.screen === 'home' || state.screen === 'about');

  const app = document.getElementById('app');
  app.innerHTML = '';
  // Transição suave (adendo rodada 5): #app é o mesmo nó em todo render()
  // (só o innerHTML é trocado), então só reaplicar a classe não dispara a
  // animação de novo -- o navegador não reinicia uma keyframe já "vista"
  // na mesma classe. Remover, forçar reflow (void offsetWidth) e reaplicar
  // é o jeito padrão de reiniciar uma animação CSS no mesmo elemento.
  app.classList.remove('screen-fade');
  void app.offsetWidth;
  app.classList.add('screen-fade');
  if(state.screen === 'loading') app.appendChild(screenLoading());
  else if(state.screen === 'home') app.appendChild(screenHome());
  else if(state.screen === 'about') app.appendChild(screenAbout());
  else if(state.screen === 'intro') app.appendChild(screenIntro());
  else if(state.screen === 'collect') app.appendChild(screenCollect());
  else if(state.screen === 'review') app.appendChild(screenReview());
  else if(state.screen === 'done1') app.appendChild(screenDone1());
  else if(state.screen === 'manual') app.appendChild(screenManual());
  else if(state.screen === 'upload') app.appendChild(screenUpload());
  else if(state.screen === 'report') app.appendChild(screenReport());

  // Rola para o topo só quando a "página" muda de verdade (nova
  // tela, ou novo atributo dentro da coleta) -- nunca em re-renders da
  // mesma página (digitar, respostas de chat chegando etc.), senão a
  // rolagem "pula" enquanto o usuário está no meio de uma interação.
  const key = currentPageKey();
  if(key !== lastPageKey){
    lastPageKey = key;
    window.scrollTo(0, 0);
  }
}

function stepsNav(activeIdx){
  const labels = ['Coleta', 'Rodar no DEXi', 'Resultado'];
  const nav = el('div', {class:'steps-nav'});
  labels.forEach((l,i)=>{
    let cls = 'dot';
    if(i < activeIdx) cls += ' done';
    if(i === activeIdx) cls += ' active';
    nav.appendChild(el('div', {class:cls}));
  });
  return nav;
}

function screenLoading(){
  const c = el('div');
  c.appendChild(el('p', {text:'Carregando...'}));
  return c;
}

// ---------- Home e os três caminhos (adendo rodada 9) ----------
//
// A Home é a nova porta de entrada da aplicação (antes o primeiro estado
// era direto a tela de abertura da coleta). Três caminhos, cada um levando
// a uma lógica já existente ou a uma tela nova simples:
//   Card 1 "Conhecer a ORBE"      -> tela nova (screenAbout), só explicativa.
//   Card 2 "Diagnóstico de Maturidade Digital" -> fluxo já existente
//     (screenIntro -> coleta -> DEXi manual -> upload -> Panorama), sem
//     nenhuma mudança de lógica -- só uma porta de entrada nova.
//   Card 3 "Já tenho um diagnóstico" -> pula a Etapa 1 inteira e vai direto
//     para a tela de upload/colagem já existente (ver screenUpload() e
//     state.skipCollection).

function goToHome(){ state.screen = 'home'; render(); }

// Item "Realizar um diagnóstico" da sidebar -- retoma de onde a pessoa
// estiver: coleta em andamento -> próxima pergunta não respondida; nada em
// andamento -> mesma porta de entrada do Card 2. Painel já carregado numa
// sessão anterior não redireciona pra cá -- esse caminho é sempre para
// COMEÇAR uma nova coleta (ver adendo rodada 11, seção 1: espelha os
// caminhos da Home, e "Realizar um diagnóstico" na Home sempre inicia o
// fluxo do zero).
function goToDiagnostico(){
  const next = nextUnansweredIndex();
  if(next > 0 && next < ATTRS.length){ goToAttribute(next); return; }
  state.screen = 'intro';
  render();
}

function goToAbout(){ state.screen = 'about'; render(); }

// Item "Já tenho um diagnóstico" -- mesmo caminho do Card 3 da Home
// (compartilhado para não duplicar a lógica entre sidebar e Home).
function goToSkipCollection(){
  state.skipCollection = true; state.uploadError = ''; state.screen = 'upload'; render();
}

// Ícones chapados/sólidos nas cores oficiais da marca (adendo rodada 10,
// seção 6) -- substituem os emojis usados até aqui na Home. Um único fill
// sólido por ícone (currentColor, controlado via CSS color no elemento
// pai), formas geométricas simples, sem contorno -- estilo "tecnológico e
// contemporâneo", nunca desenhado à mão.
const ICON_PATHS = {
  home: 'M12 3.2 3 10.5V21h6.2v-6.3h5.6V21H21V10.5L12 3.2Z',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 3.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z',
  spark: 'M12 2c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Zm7 11c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3Z',
  list: 'M4 5.5h16V8H4V5.5Zm0 5.25h16v2.5H4v-2.5ZM4 16h16v2.5H4V16Z',
  people: 'M8.5 12a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm7-.6a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8ZM2.2 19c.5-3.3 2.9-5.3 6.3-5.3s5.8 2 6.3 5.3H2.2Zm12.8-.3c-.2-1.7-.8-3.1-1.8-4.2 3-.2 5.3 1.7 5.8 4.5h-4Z',
  chart: 'M4 20V10h4v10H4Zm6 0V4h4v16h-4Zm6 0v-7h4v7h-4Z',
  compass: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.6 5.6-2 5.2-5.2 2 2-5.2 5.2-2Z',
  shield: 'M12 2.5 19.5 6v6c0 5-3.2 8.6-7.5 9.5C7.7 20.6 4.5 17 4.5 12V6L12 2.5Z',
  chat: 'M4 4h16v11H8.5L4 18.5V4Z',
  bell: 'M12 2.5a1.6 1.6 0 0 1 1.6 1.6v.6c2.6.7 4.4 3 4.4 5.9v4.6l1.7 2.3H4.3L6 15.2v-4.6c0-2.9 1.8-5.2 4.4-5.9v-.6A1.6 1.6 0 0 1 12 2.5Zm-2.3 17.4h4.6a2.3 2.3 0 0 1-4.6 0Z',
};
function icon(name, opts){
  opts = opts || {};
  const size = opts.size || 18;
  const span = el('span', {class:'icon-svg' + (opts.class ? ' ' + opts.class : ''), style: opts.color ? `color:${opts.color};` : ''});
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${ICON_PATHS[name]}"/></svg>`;
  return span;
}

// Sidebar com os 4 itens -- espelham exatamente os três caminhos da Home
// (mais a própria Início), sempre clicáveis (adendo rodada 11, seção 1;
// substitui os itens Insights/Roadmap, que dependiam de um diagnóstico já
// carregado -- essa navegação já existe dentro do Cockpit, via
// .cockpit-nav, uma vez que a pessoa chega lá).
function sidebarNav(active){
  const nav = el('nav', {class:'home-sidebar-nav'});
  const items = [
    {id:'home', label:'Início', icon:'home', onclick: goToHome},
    {id:'about', label:'Conhecer a ORBE', icon:'people', onclick: goToAbout},
    {id:'diagnostico', label:'Realizar um diagnóstico', icon:'target', onclick: goToDiagnostico},
    {id:'skip', label:'Já tenho um diagnóstico', icon:'compass', onclick: goToSkipCollection},
  ];
  items.forEach((it) => {
    const cls = 'home-sidebar-item' + (it.id === active ? ' active' : '');
    nav.appendChild(el('button', { class: cls, onclick: it.onclick }, [
      icon(it.icon, {class:'home-sidebar-icon'}),
      el('span', {text: it.label}),
    ]));
  });
  return nav;
}

// Cabeçalho da Home/Sobre -- sidebar fixa + área de conteúdo. Substitui o
// cabeçalho sticky simples usado nas demais telas (ver body.home-screen em
// styles.css); mesma identidade (logo oficial, nunca redesenhado).
function homeShell(active, contentChildren){
  const shell = el('div', {class:'home-shell'});

  const sidebar = el('aside', {class:'home-sidebar'});
  const logoWrap = el('div', {class:'home-sidebar-logo'});
  logoWrap.appendChild(el('img', {src:'/assets/brand/orbe_lockup_branco.png', alt:'ORBE — Maturidade Digital'}));
  sidebar.appendChild(logoWrap);
  sidebar.appendChild(sidebarNav(active));

  // Teaser decorativo (mesma composição da referência visual enviada) --
  // só texto de apoio, nenhum dado real.
  const teaser = el('div', {class:'home-sidebar-teaser'});
  teaser.appendChild(el('div', {class:'home-sidebar-teaser-title', text:'Sua jornada com a ORBE'}));
  teaser.appendChild(el('div', {class:'home-sidebar-teaser-text', text:'Mais clareza, melhores decisões, evolução contínua.'}));
  sidebar.appendChild(teaser);

  shell.appendChild(sidebar);

  const main = el('div', {class:'home-main'});
  const topbar = el('div', {class:'home-topbar'});
  topbar.appendChild(icon('bell', {class:'home-topbar-bell', color:'var(--yellow-strong)', size: 19}));
  const identity = el('div', {class:'home-topbar-identity'});
  identity.appendChild(el('div', {class:'home-topbar-avatar', text:'V'}));
  identity.appendChild(el('span', {text:'Visitante'}));
  topbar.appendChild(identity);
  main.appendChild(topbar);

  const content = el('div', {class:'home-content'});
  contentChildren.forEach((c) => c && content.appendChild(c));
  main.appendChild(content);
  shell.appendChild(main);

  return shell;
}

// Elemento gráfico orbital (linhas orbitais + pontos de conexão) -- própria
// linguagem gráfica pedida no adendo, construída em SVG puro a partir da
// paleta oficial. Não é uma foto (nenhum arquivo de foto foi fornecido) --
// o símbolo real da ORBE aparece sobreposto, nunca redesenhado. Reaproveitada
// tanto no hero da Home quanto na seção "Por que a ORBE" (rodada 10, seção
// 5: pedido explícito de deixar as duas composições consistentes entre si)
// -- mesmos dois anéis (um achatado, um mais redondo) em ângulos fixos, com
// os pontos calculados para caírem exatamente sobre a linha do anel (nunca
// soltos), então a composição lê como intencional em qualquer tamanho.
function orbitSvg(size, dotColors){
  const cx = size / 2, cy = size / 2;
  const ring1 = { rx: size * 0.46, ry: size * 0.19, rot: -12 };
  const ring2 = { rx: size * 0.33, ry: size * 0.33, rot: 8 };
  const pointOn = (ring, angleDeg) => {
    const a = (angleDeg * Math.PI) / 180;
    const x0 = ring.rx * Math.cos(a), y0 = ring.ry * Math.sin(a);
    const r = (ring.rot * Math.PI) / 180;
    return [cx + x0 * Math.cos(r) - y0 * Math.sin(r), cy + x0 * Math.sin(r) + y0 * Math.cos(r)];
  };
  const dots = [
    { ring: ring1, angle: 8, color: dotColors[0], r: size * 0.03 },
    { ring: ring1, angle: 195, color: dotColors[1], r: size * 0.03 },
    { ring: ring2, angle: 95, color: dotColors[2], r: size * 0.026 },
    { ring: ring2, angle: 268, color: dotColors[3], r: size * 0.026 },
  ];
  const dotsSvg = dots.map((d) => {
    const [x, y] = pointOn(d.ring, d.angle);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${d.r.toFixed(1)}" fill="${d.color}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" role="img" aria-label="Ilustração orbital ORBE" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="${cx}" cy="${cy}" rx="${ring1.rx}" ry="${ring1.ry}" fill="none" stroke="var(--blue)" stroke-width="${size * 0.003}" opacity="0.35" transform="rotate(${ring1.rot} ${cx} ${cy})"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${ring2.rx}" ry="${ring2.ry}" fill="none" stroke="var(--green)" stroke-width="${size * 0.003}" opacity="0.32" transform="rotate(${ring2.rot} ${cx} ${cy})"/>
    ${dotsSvg}
  </svg>`;
}

function orbitGraphic(){
  const wrap = el('div', {class:'home-orbit-graphic'});
  wrap.innerHTML = orbitSvg(400, ['var(--blue)', 'var(--red)', 'var(--yellow)', 'var(--green)']);
  // Símbolo (não o lockup com texto) -- adendo rodada 11, seção 2: o lockup
  // é uma imagem bem larga (~3:1) com texto; encolhido pro tamanho de um
  // emblema, o texto virava uma mancha que lia como "caixa borrada", não
  // falta de transparência de verdade.
  const logo = el('img', {class:'home-orbit-logo', src:'/assets/brand/orbe_simbolo.png', alt:'Símbolo ORBE'});
  wrap.appendChild(logo);
  return wrap;
}

function homeCard({iconName, iconColor, title, text, ctaLabel, onClick, featured}){
  const card = el('div', {class:'home-card' + (featured ? ' featured' : '')});
  if(featured) card.appendChild(el('div', {class:'home-card-tag', text:'Caminho principal'}));
  card.appendChild(icon(iconName, {class:'home-card-icon', color: iconColor, size: 30}));
  card.appendChild(el('div', {class:'home-card-title', text: title}));
  card.appendChild(el('div', {class:'home-card-text', text: text}));
  card.appendChild(el('button', {class:'btn' + (featured ? '' : ' secondary'), text: ctaLabel, onclick: onClick}));
  return card;
}

function screenHome(){
  const hero = el('div', {class:'home-hero'});
  const heroText = el('div', {class:'home-hero-text'});
  heroText.appendChild(el('div', {class:'home-hero-eyebrow', text:'Seu diagnóstico, com mais inteligência'}));
  heroText.appendChild(el('h1', {class:'home-hero-title', text:'Bem-vindo à ORBE'}));
  heroText.appendChild(el('div', {class:'home-hero-sub', text:'Sua parceira na jornada da transformação digital.'}));
  heroText.appendChild(el('p', {class:'home-hero-body', text:'Aqui você encontra uma experiência completa para entender onde sua organização está, o que isso significa e como evoluir com base em dados, insights e ação.'}));
  hero.appendChild(heroText);

  // Sem o emoji no selo e sem a frase de apoio abaixo do gráfico orbital
  // (adendo rodada 10, seções 7 e 8).
  const heroVisual = el('div', {class:'home-hero-visual'});
  heroVisual.appendChild(orbitGraphic());
  hero.appendChild(heroVisual);

  const entrySection = el('div', {class:'home-entry-section'});
  entrySection.appendChild(el('div', {class:'home-entry-eyebrow', text:'ESCOLHA O QUE VOCÊ PRECISA'}));
  entrySection.appendChild(el('h2', {class:'home-entry-title', text:'Como podemos te ajudar hoje?'}));
  entrySection.appendChild(el('p', {class:'home-entry-sub', text:'Cada caminho foi pensado para a sua jornada. Escolha por onde você quer começar.'}));

  const cardsGrid = el('div', {class:'home-cards-grid'});
  cardsGrid.appendChild(homeCard({
    iconName:'people', iconColor:'var(--blue)', title:'Conhecer a ORBE',
    text:'Entenda quem somos, nossa metodologia e como ajudamos organizações a evoluírem na jornada digital.',
    ctaLabel:'Saiba mais →',
    onClick: goToAbout,
  }));
  cardsGrid.appendChild(homeCard({
    iconName:'chart', iconColor:'var(--yellow)', title:'Diagnóstico de Maturidade Digital',
    text:'Responda 34 perguntas e descubra o estágio de maturidade digital da sua organização. Em poucos minutos, você terá um diagnóstico completo com base no modelo DEXi.',
    ctaLabel:'Começar diagnóstico →', featured: true,
    onClick: () => { state.screen = 'intro'; render(); },
  }));
  cardsGrid.appendChild(homeCard({
    iconName:'compass', iconColor:'var(--green)', title:'Já tenho um diagnóstico',
    text:'Se você já possui um diagnóstico DEXi, acesse aqui para visualizar seus resultados, explorar insights e planejar sua evolução.',
    ctaLabel:'Acessar meu diagnóstico →',
    onClick: goToSkipCollection,
  }));
  entrySection.appendChild(cardsGrid);

  // Seção rediagramada (adendo rodada 10, seção 5) -- cartão com o símbolo
  // da ORBE integrado ao mesmo gráfico orbital do hero (orbitSvg(), rodada
  // 10: pedido explícito de deixar as duas composições consistentes),
  // maior e mais integrado do que a linha simples de ícone+texto de antes.
  const capSection = el('div', {class:'home-cap-section'});
  const capDecor = el('div', {class:'home-cap-decor'});
  capDecor.innerHTML = orbitSvg(200, ['var(--yellow)', 'var(--red)', 'var(--blue)', 'var(--green)']);
  capDecor.appendChild(el('img', {class:'home-cap-logo', src:'/assets/brand/orbe_simbolo.png', alt:'Símbolo ORBE'}));
  capSection.appendChild(capDecor);

  const capContent = el('div', {class:'home-cap-content'});
  capContent.appendChild(el('div', {class:'home-cap-eyebrow', text:'POR QUE A ORBE'}));
  const capBar = el('div', {class:'home-capabilities'});
  // Terceiro item reescrito (adendo rodada 10, seção 4) -- reflete um
  // agente de IA conversacional, não uma consultoria tradicional.
  [
    {icon:'shield', color:'var(--ink)', title:'Metodologia DEXi', text:'Modelo reconhecido internacionalmente'},
    {icon:'spark', color:'var(--green)', title:'Inteligência Artificial', text:'Para análises mais profundas e personalizadas'},
    {icon:'chat', color:'var(--blue)', title:'Diálogo conversacional', text:'Um agente de IA que interpreta e conversa sobre o diagnóstico com você.'},
  ].forEach((it) => {
    const item = el('div', {class:'home-cap-item'});
    item.appendChild(icon(it.icon, {class:'home-cap-icon', color: it.color, size: 24}));
    const txt = el('div');
    txt.appendChild(el('div', {class:'home-cap-title', text: it.title}));
    txt.appendChild(el('div', {class:'home-cap-text', text: it.text}));
    item.appendChild(txt);
    capBar.appendChild(item);
  });
  capContent.appendChild(capBar);
  capSection.appendChild(capContent);

  return homeShell('home', [hero, entrySection, capSection]);
}

// Card 1 -- "Conhecer a ORBE": explicação simples do que é a ferramenta, o
// problema que resolve, o papel da IA e a base metodológica, com uma
// camada opcional mais detalhada (adendo rodada 9, seção 3).
function screenAbout(){
  const c = el('div');
  c.appendChild(el('div', {class:'home-hero-eyebrow', text:'CONHECER A ORBE'}));
  c.appendChild(el('h1', {class:'home-hero-title', text:'Mais do que um diagnóstico.'}));
  c.appendChild(el('p', {class:'home-hero-body', text:'A ORBE é uma parceira digital que ajuda organizações a entender onde estão na jornada de transformação digital -- e o que fazer a partir disso. Ela junta um modelo de avaliação estruturado, uma leitura interpretativa apoiada por IA e um espaço para transformar isso em ação.'}));

  const card1 = el('div', {class:'card'});
  card1.appendChild(el('h2', {text:'O problema que a ORBE resolve'}));
  card1.appendChild(el('p', {text:'Muitas organizações sabem que precisam evoluir digitalmente, mas não têm um retrato claro de onde estão hoje -- nem por onde começar. Avaliações informais tendem a ser subjetivas, difíceis de comparar ao longo do tempo, e raramente conectam o diagnóstico a passos concretos.'}));
  c.appendChild(card1);

  const card2 = el('div', {class:'card'});
  card2.appendChild(el('h2', {text:'O papel da inteligência artificial'}));
  card2.appendChild(el('p', {text:'A IA nunca calcula o resultado da sua organização -- isso é sempre feito pelo modelo DEXi, de forma determinística e rastreável. O papel da IA é conduzir a coleta de forma conversacional, ajudar a interpretar o que o resultado oficial significa na prática, e sugerir possibilidades de evolução -- sempre separando claramente o que é dado oficial do que é interpretação ou sugestão.'}));
  c.appendChild(card2);

  const card3 = el('div', {class:'card'});
  card3.appendChild(el('h2', {text:'A base metodológica'}));
  card3.appendChild(el('p', {text:'A avaliação segue o modelo de maturidade digital proposto por Kljajić Borštnar e Pucihar (2021), estruturado com a metodologia DEX e processado na ferramenta DEXi -- um método de apoio à decisão multicritério, hierárquico e qualitativo, amplamente usado em pesquisa aplicada.'}));

  const details = el('details', {class:'home-about-details'});
  details.appendChild(el('summary', {text:'Quero entender melhor (camada opcional, mais técnica)'}));
  const detailsBody = el('div', {class:'home-about-details-body'});
  detailsBody.appendChild(el('p', {text:'O modelo organiza a maturidade digital em duas capacidades -- Capacidade Digital e Capacidade Organizacional -- cada uma formada por grupos intermediários (ex.: Tecnologia Digital, Papel da TI, Recursos Humanos, Cultura Organizacional), que por sua vez agregam 34 atributos básicos avaliados diretamente com a organização. Cada atributo e cada nível agregado tem uma escala qualitativa própria (ex.: "Baixo / Médio-baixo / Médio-alto / Alto"), definida em tabelas de decisão dentro do DEXi -- nunca um número calculado por fora. Essa é a razão pela qual o resultado final é sempre extraído do DEXi, nunca recalculado por IA: a metodologia depende dessas tabelas para ser consistente e comparável.'}));
  details.appendChild(detailsBody);
  card3.appendChild(details);
  c.appendChild(card3);

  // Atribuição acadêmica (pedido do usuário): a ORBE é o produto de uma
  // dissertação de mestrado real, não um projeto anônimo -- mesma
  // informação já usada na abertura da Etapa 1, com links para as
  // instituições oficiais.
  const card4 = el('div', {class:'card'});
  card4.appendChild(el('h2', {text:'Quem está por trás da ORBE'}));
  card4.appendChild(el('p', {text:'A ORBE é uma pesquisa aplicada desenvolvida por Welerson Carvalho Coelho, sob orientação do Prof. Dr. Darlinton Barbosa Feres Carvalho, no âmbito do PROFNIT -- Programa de Pós-Graduação em Propriedade Intelectual e Transferência de Tecnologia para Inovação, ponto focal UFSJ (Universidade Federal de São João del-Rei). O modelo de avaliação segue a metodologia de maturidade digital proposta por Kljajić Borštnar e Pucihar (2021).'}));
  const linksRow = el('div', {class:'home-about-links'});
  linksRow.appendChild(el('a', {href:'https://profnit.org.br', target:'_blank', rel:'noopener', text:'PROFNIT →'}));
  linksRow.appendChild(el('a', {href:'https://ufsj.edu.br', target:'_blank', rel:'noopener', text:'UFSJ →'}));
  card4.appendChild(linksRow);
  c.appendChild(card4);

  const btnRow = el('div', {class:'btn-row'});
  btnRow.appendChild(el('button', {class:'btn secondary', text:'← Voltar à Início', onclick: goToHome}));
  btnRow.appendChild(el('button', {class:'btn', text:'Começar diagnóstico →', onclick: () => { state.screen = 'intro'; render(); }}));
  c.appendChild(btnRow);

  return homeShell('about', [c]);
}

// ---------- Etapa 1: coleta conversacional ----------

// Textos de abertura e de contextualização da organização: cópia exata do
// adendo_especificacao_rodada4.md (seções 3 e 5) -- texto oficial do
// pesquisador, nunca reescrito.
function screenIntro(){
  const c = el('div');
  // Logo na tela de abertura (adendo rodada 5, seção 3) -- o mesmo arquivo
  // fornecido, só redimensionado por CSS; envolvido num cartão branco
  // porque o PNG tem fundo branco embutido e a Etapa 1 usa fundo cinza
  // (--etapa1-bg), evitando um retângulo branco "solto" sobre o cinza.
  const logoHero = el('div', {class:'intro-logo'});
  logoHero.appendChild(el('img', {class:'intro-logo-img', src:'/assets/brand/orbe_lockup_branco.png', alt:'ORBE — Maturidade Digital'}));
  c.appendChild(logoHero);
  c.appendChild(el('div', {class:'eyebrow brand', text:'Diagnóstico de Maturidade Digital'}));
  c.appendChild(el('h1', {text:'Onde sua organização está na jornada digital?'}));
  c.appendChild(el('p', {class:'lede', text:'Responda 34 perguntas e descubra seu estágio de maturidade digital.'}));
  c.appendChild(el('p', {text:'A avaliação considera tecnologia, processos, pessoas, gestão e inovação e, ao final, apresenta um diagnóstico estruturado para ajudar a entender os principais pontos de atenção e evolução.'}));
  c.appendChild(el('p', {class:'caption-line', text:'34 perguntas · 15–25 min · diagnóstico estruturado'}));
  c.appendChild(el('p', {class:'caption-line', text:'Pesquisa aplicada desenvolvida no âmbito do PROFNIT — UFSJ, por Welerson Carvalho Coelho, sob orientação do Prof. Dr. Darlinton Barbosa Feres Carvalho, com base em Kljajić Borštnar e Pucihar (2021) e processamento pelo DEXi.'}));

  const card = el('div', {class:'card'});
  card.appendChild(el('label', {text:'Nome da organização'}));
  const nameInput = el('input', {type:'text', placeholder:'ex.: MetalLamina Indústria Ltda.', id:'orgNameInput', value: state.orgName});
  card.appendChild(nameInput);

  card.appendChild(el('h2', {text:'Conte um pouco sobre sua organização', style:'margin-top:28px;'}));
  card.appendChild(el('p', {text:'Antes de começarmos, queremos entender brevemente o contexto da organização que será avaliada. Conte, com suas próprias palavras, o que a organização faz, em qual setor ou mercado atua, quais são suas principais atividades, seu porte ou número aproximado de colaboradores.'}));
  card.appendChild(el('p', {text:'Não precisa ser formal nem detalhado. Escreva como você explicaria sua empresa para alguém que acabou de conhecê-la.'}));
  card.appendChild(el('p', {text:'Essas informações serão utilizadas apenas para contextualizar a conversa e tornar as perguntas mais adequadas à realidade da organização. Não é necessário fornecer informações confidenciais, dados financeiros detalhados ou uma descrição formal da empresa.'}));

  const example = el('div', {class:'example-box'});
  example.appendChild(el('div', {class:'example-label', text:'Exemplo'}));
  example.appendChild(el('div', {class:'example-text', text:'A MetalNova é uma indústria de médio porte localizada em São João del Rei-MG, que atua no setor metalúrgico. A empresa fabrica componentes metálicos para outras indústrias e possui aproximadamente 150 colaboradores. Atualmente, possui uma estrutura de produção tradicional e vem buscando ampliar o uso de tecnologias digitais em seus processos.'}));
  card.appendChild(example);

  const ctxInput = el('textarea', {placeholder:'Escreva aqui sobre sua organização...', id:'orgCtxInput'});
  ctxInput.value = state.orgContext;
  card.appendChild(ctxInput);

  const btnRow = el('div', {class:'btn-row'});
  btnRow.appendChild(el('button', {class:'btn', text:'Começar agora →', onclick: () => {
    const name = nameInput.value.trim();
    if(!name){ nameInput.style.borderColor = '#B33'; nameInput.focus(); return; }
    state.orgName = name;
    state.orgContext = ctxInput.value.trim();
    goToAttribute(nextUnansweredIndex());
  }}));
  card.appendChild(btnRow);
  c.appendChild(card);
  return c;
}

function nextUnansweredIndex(){
  for(let i = 0; i < ATTRS.length; i++){
    if(!state.answers[ATTRS[i].id]) return i;
  }
  return ATTRS.length;
}

function hasFullCollectionData(){
  return ATTRS.length > 0 && ATTRS.every(a => !!state.answers[a.id]);
}

function goToAttribute(idx, opts){
  opts = opts || {};
  if(idx >= ATTRS.length){ state.screen = 'done1'; render(); return; }
  state.idx = idx;
  state.screen = 'collect';
  state.editingFromReview = !!opts.fromReview;
  render();
}

// Bloco 3 -- as 4 alternativas oficiais, sempre visíveis como cards
// clicáveis (nunca gated atrás de uma decisão da IA). O rótulo mostrado é
// o texto de exibição (mapeamento_exibicao_rascunho.json, via /api/attrs);
// o valor registrado ao clicar é sempre o valor técnico exato.
function renderAlternatives(attr){
  const opts = el('div', {class:'options'});
  const niveisExibicao = attr.niveisExibicao || attr.niveis;
  attr.niveis.forEach((lvl, i) => {
    const selected = state.answers[attr.id] === lvl;
    const btn = el('div', {class:'opt' + (selected ? ' opt-selected' : ''), onclick: () => registerAnswer(attr.id, lvl)});
    btn.appendChild(el('div', {class:'num', text: String(i+1)}));
    btn.appendChild(el('div', {text: niveisExibicao[i]}));
    opts.appendChild(btn);
  });
  return opts;
}

function screenCollect(){
  const c = el('div');
  c.appendChild(stepsNav(0));
  const attr = ATTRS[state.idx];
  const answeredCount = Object.keys(state.answers).length;

  c.appendChild(el('div', {class:'progress-label', text:`Atributo ${state.idx+1} de ${ATTRS.length} · ${attr.dimensao}`}));
  const track = el('div', {class:'progress-track'});
  track.appendChild(el('div', {class:'progress-fill', style:`width:${Math.round((answeredCount/ATTRS.length)*100)}%`}));
  c.appendChild(track);

  // Bloco 1 -- pergunta oficial, literal, seca. Vem de perguntas_oficiais.json
  // (attr.pergunta, via /api/attrs) -- NUNCA de attr.descricao, que é uma
  // anotação técnica interna do modelo, não a pergunta (bug corrigido,
  // adendo rodada 3). Nunca passa pela IA.
  const block1 = el('div', {class:'card block-official'});
  block1.appendChild(el('div', {class:'block-label', text:'Pergunta oficial'}));
  block1.appendChild(el('div', {class:'block-official-text', text: attr.pergunta}));
  c.appendChild(block1);

  // Bloco 2 -- explicação adaptada ao contexto da empresa, gerada pela IA.
  const block2 = el('div', {class:'card block-explain'});
  block2.appendChild(el('div', {class:'block-label', text: `O que isso significa para ${state.orgName}`}));
  if(state.explanations[attr.id]){
    block2.appendChild(el('div', {class:'block-explain-text', text: state.explanations[attr.id]}));
  } else if(state.explaining){
    block2.appendChild(el('div', {class:'block-explain-text'}, [
      el('span', {class:'spinner'}), el('span', {text:' pensando...', style:'margin-left:8px;'})
    ]));
  } else if(state.explainErrors[attr.id]){
    block2.appendChild(el('div', {class:'error-box', text: state.explainErrors[attr.id]}));
    block2.appendChild(el('button', {class:'btn secondary small', text:'Tentar novamente', style:'margin-top:10px;', onclick: () => ensureExplanation(attr)}));
  }
  c.appendChild(block2);

  // Bloco 3 -- as 4 alternativas oficiais.
  const block3 = el('div', {class:'card block-options'});
  block3.appendChild(el('div', {class:'block-label', text:'Escolha uma alternativa'}));
  block3.appendChild(renderAlternatives(attr));
  c.appendChild(block3);

  // Bloco 4 -- campo de conversa livre (dúvida ou resposta em texto). Texto
  // mais humano (adendo rodada 9, seção 4) -- só o texto ao redor do campo
  // muda, a lógica de interpretação da resposta livre continua a mesma.
  const block4 = el('div', {class:'card panel-duvidas'});
  block4.appendChild(el('div', {class:'block-label', text:'Ficou em dúvida sobre essa pergunta?'}));
  block4.appendChild(el('p', {class:'block-explain-text', style:'margin-bottom:14px;', text:'Você pode explicar com suas próprias palavras. A ORBE ajuda a entender sua resposta.'}));
  const chatLog = state.chatLogs[attr.id] || (state.chatLogs[attr.id] = []);
  if(chatLog.length){
    const chatBox = el('div', {class:'chat-log', style:'margin-bottom:16px;'});
    chatLog.forEach(m => {
      chatBox.appendChild(el('div', {class: 'bubble ' + (m.role === 'assistant' ? 'bubble-agent' : 'bubble-user'), text: m.text}));
    });
    block4.appendChild(chatBox);
  }
  if(state.thinking){
    block4.appendChild(el('div', {class:'bubble bubble-agent'}, [
      el('span', {class:'spinner'}), el('span', {text:' pensando...', style:'margin-left:8px;'})
    ]));
  } else {
    const inputRow = el('div', {class:'chat-input-row'});
    const textIn = el('input', {type:'text', placeholder:'Escreva sua dúvida ou sua resposta...', id:'chatTextInput'});
    textIn.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ sendUserTurn(textIn.value); } });
    const sendBtn = el('button', {class:'btn chat-send', text:'Enviar', onclick: () => sendUserTurn(textIn.value)});
    inputRow.appendChild(textIn);
    inputRow.appendChild(sendBtn);
    block4.appendChild(inputRow);
  }
  c.appendChild(block4);

  const nav = el('div', {class:'btn-row'});
  if(state.idx > 0){
    nav.appendChild(el('button', {class:'btn secondary', text:'← Voltar ao atributo anterior', onclick: () => { goToAttribute(state.idx - 1); }}));
  }
  nav.appendChild(el('button', {class:'btn secondary', text:'Revisar respostas', onclick: () => { state.screen = 'review'; render(); }}));
  c.appendChild(nav);

  if(!state.explanations[attr.id] && !state.explaining && !state.explainErrors[attr.id]){
    // setTimeout adia a chamada para depois deste render() terminar --
    // ensureExplanation chama render() de novo assim que começa, e
    // chamar isso ainda dentro da construção da tela atual duplicava o
    // conteúdo no DOM (o innerHTML='' do render aninhado rodava antes do
    // appendChild deste render() já estar pendurado).
    setTimeout(() => ensureExplanation(attr), 0);
  }
  return c;
}

// Bloco 2 -- gera a explicação adaptada ao contexto da empresa. Independe
// de qualquer clique/turno de conversa: carrega assim que o atributo abre.
async function ensureExplanation(attr){
  if(state.explanations[attr.id] || state.explaining) return;
  state.explaining = true;
  delete state.explainErrors[attr.id];
  render();
  try{
    const res = await fetch('/api/collect/explain', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ attrId: attr.id, orgName: state.orgName, orgContext: state.orgContext }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    state.explanations[attr.id] = data.message || '';
  } catch(err){
    state.explainErrors[attr.id] = 'Não consegui gerar uma explicação adaptada agora (' + err.message + '). Você já pode responder usando a pergunta oficial acima ou as alternativas abaixo.';
  }
  state.explaining = false;
  render();
}

function sendUserTurn(text){
  text = (text || '').trim();
  if(!text || state.thinking || state.turnInFlight) return;
  const attr = ATTRS[state.idx];
  state.chatLogs[attr.id].push({role:'user', text});
  render();
  callAgentTurn();
}

async function callAgentTurn(){
  state.thinking = true;
  state.turnInFlight = true;
  render();
  const attr = ATTRS[state.idx];
  try{
    const res = await fetch('/api/collect/turn', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        attrId: attr.id,
        orgName: state.orgName,
        orgContext: state.orgContext,
        history: state.chatLogs[attr.id],
      }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));

    if(data.action === 'register' && data.chosen){
      if(data.message) state.chatLogs[attr.id].push({role:'assistant', text: data.message});
      state.thinking = false;
      state.turnInFlight = false;
      registerAnswer(attr.id, data.chosen);
      return;
    }
    state.chatLogs[attr.id].push({role:'assistant', text: data.message || ''});
  } catch(err){
    state.chatLogs[attr.id].push({role:'assistant', text: 'Não consegui processar essa dúvida automaticamente (' + err.message + '). Você pode continuar escolhendo diretamente uma das alternativas acima.'});
  }
  state.thinking = false;
  state.turnInFlight = false;
  render();
}

function registerAnswer(id, val){
  state.answers[id] = val;
  state.registro[id] = { id, resposta: val, conversa: (state.chatLogs[id] || []).slice() };

  if(state.editingFromReview){
    state.editingFromReview = false;
    state.screen = 'review';
    render();
    return;
  }
  goToAttribute(nextUnansweredIndex());
}

function screenReview(){
  const c = el('div');
  c.appendChild(stepsNav(0));
  c.appendChild(el('h1', {text:'Revisar respostas.'}));
  c.appendChild(el('p', {class:'lede', text:'Clique em qualquer atributo para mudar a resposta — isso não afeta os outros atributos já registrados.'}));

  const card = el('div', {class:'card'});
  const list = el('ul', {class:'review-list'});
  ATTRS.forEach((a, i) => {
    const val = state.answers[a.id];
    const li = el('li', {onclick: () => goToAttribute(i, {fromReview: true}), style:'cursor:pointer;'});
    li.appendChild(el('div', {class:'rl-name', text: `${i+1}. ${a.id}`}));
    li.appendChild(el('div', {class: 'rl-val' + (val ? '' : ' empty'), text: val || 'não respondido'}));
    list.appendChild(li);
  });
  card.appendChild(list);
  c.appendChild(card);

  const btnRow = el('div', {class:'btn-row'});
  btnRow.appendChild(el('button', {class:'btn', text:'← Voltar à coleta', onclick: () => { goToAttribute(nextUnansweredIndex()); }}));
  c.appendChild(btnRow);
  return c;
}

function screenDone1(){
  const c = el('div');
  c.appendChild(stepsNav(0));
  c.appendChild(el('h1', {text:'Coleta concluída.'}));
  const answered = Object.keys(state.answers).length;
  c.appendChild(el('p', {class:'lede', text: `${answered} de ${ATTRS.length} atributos registrados para ${state.orgName}. Baixe os arquivos abaixo para levar ao DEXi.`}));

  const card = el('div', {class:'card'});
  card.appendChild(el('h2', {text:'Arquivos para exportação'}));
  const btnRow = el('div', {class:'btn-row'});
  btnRow.appendChild(el('button', {class:'btn', text:'Baixar .dxi (pronto para o DEXi)', onclick: downloadDxi}));
  btnRow.appendChild(el('button', {class:'btn secondary', text:'Baixar CSV', onclick: downloadCSV}));
  btnRow.appendChild(el('button', {class:'btn secondary', text:'Baixar JSON estruturado', onclick: downloadJSON}));
  card.appendChild(btnRow);
  const dxiMsg = el('div', {id:'dxiMsg'});
  card.appendChild(dxiMsg);
  card.appendChild(el('div', {class:'note', text:'O .dxi é gerado editando o template original como texto, preservando aspas duplas e quebra de linha originais — os 34 atributos básicos recebem o índice da resposta; os 17 agregados e a raiz continuam como "*", para o DEXi calcular ao rodar "Evaluate".'}));
  c.appendChild(card);

  c.appendChild(el('div', {class:'btn-row'}, [
    el('button', {class:'btn secondary', text:'← Revisar respostas', onclick: () => { state.screen = 'review'; render(); }}),
    el('button', {class:'btn', text:'Próximo passo →', onclick: () => { state.screen = 'manual'; render(); }}),
  ]));
  return c;
}

async function downloadDxi(){
  const msg = document.getElementById('dxiMsg');
  try{
    const template = await decodeTemplate();
    const filled = fillDxi(template, state.orgName, state.answers, ATTRS);
    const v = validateDxi(filled);
    downloadBlob(filled, state.orgName.replace(/\s+/g,'_') + '.dxi', 'application/xml');
    msg.innerHTML = '';
    if(!v.declOk || v.starCount !== v.expectedStars){
      msg.appendChild(el('div', {class:'error-box', text:
        `Arquivo baixado, mas a validação encontrou algo fora do esperado (declaração XML ok: ${v.declOk}, agregados como "*": ${v.starCount}/${v.expectedStars}) — confira com atenção antes de importar no DEXi.`}));
    } else {
      msg.appendChild(el('div', {class:'file-ok', text: `Validado: declaração XML correta, ${v.starCount} de ${v.expectedStars} atributos agregados mantidos como "*" para o DEXi calcular.`}));
    }
  } catch(err){
    msg.innerHTML = '';
    msg.appendChild(el('div', {class:'error-box', text: 'Não consegui gerar o .dxi: ' + err.message}));
  }
}

function toCSV(){
  const header = ATTRS.map(a => a.id).join(',');
  const row = ATTRS.map(a => state.answers[a.id] || '').join(',');
  return header + '\n' + row;
}

function toJSON(){
  return JSON.stringify({
    organizacao: state.orgName,
    contexto_organizacao: state.orgContext,
    respostas: state.answers,
    registro_completo: ATTRS.map(a => state.registro[a.id]).filter(Boolean),
  }, null, 2);
}

function downloadBlob(content, filename, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function downloadCSV(){ downloadBlob(toCSV(), state.orgName.replace(/\s+/g,'_') + '.csv', 'text/csv'); }
function downloadJSON(){ downloadBlob(toJSON(), state.orgName.replace(/\s+/g,'_') + '.json', 'application/json'); }

// ---------- Etapa 2: instrução manual ----------

function screenManual(){
  const c = el('div');
  c.appendChild(stepsNav(1));
  c.appendChild(el('div', {class:'eyebrow', text:'Etapa manual — fora desta ferramenta'}));
  c.appendChild(el('h1', {text:'Agora é a vez do DEXi.'}));
  c.appendChild(el('p', {class:'lede', text:'Esta etapa não é automatizada de propósito — o DEXi continua sendo o responsável oficial pelo cálculo da maturidade.'}));

  const card = el('div', {class:'card'});
  const list = el('ul', {class:'list-check'});
  ['Abra o DEXi 5.06 no seu computador.',
   'Importe o arquivo CSV (ou o .dxi já preenchido, se você tiver um).',
   'Rode "Evaluate" para calcular o diagnóstico.',
   'Exporte o relatório — pode ser como texto, PDF ou os valores copiados diretamente.',
   'Volte aqui e carregue esse resultado na próxima etapa.'
  ].forEach(t => list.appendChild(el('li', {text:t})));
  card.appendChild(list);
  c.appendChild(card);

  c.appendChild(el('div', {class:'btn-row'}, [
    el('button', {class:'btn secondary', text:'← Voltar', onclick: () => { state.screen = 'done1'; render(); }}),
    el('button', {class:'btn', text:'Já tenho o resultado →', onclick: () => { state.screen = 'upload'; render(); }}),
  ]));
  return c;
}

// ---------- Etapa 3: upload do resultado + interpretação ----------

function arrayBufferToBase64(buf){
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for(let i = 0; i < bytes.length; i += chunkSize){
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// O DEXi exporta o resultado em PDF -- extrai o texto no backend (o
// navegador não lê PDF nativamente) e usa esse texto como se fosse o
// conteúdo colado/carregado normalmente.
async function extractPdfText(file, okMsgEl, textareaEl){
  try{
    const buf = await file.arrayBuffer();
    const pdfBase64 = arrayBufferToBase64(buf);
    const res = await fetch('/api/extract-pdf', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ pdfBase64 }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    state.dexiText = data.text;
    textareaEl.value = data.text;
    okMsgEl.textContent = 'PDF processado: ' + file.name;
  } catch(err){
    okMsgEl.textContent = '';
    state.uploadError = 'Não consegui extrair o texto do PDF (' + err.message + '). Você pode copiar o texto do PDF manualmente e colar no campo abaixo.';
    render();
  }
}

function screenUpload(){
  const c = el('div');
  // Caminho 3 da Home pula a Etapa 1 inteira -- os "3 passos" (Coleta/Rodar
  // no DEXi/Resultado) não se aplicam a essa entrada direta.
  if(!state.skipCollection) c.appendChild(stepsNav(2));
  c.appendChild(el('h1', {text: state.skipCollection ? 'Acesse seu diagnóstico.' : 'Carregue o resultado do DEXi.'}));
  c.appendChild(el('p', {class:'lede', text:'Cole o texto do relatório, ou carregue um arquivo .txt/.json/.csv/.pdf com o resultado -- inclusive o PDF exportado direto pelo DEXi.'}));

  // Etapa 1 é pulada nesse caminho -- é onde o nome da organização normalmente
  // seria coletado, então precisa de um campo próprio aqui.
  let orgNameInput = null;
  if(state.skipCollection){
    const orgCard = el('div', {class:'card'});
    orgCard.appendChild(el('label', {text:'Nome da organização'}));
    orgNameInput = el('input', {type:'text', placeholder:'ex.: MetalLamina Indústria Ltda.', value: state.orgName});
    orgCard.appendChild(orgNameInput);
    c.appendChild(orgCard);
  }

  const card = el('div', {class:'card'});

  // Campo único (adendo rodada 11, seção 5): antes eram duas áreas de
  // upload separadas (JSON da coleta / resultado do DEXi). O conteúdo dos
  // dois tipos nunca é ambíguo -- só o JSON da coleta tem a chave
  // "respostas" -- então dá pra reconhecer automaticamente qual é qual a
  // partir do próprio conteúdo do arquivo, sem precisar de duas áreas.
  const needsColeta = !hasFullCollectionData();
  if(needsColeta){
    card.appendChild(el('label', {text: state.skipCollection
      ? 'O resultado do DEXi é obrigatório; o JSON da coleta desta avaliação é opcional (enriquece a leitura no Insights) -- envie um de cada vez, na mesma área abaixo'
      : 'Carregue o resultado do DEXi e, se ainda não tiver enviado nesta sessão, o JSON da coleta (baixado ao final da Etapa 1) -- um de cada vez, na mesma área'}));
  }

  const zone = el('div', {class:'upload-zone'});
  zone.appendChild(el('div', {class:'icon', text:'⇪'}));
  zone.appendChild(el('div', {text:'Clique para escolher um arquivo (.txt, .json, .csv, .pdf)'}));
  const fileInput = el('input', {type:'file', accept:'.txt,.json,.csv,.pdf', onchange: (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const isPdf = f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
    if(isPdf){
      // Feedback de carregamento (adendo rodada 10, seção 2) -- mesmo padrão
      // spinner + texto já usado no resto da aplicação.
      okMsg.innerHTML = '';
      okMsg.appendChild(el('span', {class:'spinner'}));
      okMsg.appendChild(el('span', {text:' Extraindo texto de ' + f.name + '...', style:'margin-left:8px;'}));
      extractPdfText(f, okMsg, textarea);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // Só é o JSON da coleta se tiver a chave "respostas" -- qualquer
      // outro conteúdo (inclusive um .json que seja o próprio resultado
      // do DEXi) vai para o campo de texto, nunca fica ambíguo.
      let data = null;
      try{ data = JSON.parse(reader.result); } catch(err){ /* não é JSON -- segue como texto do DEXi */ }
      if(data && data.respostas){
        state.orgName = data.organizacao || state.orgName;
        state.orgContext = data.contexto_organizacao || state.orgContext;
        state.answers = Object.assign({}, state.answers, data.respostas);
        (data.registro_completo || []).forEach(r => { if(r && r.id) state.registro[r.id] = r; });
        state.collectionSourceLoaded = true;
        state.uploadError = '';
        okMsg.textContent = 'Coleta carregada: ' + state.orgName;
        render();
        return;
      }
      state.dexiText = reader.result;
      okMsg.textContent = 'Arquivo carregado: ' + f.name;
      textarea.value = reader.result;
    };
    reader.readAsText(f);
  }});
  zone.appendChild(fileInput);
  zone.addEventListener('click', () => fileInput.click());
  const okMsg = el('div', {class:'file-ok'});
  card.appendChild(zone);
  card.appendChild(okMsg);
  // Confirmação persistente (sobrevive ao render() disparado pelo próprio
  // upload, diferente de escrever só em okMsg -- a tela inteira é recriada
  // do zero a cada render, então texto solto em okMsg não sobrevive).
  if(state.collectionSourceLoaded){
    card.appendChild(el('div', {class:'file-ok', text: 'Coleta carregada: ' + state.orgName}));
  }

  card.appendChild(el('label', {text:'Ou cole o texto do relatório aqui', style:'margin-top:18px;'}));
  const textarea = el('textarea', {placeholder:'Cole aqui o resultado do DEXi (classificação final, dimensões, atributos)...', style:'min-height:160px;'});
  textarea.value = state.dexiText;
  card.appendChild(textarea);
  c.appendChild(card);

  if(state.uploadError){
    c.appendChild(el('div', {class:'error-box', text: state.uploadError}));
  }

  // Aviso discreto (nunca um alerta de abertura, adendo rodada 9, seção 3):
  // sem a coleta, o Insights ainda explica o resultado oficial do DEXi
  // normalmente, só não consegue cruzar com "o que a organização
  // respondeu" na rastreabilidade -- some sozinho se um JSON de coleta
  // acabar sendo carregado de qualquer forma.
  if(state.skipCollection && !hasFullCollectionData()){
    c.appendChild(el('div', {class:'note', text:'Sem o registro da coleta, o Insights explica o resultado oficial do DEXi normalmente, mas não consegue mostrar as respostas e evidências originais da organização na rastreabilidade.'}));
  }

  const btnRow = el('div', {class:'btn-row'});
  btnRow.appendChild(el('button', {class:'btn secondary', text:'← Voltar', onclick: () => {
    state.screen = state.skipCollection ? 'home' : 'manual';
    render();
  }}));
  const canProceed = () => hasFullCollectionData() || state.skipCollection;
  const genBtn = el('button', {class:'btn', text:'Ver relatório →'});
  genBtn.addEventListener('click', () => {
    // Sincroniza com o state ANTES de qualquer validação -- uma falha de
    // validação chama render(), que recria os campos do zero a partir do
    // state; sem isso, o texto colado (ou o nome digitado) some da tela a
    // cada tentativa que falhar, mesmo sem nenhum erro do usuário nesse
    // campo específico (bug real, pego ao testar o nome da organização).
    const text = textarea.value.trim();
    state.dexiText = text;
    if(orgNameInput) state.orgName = orgNameInput.value.trim();

    if(orgNameInput && !state.orgName){ state.uploadError = 'Informe o nome da organização antes de continuar.'; render(); return; }
    if(!text){ state.uploadError = 'Cole o resultado do DEXi ou carregue um arquivo antes de continuar.'; render(); return; }
    if(!canProceed()){ state.uploadError = 'Carregue o JSON da coleta desta organização antes de continuar — ele não está disponível nesta sessão.'; render(); return; }
    state.uploadError = '';
    state.panel = null; state.panelError = '';
    if(typeof resetCockpitState === 'function') resetCockpitState();
    state.screen = 'report';
    render();
  });
  btnRow.appendChild(genBtn);
  c.appendChild(btnRow);
  return c;
}

// ---------- Etapa 3: painel visual (adendo rodada 3) ----------
// (a) status geral, (b) gráficos das duas dimensões e dos grupos, (c)
// panorama da coleta, (d) centro de dúvidas (conversa, agora só uma seção
// do painel), (e) centro de aprendizado. Status e gráficos vêm sempre do
// resultado oficial do DEXi (extraídos, nunca recalculados); panorama vem
// direto das respostas da coleta; aprendizado e dúvidas são gerados por IA.

// Consistência dos 34 atributos -- não depende da IA nem da extração do
// painel, então nunca deve ficar refém de uma falha de API (ver bug real:
// exportar o PDF sem o painel ter conseguido extrair nada fazia o rótulo
// "consistenciaOk" cair para false por padrão, sinalizando uma divergência
// que não existia de verdade).
function computeConsistencia(){
  return ATTRS.every(a => {
    const val = state.answers[a.id];
    return val && a.niveis.includes(val);
  });
}

// Rótulo legível de um attr.id (ex. "Industria.4.0" -> "Industria 4.0") --
// mesma limpeza cosmética defensiva do displayMap.js (só troca ponto por
// espaço, nunca adivinha acento). attr.id já é mostrado ao usuário em outros
// pontos do painel (review-list, panorama) -- nunca attr.descricao, que é
// uma anotação técnica interna (ver bug corrigido na rodada 3).
function humanizeAttrId(id){
  return String(id).replace(/\./g, ' ');
}

// (1.2) Lista visual de atributos em destaque: melhor/pior posição de cada
// atributo dentro da PRÓPRIA escala de 4 níveis (mesma leitura já usada em
// computePanorama() desde a rodada 3) -- nunca uma nota comparável entre
// atributos diferentes, e sempre rastreável até a resposta real da coleta.
function pontosDestaqueLists(){
  const fortes = [], atencao = [];
  ATTRS.forEach((a) => {
    const val = state.answers[a.id];
    if(!val) return;
    const idx = a.niveis.indexOf(val);
    const label = (a.niveisExibicao && a.niveisExibicao[idx]) || val;
    if(idx === a.niveis.length - 1) fortes.push({ attr: a, label });
    else if(idx === 0) atencao.push({ attr: a, label });
  });
  return { fortes, atencao };
}

function computePanorama(){
  const total = ATTRS.length;
  let respondidos = 0;
  const maisBaixas = [], maisAltas = [];
  ATTRS.forEach(a => {
    const val = state.answers[a.id];
    if(!val) return;
    respondidos++;
    const idx = a.niveis.indexOf(val);
    if(idx === 0) maisBaixas.push(a.id);
    if(idx === a.niveis.length - 1) maisAltas.push(a.id);
  });
  return { respondidos, total, maisBaixas, maisAltas };
}

// Extração do resultado oficial do DEXi (nível final, duas capacidades,
// grupos) -- base de dados compartilhada pelas três seções do Cockpit
// (Panorama, Insights e Roadmap partem todos daqui, nunca recalculam).
async function ensurePanel(){
  if(state.panel || state.panelLoading) return;
  state.panelLoading = true;
  state.panelError = '';
  render();
  try{
    const res = await fetch('/api/interpret/extract', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ orgName: state.orgName, answers: state.answers, dexiText: state.dexiText }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    state.panel = data;
  } catch(err){
    state.panelError = 'Não consegui extrair o resultado oficial do DEXi (' + err.message + ').';
  }
  state.panelLoading = false;
  render();
  if(state.panel && typeof onPanelReady === 'function') onPanelReady();
}

async function downloadPanelPdf(){
  if(state.pdfExporting) return;
  state.pdfExporting = true;
  state.pdfExportError = '';
  render();
  try{
    const res = await fetch('/api/interpret/export-pdf', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        orgName: state.orgName,
        orgContext: state.orgContext,
        dexiText: state.dexiText,
        nivelFinalLabel: state.panel && state.panel.nivelFinalLabel,
        capDigitalLabel: state.panel && state.panel.capDigitalLabel,
        capOrganizacionalLabel: state.panel && state.panel.capOrganizacionalLabel,
        grupos: (state.panel && state.panel.grupos) || [],
        panorama: computePanorama(),
        temas: typeof pdfTemasFromRoadmap === 'function' ? pdfTemasFromRoadmap() : [],
        consistenciaOk: state.panel ? state.panel.consistencia.completo : computeConsistencia(),
      }),
    });
    if(!res.ok){
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || ('Erro ' + res.status));
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (state.orgName || 'diagnostico').replace(/\s+/g,'_') + '_diagnostico.pdf';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch(err){
    state.pdfExportError = 'Não consegui gerar o PDF: ' + err.message;
  }
  state.pdfExporting = false;
  render();
}

// ---------- boot ----------

async function boot(){
  try{
    const [attrsRes, modelRes] = await Promise.all([fetch('/api/attrs'), fetch('/api/dexi-model')]);
    const attrsData = await attrsRes.json();
    const modelData = await modelRes.json();
    ATTRS = attrsData.attrs;
    DEXI_MODEL = modelData;
  } catch(err){
    document.getElementById('app').innerHTML = '';
    document.getElementById('app').appendChild(el('div', {class:'error-box', text:'Não consegui carregar os dados do servidor. Recarregue a página.'}));
    return;
  }
  state.screen = 'home';
  render();
}

// Logo do cabeçalho sempre clicável -> Início (adendo rodada 10, seção 1:
// navegação coerente e sempre disponível, padrão comum de "clicar no logo
// volta pra home"). O cabeçalho é HTML estático (não recriado a cada
// render()), então o listener é preso uma única vez aqui.
document.getElementById('siteHeader').addEventListener('click', goToHome);

boot();
