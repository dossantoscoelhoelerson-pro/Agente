const express = require('express');
const { z } = require('zod');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

const { ATTRS } = require('./attrs');
const { client, MODEL, handleAnthropicError } = require('./anthropicClient');
const {
  COLLECT_SYSTEM_PROMPT,
  buildCollectUserPrompt,
  INTERPRET_SYSTEM_PROMPT,
  buildInterpretContextPrompt,
} = require('./prompts');

const router = express.Router();

const ATTR_INDEX = new Map(ATTRS.map((a) => [a.id, a]));

const TurnSchema = z.object({
  action: z.enum(['ask', 'present_options', 'register']),
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

router.get('/attrs', (req, res) => {
  res.json({ attrs: ATTRS });
});

// Etapa 1 -- um turno da conversa de coleta para UM atributo.
router.post('/collect/turn', async (req, res) => {
  const { attrId, orgName, orgContext, history } = req.body || {};

  const attr = ATTR_INDEX.get(attrId);
  if (!attr) return res.status(400).json({ error: 'attrId inválido.' });
  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });

  const safeHistory = sanitizeHistory(history);

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: COLLECT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        { role: 'user', content: buildCollectUserPrompt(attr, orgName, String(orgContext || ''), safeHistory) },
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
        action: 'present_options',
        message: parsed.message || 'Pode confirmar escolhendo uma das alternativas abaixo?',
      });
    }

    res.json({ action: parsed.action, message: parsed.message, chosen: parsed.chosen });
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

// Etapa 3 -- um turno da conversa de interpretação do resultado do DEXi.
router.post('/interpret/turn', async (req, res) => {
  const { orgName, orgContext, answers, registroCompleto, dexiText, history, userMessage } = req.body || {};

  if (!orgName || typeof orgName !== 'string') return res.status(400).json({ error: 'orgName é obrigatório.' });
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'answers é obrigatório.' });
  if (!dexiText || typeof dexiText !== 'string' || !dexiText.trim()) {
    return res.status(400).json({ error: 'dexiText é obrigatório.' });
  }

  const missing = [];
  const invalid = [];
  ATTRS.forEach((a) => {
    const val = answers[a.id];
    if (!val) missing.push(a.id);
    else if (!a.niveis.includes(val)) invalid.push(a.id);
  });

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
  });

  const safeHistory = sanitizeHistory(history);
  const messages = [{ role: 'user', content: contextPrompt }];
  safeHistory.forEach((m) => messages.push({ role: m.role, content: m.text }));
  if (typeof userMessage === 'string' && userMessage.trim()) {
    messages.push({ role: 'user', content: userMessage.trim() });
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: [{ type: 'text', text: INTERPRET_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages,
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    res.json({
      message: textBlock ? textBlock.text : '',
      consistencia: { completo: missing.length === 0 && invalid.length === 0, atributosFaltando: missing, atributosInvalidos: invalid },
    });
  } catch (err) {
    handleAnthropicError(err, res);
  }
});

module.exports = router;
