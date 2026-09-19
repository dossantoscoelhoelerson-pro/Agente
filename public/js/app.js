// Aplicação de página única, JS vanilla, sem build step -- mesmo estilo do
// protótipo. As únicas diferenças de arquitetura: as chamadas de IA vão para
// o backend próprio (/api/...), nunca direto para a Anthropic, e os
// downloads usam Blob + <a download> puro (fora do claude.ai isso já
// funciona sem nenhuma capability especial).

let ATTRS = [];

const state = {
  screen: 'loading',
  idx: 0,
  answers: {},
  registro: {},          // attrId -> {id, resposta, conversa}
  chatLogs: {},           // attrId -> [{role, text}]
  orgName: '',
  orgContext: '',
  editingFromReview: false,
  pendingOptions: null,
  thinking: false,
  turnInFlight: false,

  dexiText: '',
  collectionSourceLoaded: false, // JSON da coleta foi carregado manualmente (sessão nova)
  uploadError: '',

  reportChat: [],
  reportThinking: false,
  reportError: '',
  reportConsistencia: null,
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

function render(){
  const app = document.getElementById('app');
  app.innerHTML = '';
  if(state.screen === 'loading') app.appendChild(screenLoading());
  else if(state.screen === 'intro') app.appendChild(screenIntro());
  else if(state.screen === 'collect') app.appendChild(screenCollect());
  else if(state.screen === 'review') app.appendChild(screenReview());
  else if(state.screen === 'done1') app.appendChild(screenDone1());
  else if(state.screen === 'manual') app.appendChild(screenManual());
  else if(state.screen === 'upload') app.appendChild(screenUpload());
  else if(state.screen === 'report') app.appendChild(screenReport());
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

function screenIntro(){
  const c = el('div');
  c.appendChild(el('div', {class:'eyebrow', text:'Diagnóstico de Maturidade Digital'}));
  c.appendChild(el('h1', {text:'Um retrato claro de onde a organização está — e o que priorizar a seguir.'}));
  c.appendChild(el('p', {class:'lede', text:'34 perguntas objetivas, baseadas no modelo acadêmico de Kljajić Borštnar e Pucihar (2021), processado pelo DEXi. Leva cerca de 15 a 25 minutos.'}));

  const card = el('div', {class:'card'});
  card.appendChild(el('label', {text:'Nome da organização'}));
  const nameInput = el('input', {type:'text', placeholder:'ex.: MetalLamina Indústria Ltda.', id:'orgNameInput', value: state.orgName});
  card.appendChild(nameInput);
  card.appendChild(el('label', {text:'Um resumo rápido — o que a empresa faz, setor, porte (opcional, mas ajuda a contextualizar as perguntas)'}));
  const ctxInput = el('textarea', {placeholder:'ex.: Indústria metalúrgica de médio porte, região de Divinópolis-MG, fornece peças para o setor automotivo.', id:'orgCtxInput'});
  ctxInput.value = state.orgContext;
  card.appendChild(ctxInput);

  const btnRow = el('div', {class:'btn-row'});
  btnRow.appendChild(el('button', {class:'btn', text:'Começar avaliação', onclick: () => {
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
  const attr = ATTRS[idx];
  const already = !!state.answers[attr.id];
  state.pendingOptions = already ? attr.niveis : null;
  render();
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

  const card = el('div', {class:'card'});

  const chatLog = state.chatLogs[attr.id] || (state.chatLogs[attr.id] = []);
  const chatBox = el('div', {class:'chat-log'});
  chatLog.forEach(m => {
    chatBox.appendChild(el('div', {class: 'bubble ' + (m.role === 'assistant' ? 'bubble-agent' : 'bubble-user'), text: m.text}));
  });
  card.appendChild(chatBox);

  if(state.thinking){
    card.appendChild(el('div', {class:'bubble bubble-agent'}, [
      el('span', {class:'spinner'}), el('span', {text:' pensando...', style:'margin-left:8px;'})
    ]));
  }

  if(!state.thinking && state.pendingOptions){
    const opts = el('div', {class:'options'});
    state.pendingOptions.forEach((lvl, i) => {
      const btn = el('div', {class:'opt', onclick: () => registerAnswer(attr.id, lvl)});
      btn.appendChild(el('div', {class:'num', text: String(i+1)}));
      btn.appendChild(el('div', {text: lvl}));
      opts.appendChild(btn);
    });
    card.appendChild(opts);
  }

  if(!state.thinking){
    const inputRow = el('div', {class:'chat-input-row'});
    const textIn = el('input', {type:'text', placeholder:'Digite sua resposta ou dúvida...', id:'chatTextInput'});
    textIn.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ sendUserTurn(textIn.value); } });
    const sendBtn = el('button', {class:'btn', text:'Enviar', onclick: () => sendUserTurn(textIn.value)});
    inputRow.appendChild(textIn);
    inputRow.appendChild(sendBtn);
    card.appendChild(inputRow);
  }

  c.appendChild(card);

  const nav = el('div', {class:'btn-row'});
  if(state.idx > 0){
    nav.appendChild(el('button', {class:'btn secondary', text:'← Voltar ao atributo anterior', onclick: () => { goToAttribute(state.idx - 1); }}));
  }
  nav.appendChild(el('button', {class:'btn secondary', text:'Revisar respostas', onclick: () => { state.screen = 'review'; render(); }}));
  c.appendChild(nav);

  if(chatLog.length === 0 && !state.pendingOptions && !state.thinking && !state.turnInFlight){
    startAttributeTurn();
  }
  return c;
}

function sendUserTurn(text){
  text = (text || '').trim();
  if(!text || state.thinking || state.turnInFlight) return;
  const attr = ATTRS[state.idx];
  state.chatLogs[attr.id].push({role:'user', text});
  state.pendingOptions = null;
  render();
  callAgentTurn();
}

async function startAttributeTurn(){
  state.thinking = true;
  render();
  await callAgentTurn();
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
    state.pendingOptions = (data.action === 'present_options') ? attr.niveis : null;
  } catch(err){
    state.chatLogs[attr.id].push({role:'assistant', text: 'Não consegui processar essa etapa automaticamente (' + err.message + '). Você pode escolher uma das alternativas oficiais abaixo para seguir.'});
    state.pendingOptions = attr.niveis;
  }
  state.thinking = false;
  state.turnInFlight = false;
  render();
}

function registerAnswer(id, val){
  state.answers[id] = val;
  state.registro[id] = { id, resposta: val, conversa: (state.chatLogs[id] || []).slice() };
  state.pendingOptions = null;

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

function screenUpload(){
  const c = el('div');
  c.appendChild(stepsNav(2));
  c.appendChild(el('h1', {text:'Carregue o resultado do DEXi.'}));
  c.appendChild(el('p', {class:'lede', text:'Cole o texto do relatório, ou carregue um arquivo .txt/.json/.csv com o resultado.'}));

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
  zone.appendChild(el('div', {text:'Clique para escolher um arquivo (.txt, .json, .csv)'}));
  const fileInput = el('input', {type:'file', accept:'.txt,.json,.csv', onchange: (e)=>{
    const f = e.target.files[0];
    if(!f) return;
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
    state.reportChat = [];
    state.reportError = '';
    state.reportConsistencia = null;
    state.screen = 'report';
    render();
  });
  btnRow.appendChild(genBtn);
  c.appendChild(btnRow);
  return c;
}

async function interpretTurn(userMessage){
  const historySnapshot = state.reportChat.slice();
  if(userMessage) state.reportChat.push({role:'user', text: userMessage});
  state.reportThinking = true;
  state.reportError = '';
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
        userMessage: userMessage || null,
      }),
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    state.reportChat.push({role:'assistant', text: data.message});
    state.reportConsistencia = data.consistencia;
  } catch(err){
    state.reportError = 'Não consegui gerar a resposta: ' + err.message;
  }
  state.reportThinking = false;
  render();
}

function screenReport(){
  const c = el('div');
  c.appendChild(stepsNav(2));
  c.appendChild(el('div', {class:'result-badge', text: state.orgName}));
  c.appendChild(el('h1', {text:'Conversa sobre o resultado'}));

  if(state.reportConsistencia && !state.reportConsistencia.completo){
    const parts = [];
    if(state.reportConsistencia.atributosFaltando.length) parts.push('sem resposta na coleta: ' + state.reportConsistencia.atributosFaltando.join(', '));
    if(state.reportConsistencia.atributosInvalidos.length) parts.push('valor fora das 4 alternativas oficiais: ' + state.reportConsistencia.atributosInvalidos.join(', '));
    c.appendChild(el('div', {class:'error-box', text: 'Divergência de consistência encontrada — ' + parts.join(' · ')}));
  }

  const card = el('div', {class:'card'});
  const chatBox = el('div', {class:'chat-log'});
  state.reportChat.forEach(m => {
    chatBox.appendChild(el('div', {class: 'bubble report-body ' + (m.role === 'assistant' ? 'bubble-agent' : 'bubble-user'), text: m.text}));
  });
  card.appendChild(chatBox);

  if(state.reportThinking){
    card.appendChild(el('div', {class:'bubble bubble-agent'}, [
      el('span', {class:'spinner'}), el('span', {text:' pensando...', style:'margin-left:8px;'})
    ]));
  }

  if(!state.reportThinking){
    const inputRow = el('div', {class:'chat-input-row'});
    const textIn = el('input', {type:'text', placeholder:'Pergunte algo sobre o resultado (ex.: por que ficamos nesse nível em Estratégia Digital?)...', id:'reportTextInput'});
    textIn.addEventListener('keydown', (e) => { if(e.key === 'Enter' && textIn.value.trim()){ interpretTurn(textIn.value); textIn.value=''; } });
    const sendBtn = el('button', {class:'btn', text:'Enviar', onclick: () => { if(textIn.value.trim()){ interpretTurn(textIn.value); textIn.value=''; } }});
    inputRow.appendChild(textIn);
    inputRow.appendChild(sendBtn);
    card.appendChild(inputRow);
  }
  c.appendChild(card);

  if(state.reportError){
    c.appendChild(el('div', {class:'error-box', text: state.reportError}));
  }

  c.appendChild(el('div', {class:'note', text:'Esta interpretação é gerada por IA a partir do resultado oficial do DEXi e das respostas da coleta — o resultado do DEXi continua sendo a referência oficial. Qualquer cenário hipotético é sempre indicado como simulação, nunca confundido com o resultado oficial.'}));

  const btnRow = el('div', {class:'btn-row'});
  btnRow.appendChild(el('button', {class:'btn secondary', text:'Nova avaliação', onclick: () => {
    state.screen = 'intro'; state.idx = 0; state.answers = {}; state.registro = {}; state.chatLogs = {};
    state.orgName = ''; state.orgContext = ''; state.dexiText = ''; state.collectionSourceLoaded = false;
    state.reportChat = []; state.reportConsistencia = null; state.reportError = '';
    render();
  }}));
  c.appendChild(btnRow);

  if(state.reportChat.length === 0 && !state.reportThinking){
    interpretTurn(null);
  }
  return c;
}

// ---------- boot ----------

async function boot(){
  try{
    const res = await fetch('/api/attrs');
    const data = await res.json();
    ATTRS = data.attrs;
  } catch(err){
    document.getElementById('app').innerHTML = '';
    document.getElementById('app').appendChild(el('div', {class:'error-box', text:'Não consegui carregar os atributos do servidor. Recarregue a página.'}));
    return;
  }
  state.screen = 'intro';
  render();
}

boot();
