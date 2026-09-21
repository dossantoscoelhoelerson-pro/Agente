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

  // Painel da Etapa 3 (adendo rodada 3) -- ver funções ensurePanel/ensureLearning.
  panel: null,          // {nivelFinal, nivelFinalLabel, capDigital, capDigitalLabel, capOrganizacional, capOrganizacionalLabel, grupos, consistencia}
  panelLoading: false,
  panelError: '',
  learning: null,        // {temas, pontosAtencao}
  learningLoading: false,
  learningError: '',
  pdfExporting: false,
  pdfExportError: '',

  duvidasChat: [],
  duvidasThinking: false,
  duvidasError: '',

  // Navegação do painel da Etapa 3 (adendo rodada 5) -- abas + grupo aberto
  // no detalhamento sob demanda (item 1.1).
  reportTab: 'diagnostico',
  reportExpandedGroup: null,
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
  logoHero.appendChild(el('img', {class:'intro-logo-img', src:'/assets/brand/orbe_lockup_branco.png', alt:'ORBE — Visão integrada'}));
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

  // Bloco 4 -- campo de conversa livre (dúvida ou resposta em texto).
  const block4 = el('div', {class:'card panel-duvidas'});
  block4.appendChild(el('div', {class:'block-label', text:'Dúvida ou resposta livre'}));
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
  c.appendChild(stepsNav(2));
  c.appendChild(el('h1', {text:'Carregue o resultado do DEXi.'}));
  c.appendChild(el('p', {class:'lede', text:'Cole o texto do relatório, ou carregue um arquivo .txt/.json/.csv/.pdf com o resultado -- inclusive o PDF exportado direto pelo DEXi.'}));

  const card = el('div', {class:'card'});

  if(!hasFullCollectionData()){
    card.appendChild(el('label', {text:'Sessão nova — carregue também o JSON da coleta (baixado ao final da Etapa 1)'}));
    const collZone = el('div', {class:'upload-zone'});
    collZone.appendChild(el('div', {class:'icon', text:'⇪'}));
    collZone.appendChild(el('div', {text:'Clique para escolher o JSON da coleta'}));
    const collInput = el('input', {type:'file', accept:'.json', onchange: (e) => {
      const f = e.target.files[0];
      if(!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try{
          const data = JSON.parse(reader.result);
          if(!data.respostas) throw new Error('arquivo não tem o formato esperado (faltando "respostas")');
          state.orgName = data.organizacao || state.orgName;
          state.orgContext = data.contexto_organizacao || state.orgContext;
          state.answers = Object.assign({}, state.answers, data.respostas);
          (data.registro_completo || []).forEach(r => { if(r && r.id) state.registro[r.id] = r; });
          state.collectionSourceLoaded = true;
          state.uploadError = '';
          render();
        } catch(err){
          state.uploadError = 'Não consegui ler o JSON da coleta: ' + err.message;
          render();
        }
      };
      reader.readAsText(f);
    }});
    collZone.appendChild(collInput);
    collZone.addEventListener('click', () => collInput.click());
    card.appendChild(collZone);
    if(hasFullCollectionData()){
      card.appendChild(el('div', {class:'file-ok', text: 'Coleta carregada: ' + state.orgName}));
    }
    card.appendChild(el('div', {style:'height:18px;'}));
  }

  const zone = el('div', {class:'upload-zone'});
  zone.appendChild(el('div', {class:'icon', text:'⇪'}));
  zone.appendChild(el('div', {text:'Clique para escolher um arquivo (.txt, .json, .csv, .pdf)'}));
  const fileInput = el('input', {type:'file', accept:'.txt,.json,.csv,.pdf', onchange: (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    const isPdf = f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
    if(isPdf){
      okMsg.textContent = 'Extraindo texto de ' + f.name + '...';
      extractPdfText(f, okMsg, textarea);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
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

  card.appendChild(el('label', {text:'Ou cole o texto do relatório aqui', style:'margin-top:18px;'}));
  const textarea = el('textarea', {placeholder:'Cole aqui o resultado do DEXi (classificação final, dimensões, atributos)...', style:'min-height:160px;'});
  textarea.value = state.dexiText;
  card.appendChild(textarea);
  c.appendChild(card);

  if(state.uploadError){
    c.appendChild(el('div', {class:'error-box', text: state.uploadError}));
  }

  const btnRow = el('div', {class:'btn-row'});
  btnRow.appendChild(el('button', {class:'btn secondary', text:'← Voltar', onclick: () => { state.screen = 'manual'; render(); }}));
  const canProceed = () => hasFullCollectionData();
  const genBtn = el('button', {class:'btn', text:'Ver relatório →'});
  genBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if(!text){ state.uploadError = 'Cole o resultado do DEXi ou carregue um arquivo antes de continuar.'; render(); return; }
    if(!canProceed()){ state.uploadError = 'Carregue o JSON da coleta desta organização antes de continuar — ele não está disponível nesta sessão.'; render(); return; }
    state.dexiText = text;
    state.uploadError = '';
    state.panel = null; state.panelError = '';
    state.learning = null; state.learningError = '';
    state.duvidasChat = []; state.duvidasError = '';
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
    state.panelError = 'Não consegui extrair o status e os gráficos do resultado do DEXi (' + err.message + '). O panorama e o centro de dúvidas abaixo ainda funcionam a partir do texto carregado.';
  }
  state.panelLoading = false;
  render();
  if(state.panel) ensureLearning();
}

async function ensureLearning(){
  if(state.learning || state.learningLoading) return;
  state.learningLoading = true;
  state.learningError = '';
  render();
  try{
    const res = await fetch('/api/interpret/learning', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        orgName: state.orgName,
        orgContext: state.orgContext,
        answers: state.answers,
        capDigital: state.panel ? state.panel.capDigital : null,
        capOrganizacional: state.panel ? state.panel.capOrganizacional : null,
        grupos: state.panel ? state.panel.grupos : [],
      }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    state.learning = data;
  } catch(err){
    state.learningError = 'Não consegui gerar o centro de aprendizado agora (' + err.message + ').';
  }
  state.learningLoading = false;
  render();
}

async function duvidasTurn(userMessage){
  userMessage = (userMessage || '').trim();
  if(!userMessage || state.duvidasThinking) return;
  state.duvidasChat.push({role:'user', text: userMessage});
  const historySnapshot = state.duvidasChat.slice(0, -1);
  state.duvidasThinking = true;
  state.duvidasError = '';
  render();
  try{
    const res = await fetch('/api/interpret/turn', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        orgName: state.orgName,
        orgContext: state.orgContext,
        answers: state.answers,
        registroCompleto: ATTRS.map(a => state.registro[a.id]).filter(Boolean),
        dexiText: state.dexiText,
        history: historySnapshot,
        userMessage,
      }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    state.duvidasChat.push({role:'assistant', text: data.message});
  } catch(err){
    state.duvidasError = 'Não consegui gerar a resposta: ' + err.message;
  }
  state.duvidasThinking = false;
  render();
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
        temas: (state.learning && state.learning.temas) || [],
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

function statTile(value, label){
  const t = el('div', {class:'stat-tile'});
  t.appendChild(el('div', {class:'stat-value', text: value}));
  t.appendChild(el('div', {class:'stat-caption', text: label}));
  return t;
}

// (a) status geral -- grande, com o rótulo "Resultado oficial do DEXi"
// sempre visível, a posição na escala de 4 níveis, e (adendo rodada 5, item
// 1.3) o indicador circular unificado com o mesmo selo de classificação,
// em vez de aparecerem como elementos separados.
function sectionStatus(){
  const card = el('div', {class:'card panel-status'});
  card.appendChild(el('div', {class:'block-label', text:'Resultado oficial do DEXi'}));
  if(state.panelLoading && !state.panel){
    card.appendChild(el('div', {class:'block-explain-text'}, [
      el('span', {class:'spinner'}), el('span', {text:' analisando o resultado...', style:'margin-left:8px;'})
    ]));
    return card;
  }
  const nivelLabel = state.panel && state.panel.nivelFinalLabel;
  const idx = (DEXI_MODEL && state.panel && state.panel.nivelFinal) ? DEXI_MODEL.root.niveis.indexOf(state.panel.nivelFinal) : null;

  const row = el('div', {class:'status-hero-row'});
  const gaugeBox = el('div', {class:'status-gauge'});
  row.appendChild(gaugeBox);
  const textBox = el('div', {style:'flex:1; min-width:200px;'});
  textBox.appendChild(el('div', {class:'status-hero', text: nivelLabel || 'Não identificado no texto carregado'}));
  if(DEXI_MODEL){
    const track = el('div', {class:'scale-track'});
    DEXI_MODEL.root.niveisExibicao.forEach((lbl, i) => {
      track.appendChild(el('div', {class:'scale-seg' + (i === idx ? ' scale-seg-active' : ''), text: lbl}));
    });
    textBox.appendChild(track);
  }
  row.appendChild(textBox);
  card.appendChild(row);

  if(DEXI_MODEL){
    renderLevelGauge(gaugeBox, { levelLabel: nivelLabel, idx, total: DEXI_MODEL.root.niveis.length });
  }
  return card;
}

// (b) gráficos das duas dimensões e dos grupos intermediários.
function sectionCharts(){
  const card = el('div', {class:'card'});
  card.appendChild(el('div', {class:'block-label', text:'Gráficos'}));
  const grid = el('div', {class:'chart-grid'});

  const scatterWrap = el('div', {class:'chart-card'});
  scatterWrap.appendChild(el('div', {class:'chart-title', text:'Capacidade Digital × Capacidade Organizacional'}));
  const scatterBox = el('div', {class:'chart-box'});
  scatterWrap.appendChild(scatterBox);
  grid.appendChild(scatterWrap);

  const radarWrap = el('div', {class:'chart-card'});
  radarWrap.appendChild(el('div', {class:'chart-title', text:'Grupos intermediários'}));
  const radarBox = el('div', {class:'chart-box'});
  radarWrap.appendChild(radarBox);
  grid.appendChild(radarWrap);

  card.appendChild(grid);

  if(DEXI_MODEL && state.panel){
    const dimDigital = DEXI_MODEL.dimensoes.find(d => d.id === 'CAP.DIGITAL');
    const dimOrg = DEXI_MODEL.dimensoes.find(d => d.id === 'CAP.ORGANIZACIONAL');
    const xIdx = state.panel.capDigital ? dimDigital.niveis.indexOf(state.panel.capDigital) : null;
    const yIdx = state.panel.capOrganizacional ? dimOrg.niveis.indexOf(state.panel.capOrganizacional) : null;
    renderDimensionScatter(scatterBox, { xLabels: dimDigital.niveisExibicao, yLabels: dimOrg.niveisExibicao, xIdx, yIdx });

    const groups = DEXI_MODEL.grupos.map(g => {
      const found = state.panel.grupos.find(pg => pg.id === g.id);
      return { label: g.label, idx: found ? g.niveis.indexOf(found.nivel) : null, levelLabel: found ? found.nivelLabel : null };
    });
    renderGroupRadar(radarBox, groups);
  } else {
    scatterBox.appendChild(el('div', {class:'chart-empty-note', text: state.panelLoading ? 'Carregando...' : 'Sem dados ainda.'}));
    radarBox.appendChild(el('div', {class:'chart-empty-note', text: state.panelLoading ? 'Carregando...' : 'Sem dados ainda.'}));
  }
  return card;
}

// (c) panorama do processo -- a partir das respostas da coleta, nunca da IA.
function sectionPanorama(){
  const p = computePanorama();
  const card = el('div', {class:'card panel-panorama'});
  card.appendChild(el('div', {class:'block-label', text:'Panorama da coleta'}));
  const stats = el('div', {class:'stat-row'});
  stats.appendChild(statTile(`${p.respondidos}/${p.total}`, 'atributos respondidos'));
  stats.appendChild(statTile(String(p.maisBaixas.length), 'no nível mais baixo da própria escala'));
  stats.appendChild(statTile(String(p.maisAltas.length), 'no nível mais alto da própria escala'));
  card.appendChild(stats);
  if(p.maisBaixas.length){
    card.appendChild(el('div', {class:'block-explain-text', style:'margin-top:12px;', text: 'Respostas no nível mais baixo: ' + p.maisBaixas.join(', ') + '.'}));
  }
  if(p.maisAltas.length){
    card.appendChild(el('div', {class:'block-explain-text', text: 'Respostas no nível mais alto: ' + p.maisAltas.join(', ') + '.'}));
  }
  card.appendChild(el('div', {class:'note', style:'margin-top:12px;', text:'Panorama informativo, a partir das respostas da coleta -- não é uma explicação causal do resultado oficial do DEXi.'}));
  return card;
}

// (1.2) Seção dedicada -- lista visual (não texto corrido) dos atributos em
// destaque, com indicador de cor e resumo de uma linha rastreável até a
// resposta real da coleta. No mockup esta lógica aparece como "Atributos em
// destaque" (adendo rodada 5, item 1.2).
function sectionDestaques(){
  const { fortes, atencao } = pontosDestaqueLists();
  const card = el('div', {class:'card'});
  card.appendChild(el('div', {class:'block-label', text:'Atributos em destaque'}));

  const renderGroup = (title, cls, items) => {
    const g = el('div', {class:'destaque-group'});
    g.appendChild(el('div', {class:'destaque-group-title ' + cls, text: title}));
    if(!items.length){
      g.appendChild(el('div', {class:'block-explain-text', text:'Nenhum atributo nesta condição.'}));
    } else {
      items.forEach(({attr, label}) => {
        const item = el('div', {class:'destaque-item'});
        item.appendChild(el('div', {class:'destaque-dot ' + cls}));
        const text = el('div', {class:'destaque-item-text'});
        text.appendChild(el('b', {text: humanizeAttrId(attr.id) + ': '}));
        text.appendChild(document.createTextNode('resposta registrada na coleta foi "' + label + '".'));
        item.appendChild(text);
        g.appendChild(item);
      });
    }
    return g;
  };

  card.appendChild(renderGroup('Pontos fortes', 'forte', fortes));
  card.appendChild(renderGroup('Pontos de atenção', 'atencao', atencao));
  card.appendChild(el('div', {class:'note', style:'margin-top:12px;', text:'Melhor/pior posição dentro da própria escala de 4 níveis de cada atributo (a mesma leitura do panorama) -- não é um ranking entre atributos diferentes nem um cálculo do DEXi.'}));
  return card;
}

// (1.1) Visão por grupo -- cada um dos 7 grupos intermediários com barra de
// posição na própria escala e, sob demanda (clique), o detalhamento dos
// atributos básicos que o compõem com o valor de cada um (adendo rodada 5,
// item 1.1). grupoTop já vem calculado pelo servidor (GET /api/attrs), a
// partir da mesma tabela LEAF_TO_GROUP usada no radar -- nunca duplicada
// aqui.
function sectionGroupCards(){
  const card = el('div', {class:'card'});
  card.appendChild(el('div', {class:'block-label', text:'Grupos -- detalhamento por atributo'}));

  if(!DEXI_MODEL){
    card.appendChild(el('div', {class:'chart-empty-note', text:'Carregando...'}));
    return card;
  }

  DEXI_MODEL.grupos.forEach((g) => {
    const found = state.panel ? state.panel.grupos.find((pg) => pg.id === g.id) : null;
    const idx = found ? g.niveis.indexOf(found.nivel) : null;
    const isOpen = state.reportExpandedGroup === g.id;

    const gc = el('div', {class:'group-card' + (isOpen ? ' group-card-open' : ''), onclick: () => {
      state.reportExpandedGroup = isOpen ? null : g.id;
      render();
    }});
    const header = el('div', {class:'group-card-header'});
    header.appendChild(el('div', {class:'group-card-title', text: g.label}));
    const right = el('div', {style:'display:flex; align-items:center; gap:10px;'});
    right.appendChild(el('div', {class:'group-card-level', text: found ? found.nivelLabel : 'não identificado'}));
    right.appendChild(el('div', {class:'group-card-caret', text: '›'}));
    header.appendChild(right);
    gc.appendChild(header);

    const track = el('div', {class:'group-bar-track'});
    const frac = (idx !== null && idx !== undefined) ? (idx + 1) / g.niveis.length : 0;
    track.appendChild(el('div', {class:'group-bar-fill', style: `width:${Math.round(frac*100)}%`}));
    gc.appendChild(track);

    if(isOpen){
      const body = el('div', {class:'group-card-body', onclick: (e) => e.stopPropagation()});
      const attrsOfGroup = ATTRS.filter((a) => a.grupoTop === g.id);
      if(!attrsOfGroup.length){
        body.appendChild(el('div', {class:'block-explain-text', text:'Nenhum atributo básico mapeado para este grupo.'}));
      } else {
        attrsOfGroup.forEach((a) => {
          const val = state.answers[a.id];
          const vIdx = val ? a.niveis.indexOf(val) : -1;
          const vLabel = (vIdx >= 0 && a.niveisExibicao) ? a.niveisExibicao[vIdx] : (val || 'não respondido');
          const row = el('div', {class:'group-attr-row'});
          row.appendChild(el('div', {class:'ga-name', text: humanizeAttrId(a.id)}));
          row.appendChild(el('div', {class:'ga-val', text: vLabel}));
          body.appendChild(row);
        });
      }
      gc.appendChild(body);
    }
    card.appendChild(gc);
  });
  return card;
}

// Aba "Evolução" -- a jornada de 4 estágios já existente (sectionStatus),
// ampliada. Deliberadamente NÃO mostra um gráfico de tendência histórica:
// o mockup sugere um, mas esta versão da ferramenta não guarda dados entre
// sessões (fora do escopo original) -- fabricar uma tendência sem dados
// reais violaria a regra de ouro do adendo. A nota abaixo é honesta sobre
// essa limitação em vez de simular um histórico.
function sectionEvolucao(){
  const card = el('div', {class:'card'});
  card.appendChild(el('div', {class:'block-label', text:'Evolução -- posição atual na jornada'}));
  card.appendChild(el('div', {class:'block-explain-text', text:'A posição abaixo é sempre o resultado oficial mais recente do DEXi para esta organização -- a mesma classificação mostrada em "Diagnóstico".'}));
  card.appendChild(el('div', {class:'note', style:'margin-top:14px;', text:'Esta versão da ferramenta não guarda um histórico entre sessões, então não há uma linha de tendência ao longo do tempo para mostrar -- mostrar uma aqui exigiria inventar dados que não existem. Para acompanhar evolução, repita o diagnóstico periodicamente e compare os PDFs exportados de cada rodada.'}));
  return card;
}

// Card "Próximos passos" (referência do mockup) -- prévia compacta do
// centro de aprendizado na aba Diagnóstico, com atalho para a aba
// Relatórios onde a seção completa (com as etiquetas do item 1.4) já vive.
// Nunca duplica a chamada à IA -- só lê o que já está (ou não) carregado em
// state.learning.
function sectionProximosPassos(){
  const card = el('div', {class:'card block-explain'});
  card.appendChild(el('div', {class:'block-label', text:'Próximos passos'}));
  if(state.learning && state.learning.temas.length){
    state.learning.temas.slice(0, 2).forEach((t) => {
      const item = el('div', {class:'learning-item'});
      if(t.pontoLabel) item.appendChild(el('div', {class:'learning-tag', text: '⚑ ' + t.pontoLabel}));
      item.appendChild(el('div', {class:'learning-tema', text: t.tema}));
      card.appendChild(item);
    });
    card.appendChild(el('button', {class:'btn secondary small', text:'Ver centro de aprendizado completo →', style:'margin-top:14px;', onclick: () => { state.reportTab = 'relatorios'; render(); }}));
  } else if(state.learningLoading || state.panelLoading){
    card.appendChild(el('div', {class:'block-explain-text'}, [
      el('span', {class:'spinner'}), el('span', {text:' preparando sugestões...', style:'margin-left:8px;'})
    ]));
  } else {
    card.appendChild(el('div', {class:'block-explain-text', text:'As sugestões do centro de aprendizado aparecem aqui assim que o resultado for analisado -- veja a aba Relatórios.'}));
  }
  return card;
}

function reportTabNav(){
  const tabs = [
    {id:'diagnostico', label:'Diagnóstico'},
    {id:'dimensoes', label:'Dimensões'},
    {id:'atributos', label:'Atributos'},
    {id:'evolucao', label:'Evolução'},
    {id:'relatorios', label:'Relatórios'},
  ];
  const nav = el('div', {class:'report-tabs'});
  tabs.forEach((t) => {
    const active = state.reportTab === t.id;
    nav.appendChild(el('button', {
      class: 'report-tab' + (active ? ' report-tab-active' : ''),
      text: t.label,
      onclick: () => { state.reportTab = t.id; render(); },
    }));
  });
  return nav;
}

// (e) centro de aprendizado -- temas de estudo vinculados aos pontos de
// atenção, nunca livros/autores específicos (risco de citação inventada).
function sectionLearning(){
  const card = el('div', {class:'card block-explain'});
  card.appendChild(el('div', {class:'block-label', text:'Centro de aprendizado'}));
  if(state.learning && state.learning.temas.length){
    state.learning.temas.forEach(t => {
      const item = el('div', {class:'learning-item'});
      // (1.4) etiqueta visual do ponto de atenção que motivou o tema --
      // pontoLabel já vem validado pelo servidor contra a lista real de
      // pontos de atenção (nunca um texto livre inventado pela IA).
      if(t.pontoLabel){
        item.appendChild(el('div', {class:'learning-tag', text: '⚑ ' + t.pontoLabel}));
      }
      item.appendChild(el('div', {class:'learning-tema', text: t.tema}));
      item.appendChild(el('div', {class:'block-explain-text', text: t.porque}));
      card.appendChild(item);
    });
  } else if(state.learningLoading){
    card.appendChild(el('div', {class:'block-explain-text'}, [
      el('span', {class:'spinner'}), el('span', {text:' pensando...', style:'margin-left:8px;'})
    ]));
  } else if(state.learningError){
    card.appendChild(el('div', {class:'error-box', text: state.learningError}));
    card.appendChild(el('button', {class:'btn secondary small', text:'Tentar novamente', style:'margin-top:10px;', onclick: ensureLearning}));
  } else if(state.learning){
    card.appendChild(el('div', {class:'block-explain-text', text:'Nenhum tema gerado nesta sessão.'}));
  }
  card.appendChild(el('div', {class:'note', style:'margin-top:12px;', text:'Temas de estudo sugeridos por IA, vinculados aos pontos de atenção do diagnóstico -- não são referências bibliográficas curadas ou verificadas pelo projeto.'}));
  return card;
}

// (d) centro de dúvidas -- a conversa que já existia, agora reativa e como
// uma seção do painel (nunca abre sozinha com um relatório).
function sectionDuvidas(){
  const card = el('div', {class:'card panel-duvidas'});
  card.appendChild(el('div', {class:'block-label', text:'Centro de dúvidas'}));
  if(state.duvidasChat.length){
    const chatBox = el('div', {class:'chat-log', style:'margin-bottom:16px;'});
    state.duvidasChat.forEach(m => {
      chatBox.appendChild(el('div', {class: 'bubble report-body ' + (m.role === 'assistant' ? 'bubble-agent' : 'bubble-user'), text: m.text}));
    });
    card.appendChild(chatBox);
  }
  if(state.duvidasThinking){
    card.appendChild(el('div', {class:'bubble bubble-agent'}, [
      el('span', {class:'spinner'}), el('span', {text:' pensando...', style:'margin-left:8px;'})
    ]));
  } else {
    const inputRow = el('div', {class:'chat-input-row'});
    const textIn = el('input', {type:'text', placeholder:'Pergunte algo sobre o resultado (ex.: por que ficamos nesse nível em Estratégia?)...', id:'duvidasTextInput'});
    textIn.addEventListener('keydown', (e) => { if(e.key === 'Enter' && textIn.value.trim()){ duvidasTurn(textIn.value); textIn.value=''; } });
    const sendBtn = el('button', {class:'btn chat-send', text:'Enviar', onclick: () => { if(textIn.value.trim()){ duvidasTurn(textIn.value); textIn.value=''; } }});
    inputRow.appendChild(textIn);
    inputRow.appendChild(sendBtn);
    card.appendChild(inputRow);
  }
  if(state.duvidasError){
    card.appendChild(el('div', {class:'error-box', text: state.duvidasError}));
  }
  return card;
}

// Painel da Etapa 3 (adendo rodada 5) -- navegação por abas seguindo a
// lógica de organização do mockup (Diagnóstico / Dimensões / Atributos /
// Evolução / Relatórios), sem copiar layout pixel a pixel. Cada aba é uma
// combinação das mesmas seções já existentes (status, gráficos, panorama,
// centro de aprendizado, centro de dúvidas) mais as três novas peças do
// adendo (indicador circular unificado, cards de grupo com detalhamento,
// lista de atributos em destaque) -- nada aqui recalcula ou inventa um
// valor que não venha do resultado oficial do DEXi ou da coleta.
function screenReport(){
  const c = el('div');
  c.appendChild(stepsNav(2));
  c.appendChild(el('div', {class:'result-badge', text: state.orgName}));
  c.appendChild(el('h1', {text:'Painel do resultado'}));

  if(state.panel && !state.panel.consistencia.completo){
    const parts = [];
    if(state.panel.consistencia.atributosFaltando.length) parts.push('sem resposta na coleta: ' + state.panel.consistencia.atributosFaltando.join(', '));
    if(state.panel.consistencia.atributosInvalidos.length) parts.push('valor fora das 4 alternativas oficiais: ' + state.panel.consistencia.atributosInvalidos.join(', '));
    c.appendChild(el('div', {class:'error-box', text: 'Divergência de consistência encontrada — ' + parts.join(' · ')}));
  }

  c.appendChild(reportTabNav());

  const tab = state.reportTab;
  if(tab === 'diagnostico'){
    c.appendChild(sectionStatus());
    c.appendChild(sectionDestaques());
    c.appendChild(sectionProximosPassos());
  } else if(tab === 'dimensoes'){
    c.appendChild(sectionCharts());
    c.appendChild(sectionPanorama());
  } else if(tab === 'atributos'){
    c.appendChild(sectionGroupCards());
    c.appendChild(sectionDestaques());
  } else if(tab === 'evolucao'){
    c.appendChild(sectionEvolucao());
  } else if(tab === 'relatorios'){
    c.appendChild(sectionLearning());
    c.appendChild(sectionDuvidas());
  }

  if(state.panelError){
    const box = el('div', {class:'error-box', text: state.panelError});
    c.appendChild(box);
    c.appendChild(el('button', {class:'btn secondary small', text:'Tentar novamente', style:'margin-top:10px;', onclick: () => { state.panelError = ''; ensurePanel(); }}));
  }

  c.appendChild(el('div', {class:'note', text:'O resultado final, as dimensões e os grupos vêm sempre do resultado oficial do DEXi (nunca recalculados). Interpretações, panorama e centro de aprendizado são gerados a partir dele e das respostas da coleta -- qualquer cenário hipotético é sempre indicado como simulação, nunca confundido com o resultado oficial.'}));

  const btnRow = el('div', {class:'btn-row'});
  btnRow.appendChild(el('button', {class:'btn', text: state.pdfExporting ? 'Gerando PDF…' : 'Baixar PDF', disabled: state.pdfExporting, onclick: downloadPanelPdf}));
  btnRow.appendChild(el('button', {class:'btn secondary', text:'Nova avaliação', onclick: () => {
    state.screen = 'intro'; state.idx = 0; state.answers = {}; state.registro = {}; state.chatLogs = {};
    state.explanations = {}; state.explainErrors = {};
    state.orgName = ''; state.orgContext = ''; state.dexiText = ''; state.collectionSourceLoaded = false;
    state.panel = null; state.panelError = ''; state.learning = null; state.learningError = '';
    state.duvidasChat = []; state.duvidasError = '';
    state.reportTab = 'diagnostico'; state.reportExpandedGroup = null;
    render();
  }}));
  c.appendChild(btnRow);
  if(state.pdfExportError){
    c.appendChild(el('div', {class:'error-box', text: state.pdfExportError}));
  }

  if(!state.panel && !state.panelLoading && !state.panelError){
    // !state.panelError evita um loop -- sem essa checagem, toda vez que
    // uma falha zerasse panelLoading e chamasse render(), esta mesma
    // condição voltaria a ficar verdadeira e disparava ensurePanel() nela
    // de novo, para sempre (bug real, pego só ao testar com falha de API).
    // O setTimeout evita reentrar em render() antes deste appendChild()
    // terminar (duplicaria a tela).
    setTimeout(ensurePanel, 0);
  }
  return c;
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
  state.screen = 'intro';
  render();
}

boot();
