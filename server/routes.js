const express = require('express');
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
const { PDFParse } = require('pdf-parse');

const { ATTRS } = require('./attrs');
const { displayLabel } = require('./displayMap');
const { questionFor } = require('./officialQuestions');
const { ROOT, DIMENSOES, GRUPOS, displayLevel, groupIdFor } = require('./dexiModel');
const { buildReportPdf } = require('./exportPdf');
const { client, MODEL, handleAnthropicError } = require('./anthropicClient');
const {
  EXPLAIN_SYSTEM_PROMPT,
  buildExplainUserPrompt,
  COLLECT_SYSTEM_PROMPT,
  buildCollectUserPrompt,
  EXTRACT_SYSTEM_PROMPT,
  buildExtractUserPrompt,
  LEARNING_SYSTEM_PROMPT,
  buildLearningUserPrompt,
  INTERPRET_SYSTEM_PROMPT,
  buildInterpretContextPrompt,
  SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisUserPrompt,
  ATTRIBUTE_EXPLORE_SYSTEM_PROMPT,
  buildAttributeExploreUserPrompt,
  ROADMAP_GENERATE_SYSTEM_PROMPT,
  buildRoadmapGenerateUserPrompt,
  ROADMAP_ACTION_SYSTEM_PROMPT,
  buildRoadmapActionContextPrompt,
} = require('./prompts');

const router = express.Router();

const ATTR_INDEX = new Map(ATTRS.map((a) => [a.id, a]));
const GROUP_INDEX = new Map(GRUPOS.map((g) => [g.id, g]));
const DIMENSAO_INDEX = new Map(DIMENSOES.map((d) => [d.id, d]));

const TurnSchema = z.object({
  action: z.enum(['reply', 'register']),
  message: z.string(),
  chosen: z.string().optional(),
});

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .slice(-40) // uma rodada por atributo não deveria chegar perto disso, mas limita abuso
    .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
}

// Estrutura real do modelo (dimensão -> grupos -> atributos), para o
// consultor ORBE (Insights) poder oferecer caminhos concretos e nomeados ao
// final de cada resposta sem nunca inventar um nome de grupo/atributo
// (adendo rodada 8, seção 4) -- mesma fonte (DIMENSOES/GRUPOS/ATTRS) usada
// em todo o resto do projeto, nunca uma lista à parte.
function buildEstruturaTxt() {
  return DIMENSOES.map((dim) => {
    const gruposTxt = GRUPOS
      .filter((g) => g.dimensaoId === dim.id)
      .map((g) => {
        const attrsTxt = ATTRS.filter((a) => groupIdFor(a.grupo) === g.id).map((a) => a.id).join(', ');
        return `  - ${g.label} (atributos: ${attrsTxt})`;
      })
      .join('\n');
    return `${dim.label}:\n${gruposTxt}`;
  }).join('\n');
}

function checkConsistency(answers) {
  const missing = [];
  const invalid = [];
  ATTRS.forEach((a) => {
    const val = answers[a.id];
    if (!val) missing.push(a.id);
    else if (!a.niveis.includes(val)) invalid.push(a.id);
  });
  return { missing, invalid, completo: missing.length === 0 && invalid.length === 0 };
}

// Os 34 atributos, enriquecidos com o texto de exibição (Bloco 3) de cada
// alternativa e com a pergunta oficial (Bloco 1) -- o valor técnico (usado
// para registrar/CSV/.dxi) nunca muda, esses campos são só de exibição.
router.get('/attrs', (req, res) => {
  const attrs = ATTRS.map((a) => ({
    ...a,
    pergunta: questionFor(a.id) || a.descricao,
    niveisExibicao: a.niveis.map((n) => displayLabel(a.id, n)),
    // grupoTop = o grupo A1-A4/B1-B3 (7 no total) correspondente ao subgrupo-
    // folha do atributo (attr.grupo) -- usado pelo painel da Etapa 3 (adendo
    // rodada 5, item 1.1) para agrupar os 34 atributos sob os mesmos 7 grupos
    // já usados no radar, sem duplicar a tabela LEAF_TO_GROUP no cliente.
    grupoTop: groupIdFor(a.grupo),
  }));
  res.json({ attrs });
});

// Hierarquia raiz/dimensões/grupos do modelo DEXi, com rótulos e escalas de
// exibição -- usado pelo painel da Etapa 3 (status, gráficos).
router.get('/dexi-model', (req, res) => {
  const withDisplay = (node) => ({ ...node, niveisExibicao: node.niveis.map(displayLevel) });
  res.json({
    root: withDisplay(ROOT),
    dimensoes: DIMENSOES.map(withDisplay),
    grupos: GRUPOS.map(withDisplay),
  });
});

// Bloco 2 -- explicação adaptada ao contexto da empresa para UM atributo.
// Nunca decide nada sobre a resposta, só gera texto explicativo.
router.post('/collect/explain', async (req, res) => {
  const { attrId, orgName, orgContext } = req.body || {};

  const attr = ATTR_INDEX.get(attrId);
  if (!attr) return res.status(400).json({ error: 'attrId inválido.' });
  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });

  const pergunta = questionFor(attr.id) || attr.descricao;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: [{ type: 'text', text: EXPLAIN_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildExplainUserPrompt(attr, pergunta, orgName, String(orgContext || '')) }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    res.json({ message: textBlock ? textBlock.text : '' });
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

// Bloco 4 -- um turno do campo de conversa livre para UM atributo.
router.post('/collect/turn', async (req, res) => {
  const { attrId, orgName, orgContext, history } = req.body || {};

  const attr = ATTR_INDEX.get(attrId);
  if (!attr) return res.status(400).json({ error: 'attrId inválido.' });
  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });

  const pergunta = questionFor(attr.id) || attr.descricao;
  const safeHistory = sanitizeHistory(history);

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: COLLECT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        { role: 'user', content: buildCollectUserPrompt(attr, pergunta, orgName, String(orgContext || ''), safeHistory) },
      ],
      output_config: { format: zodOutputFormat(TurnSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return res.status(502).json({ error: 'A IA não retornou um formato de resposta válido.' });
    }

    // Regra de fidelidade (inegociável): só aceitar "register" se o valor
    // escolhido for, byte a byte, uma das 4 alternativas oficiais do atributo.
    if (parsed.action === 'register' && (!parsed.chosen || !attr.niveis.includes(parsed.chosen))) {
      return res.json({
        action: 'reply',
        message: parsed.message || 'Pode confirmar escolhendo uma das alternativas acima?',
      });
    }

    res.json({ action: parsed.action, message: parsed.message, chosen: parsed.chosen });
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

// Etapa 3 -- extrai o texto de um PDF (relatório exportado pelo DEXi) no
// servidor, já que o navegador não tem como ler PDF nativamente.
router.post('/extract-pdf', async (req, res) => {
  const { pdfBase64 } = req.body || {};
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return res.status(400).json({ error: 'pdfBase64 é obrigatório.' });
  }

  let buffer;
  try {
    buffer = Buffer.from(pdfBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'pdfBase64 não é um base64 válido.' });
  }
  if (buffer.length === 0 || buffer.length > 15 * 1024 * 1024) {
    return res.status(400).json({ error: 'Arquivo PDF vazio ou maior que 15MB.' });
  }

  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = (result.text || '').trim();
    if (!text) {
      return res.status(422).json({ error: 'Não encontrei texto neste PDF (pode ser um PDF escaneado como imagem). Cole o texto manualmente.' });
    }
    res.json({ text });
  } catch (err) {
    console.error('[extract-pdf]', err);
    res.status(422).json({ error: 'Não consegui extrair o texto deste PDF: ' + err.message });
  } finally {
    if (parser) await parser.destroy().catch(() => {});
  }
});

// Etapa 3, painel (a)+(b) -- extrai do texto do resultado do DEXi os
// valores oficiais do nível final, das duas dimensões e dos grupos.
// Nunca calcula nada -- só localiza e normaliza o que já está no texto;
// qualquer valor que não bata exatamente com uma alternativa oficial é
// descartado (mesma regra de fidelidade do Bloco 3 da coleta).
router.post('/interpret/extract', async (req, res) => {
  const { orgName, answers, dexiText } = req.body || {};

  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers é obrigatório.' });
  if (!dexiText || typeof dexiText !== 'string' || !dexiText.trim()) {
    return res.status(400).json({ error: 'dexiText é obrigatório.' });
  }

  const consistencia = checkConsistency(answers);

  const ExtractSchema = z.object({
    nivelFinal: z.string().nullable(),
    capDigital: z.string().nullable(),
    capOrganizacional: z.string().nullable(),
    grupos: z.array(z.object({ id: z.string(), nivel: z.string() })),
  });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: EXTRACT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildExtractUserPrompt({ dexiText, root: ROOT, dimensoes: DIMENSOES, grupos: GRUPOS }) }],
      output_config: { format: zodOutputFormat(ExtractSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) return res.status(502).json({ error: 'A IA não retornou um formato de resposta válido.' });

    // Validação defensiva: nunca aceitar um valor fora da escala oficial
    // daquele atributo, mesmo que a IA tenha retornado algo parecido.
    const nivelFinal = parsed.nivelFinal && ROOT.niveis.includes(parsed.nivelFinal) ? parsed.nivelFinal : null;
    const capDigital = parsed.capDigital && DIMENSAO_INDEX.get('CAP.DIGITAL').niveis.includes(parsed.capDigital) ? parsed.capDigital : null;
    const capOrganizacional = parsed.capOrganizacional && DIMENSAO_INDEX.get('CAP.ORGANIZACIONAL').niveis.includes(parsed.capOrganizacional) ? parsed.capOrganizacional : null;
    const grupos = (parsed.grupos || [])
      .filter((g) => g && GROUP_INDEX.has(g.id) && GROUP_INDEX.get(g.id).niveis.includes(g.nivel))
      .map((g) => ({ id: g.id, nivel: g.nivel }));

    res.json({
      nivelFinal, nivelFinalLabel: displayLevel(nivelFinal),
      capDigital, capDigitalLabel: displayLevel(capDigital),
      capOrganizacional, capOrganizacionalLabel: displayLevel(capOrganizacional),
      grupos: grupos.map((g) => ({ ...g, label: GROUP_INDEX.get(g.id).label, nivelLabel: displayLevel(g.nivel) })),
      consistencia: { completo: consistencia.completo, atributosFaltando: consistencia.missing, atributosInvalidos: consistencia.invalid },
    });
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

// Monta os "pontos de atenção" (grupos/dimensões em nível mais baixo da
// própria escala) e, para cada um, os atributos básicos daquele grupo cuja
// resposta foi a alternativa mais fraca -- usado como base do centro de
// aprendizado. É leitura direta dos dados já extraídos/coletados, nunca um
// recálculo da lógica de agregação do DEXi.
function buildPontosAtencao({ answers, capDigital, capOrganizacional, grupos }) {
  const pontos = [];

  [
    { id: 'CAP.DIGITAL', nivel: capDigital },
    { id: 'CAP.ORGANIZACIONAL', nivel: capOrganizacional },
  ].forEach(({ id, nivel }) => {
    const dim = DIMENSAO_INDEX.get(id);
    if (dim && nivel && dim.niveis.indexOf(nivel) === 0) {
      pontos.push({ label: dim.label, nivel: displayLevel(nivel), atributos: [] });
    }
  });

  (grupos || []).forEach((g) => {
    const grupo = GROUP_INDEX.get(g.id);
    if (!grupo || !g.nivel) return;
    const idx = grupo.niveis.indexOf(g.nivel);
    if (idx !== 0 && idx !== 1) return; // só Baixo / Médio-baixo contam como ponto de atenção

    const atributosFracos = ATTRS
      .filter((a) => groupIdFor(a.grupo) === g.id)
      .filter((a) => {
        const val = answers[a.id];
        return val && a.niveis.indexOf(val) === 0; // respondeu a alternativa mais fraca do próprio atributo
      })
      .map((a) => a.id);

    pontos.push({ label: grupo.label, nivel: displayLevel(g.nivel), atributos: atributosFracos });
  });

  return pontos.slice(0, 6);
}

// Etapa 3, painel (e) -- centro de aprendizado: temas de estudo vinculados
// aos pontos de atenção do diagnóstico.
router.post('/interpret/learning', async (req, res) => {
  const { orgName, orgContext, answers, capDigital, capOrganizacional, grupos } = req.body || {};

  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers é obrigatório.' });

  const pontosAtencao = buildPontosAtencao({ answers, capDigital, capOrganizacional, grupos });
  const pontoLabels = pontosAtencao.map((p) => p.label);

  const LearningSchema = z.object({
    temas: z.array(z.object({ tema: z.string(), porque: z.string(), pontoLabel: z.string().nullable() })),
  });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1500,
      system: [{ type: 'text', text: LEARNING_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildLearningUserPrompt({ orgName, orgContext: String(orgContext || ''), pontosAtencao }) }],
      output_config: { format: zodOutputFormat(LearningSchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed) return res.status(502).json({ error: 'A IA não retornou um formato de resposta válido.' });
    // Validação defensiva (mesmo padrão do resto do projeto): só aceitar um
    // pontoLabel que seja, exatamente, um dos rótulos de ponto de atenção que
    // foram de fato passados à IA -- nunca confiar que ela não inventou um
    // grupo/atributo fora dessa lista (adendo rodada 5, item 1.4: a etiqueta
    // visual do centro de aprendizado precisa apontar para um ponto real).
    const temas = parsed.temas.map((t) => ({
      tema: t.tema,
      porque: t.porque,
      pontoLabel: t.pontoLabel && pontoLabels.includes(t.pontoLabel) ? t.pontoLabel : null,
    }));
    res.json({ temas, pontosAtencao });
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

// Cockpit (adendo rodada 6) -- Insights, abertura: síntese curta da seção,
// com "interpretacao" e "possibilidades" gerados pela IA. O campo
// "resultado" NUNCA vem daqui -- é montado no cliente a partir do dado real
// do painel (state.panel), eliminando qualquer risco de a IA reformular o
// resultado oficial ao "sintetizá-lo".
router.post('/insights/synthesis', async (req, res) => {
  const { orgName, orgContext, nivelFinalLabel, capDigitalLabel, capOrganizacionalLabel, grupos, fortes, atencao } = req.body || {};

  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });

  const SynthesisSchema = z.object({ interpretacao: z.string(), possibilidades: z.string() });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 700,
      system: [{ type: 'text', text: SYNTHESIS_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildSynthesisUserPrompt({
        orgName, orgContext: String(orgContext || ''), nivelFinalLabel, capDigitalLabel, capOrganizacionalLabel,
        grupos: Array.isArray(grupos) ? grupos : [],
        fortes: Array.isArray(fortes) ? fortes : [],
        atencao: Array.isArray(atencao) ? atencao : [],
      }) }],
      output_config: { format: zodOutputFormat(SynthesisSchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed) return res.status(502).json({ error: 'A IA não retornou um formato de resposta válido.' });
    res.json(parsed);
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

// Cockpit (adendo rodada 6) -- Insights, exploração de um atributo
// individual: só o campo "possibilidades" (o "o que isso significa" reusa a
// explicação do Bloco 2 já gerada na Etapa 1, no cliente, sem chamada nova).
router.post('/insights/attribute-explore', async (req, res) => {
  const { attrId, orgName, orgContext, evidenciaConversa } = req.body || {};

  const attr = ATTR_INDEX.get(attrId);
  if (!attr) return res.status(400).json({ error: 'attrId inválido.' });
  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });

  const pergunta = questionFor(attr.id) || attr.descricao;
  const resposta = req.body.resposta;
  const respostaLabel = req.body.respostaLabel;
  const evidenciaTxt = Array.isArray(evidenciaConversa)
    ? evidenciaConversa
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
        .slice(-20)
        .map((m) => `${m.role === 'assistant' ? 'agente' : 'usuário'}: ${m.text.slice(0, 1000)}`)
        .join('\n')
    : '';

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: [{ type: 'text', text: ATTRIBUTE_EXPLORE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildAttributeExploreUserPrompt({ attr, pergunta, resposta, respostaLabel, orgName, orgContext: String(orgContext || ''), evidenciaTxt }) }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    res.json({ possibilidades: textBlock ? textBlock.text : '' });
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

// Cockpit (adendo rodada 6) -- Roadmap: proposta inicial de ações a partir
// dos pontos de atenção, reaproveitando buildPontosAtencao() (mesma leitura
// já usada pelo centro de aprendizado). Toda ação vem marcada como sugestão
// -- o cliente rotula "Sugestão da IA" e o usuário decide o que aceitar.
router.post('/roadmap/generate', async (req, res) => {
  const { orgName, orgContext, answers, capDigital, capOrganizacional, grupos } = req.body || {};

  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers é obrigatório.' });

  const pontosAtencao = buildPontosAtencao({ answers, capDigital, capOrganizacional, grupos });
  const pontoLabels = pontosAtencao.map((p) => p.label);

  const RoadmapSchema = z.object({
    acoes: z.array(z.object({
      titulo: z.string(),
      origemLabel: z.string().nullable(),
      objetivo: z.string(),
      horizonte: z.enum(['0-3', '3-6', '6-12']),
      indicadorSugerido: z.string(),
    })),
  });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1800,
      system: [{ type: 'text', text: ROADMAP_GENERATE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildRoadmapGenerateUserPrompt({ orgName, orgContext: String(orgContext || ''), pontosAtencao }) }],
      output_config: { format: zodOutputFormat(RoadmapSchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed) return res.status(502).json({ error: 'A IA não retornou um formato de resposta válido.' });
    // Mesma validação defensiva de sempre: origemLabel só é aceito se bater
    // byte a byte com um rótulo real da lista enviada.
    const acoes = parsed.acoes.map((a) => ({
      ...a,
      origemLabel: a.origemLabel && pontoLabels.includes(a.origemLabel) ? a.origemLabel : null,
    }));
    res.json({ acoes });
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

// Cockpit (adendo rodada 6) -- Roadmap: conversa contextual sobre UMA ação.
router.post('/roadmap/action-turn', async (req, res) => {
  const { orgName, action, history, userMessage } = req.body || {};

  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });
  if (!action || typeof action !== 'object' || typeof action.titulo !== 'string') {
    return res.status(400).json({ error: 'action é obrigatório.' });
  }
  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ error: 'userMessage é obrigatório.' });
  }

  const contextPrompt = buildRoadmapActionContextPrompt({ orgName, action });
  const safeHistory = sanitizeHistory(history);
  const messages = [{ role: 'user', content: contextPrompt }];
  safeHistory.forEach((m) => messages.push({ role: m.role, content: m.text }));
  messages.push({ role: 'user', content: userMessage.trim() });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: [{ type: 'text', text: ROADMAP_ACTION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages,
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    res.json({ message: textBlock ? textBlock.text : '' });
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

// Etapa 3, painel (d) -- centro de dúvidas: um turno da conversa livre
// sobre o resultado (reativo -- só responde quando o usuário pergunta).
router.post('/interpret/turn', async (req, res) => {
  const { orgName, orgContext, answers, registroCompleto, dexiText, history, userMessage } = req.body || {};

  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers é obrigatório.' });
  if (!dexiText || typeof dexiText !== 'string' || !dexiText.trim()) {
    return res.status(400).json({ error: 'dexiText é obrigatório.' });
  }
  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ error: 'userMessage é obrigatório -- o centro de dúvidas só responde a uma pergunta do usuário.' });
  }

  const { missing, invalid, completo } = checkConsistency(answers);
  const respostasTxt = ATTRS.map((a) => `${a.id}: ${answers[a.id] || '(sem resposta)'}`).join('\n');

  let registroTxt = '';
  if (Array.isArray(registroCompleto) && registroCompleto.length) {
    registroTxt = registroCompleto
      .filter((r) => r && typeof r.id === 'string')
      .slice(0, ATTRS.length)
      .map((r) => {
        const conversa = Array.isArray(r.conversa)
          ? r.conversa.map((m) => `  ${m.role === 'assistant' ? 'agente' : 'usuário'}: ${String(m.text || '').slice(0, 500)}`).join('\n')
          : '';
        return `${r.id} -> ${r.resposta || '(sem resposta)'}${conversa ? `\n${conversa}` : ''}`;
      })
      .join('\n');
  }

  const contextPrompt = buildInterpretContextPrompt({
    orgName,
    orgContext: String(orgContext || ''),
    respostasTxt,
    dexiText,
    missing,
    invalid,
    registroTxt,
    estruturaTxt: buildEstruturaTxt(),
  });

  const safeHistory = sanitizeHistory(history);
  const messages = [{ role: 'user', content: contextPrompt }];
  safeHistory.forEach((m) => messages.push({ role: m.role, content: m.text }));
  messages.push({ role: 'user', content: userMessage.trim() });

  // "Caminhos concretos" (rodada 9): em vez de só citar nomes em texto
  // corrido, o agente devolve os próximos passos como dado estruturado, pra
  // virar chip clicável na UI -- validados aqui contra os nomes reais de
  // dimensão/grupo/atributo (mesmo padrão defensivo do resto do projeto),
  // nunca confiando que a IA não inventou um nome parecido.
  const InterpretTurnSchema = z.object({
    message: z.string(),
    nextSteps: z.array(z.object({
      label: z.string(),
      kind: z.enum(['dimensao', 'grupo', 'atributo']),
      question: z.string(),
    })).max(5),
  });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: [{ type: 'text', text: INTERPRET_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages,
      output_config: { format: zodOutputFormat(InterpretTurnSchema) },
    });
    const parsed = response.parsed_output;
    if (!parsed) return res.status(502).json({ error: 'A IA não retornou um formato de resposta válido.' });

    const nextSteps = (parsed.nextSteps || []).filter((s) => {
      if (s.kind === 'dimensao') return DIMENSOES.some((d) => d.label === s.label);
      if (s.kind === 'grupo') return GRUPOS.some((g) => g.label === s.label);
      if (s.kind === 'atributo') return ATTRS.some((a) => a.id === s.label || a.id.replace(/\./g, ' ') === s.label);
      return false;
    }).slice(0, 5);

    res.json({
      message: parsed.message,
      nextSteps,
      consistencia: { completo, atributosFaltando: missing, atributosInvalidos: invalid },
    });
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

// Etapa 3, seção 2 do adendo rodada 3 -- exporta o painel (status,
// dimensões, grupos, panorama, centro de aprendizado) como PDF. O cliente
// envia os mesmos dados já extraídos/gerados e mostrados na tela -- o
// servidor só monta o documento, não chama a IA de novo.
router.post('/interpret/export-pdf', async (req, res) => {
  const {
    orgName, orgContext, dexiText,
    nivelFinalLabel, capDigitalLabel, capOrganizacionalLabel,
    grupos, panorama, temas, consistenciaOk,
  } = req.body || {};

  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });

  try {
    const buffer = await buildReportPdf({
      orgName,
      orgContext: String(orgContext || ''),
      nivelFinalLabel,
      capDigitalLabel,
      capOrganizacionalLabel,
      grupos: Array.isArray(grupos) ? grupos : [],
      panorama: panorama && typeof panorama === 'object' ? panorama : { respondidos: 0, total: ATTRS.length, maisBaixas: [], maisAltas: [] },
      temas: Array.isArray(temas) ? temas : [],
      consistenciaOk: !!consistenciaOk,
      dexiText: typeof dexiText === 'string' ? dexiText : '',
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${orgName.replace(/\s+/g, '_')}_diagnostico.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error('[export-pdf]', err);
    res.status(500).json({ error: 'Não consegui gerar o PDF: ' + err.message });
  }
});

module.exports = router;
