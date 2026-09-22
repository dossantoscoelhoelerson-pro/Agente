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
  state.screen = 'intro';
  render();
}

boot();
