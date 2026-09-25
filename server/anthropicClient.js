const Anthropic = require('@anthropic-ai/sdk');

// Modelo configurável por ambiente -- default é o Sonnet mais recente,
// bom equilíbrio de qualidade/custo para condução de conversa e interpretação.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn(
    '[aviso] Nenhuma credencial da Anthropic encontrada (ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN). ' +
    'As chamadas de IA vao falhar ate a credencial ser configurada no ambiente do servidor.'
  );
}

const client = new Anthropic();

function handleAnthropicError(err, res) {
  console.error('[anthropic]', err);
  if (err instanceof Anthropic.AuthenticationError || /Could not resolve authentication method/.test(err.message || '')) {
    return res.status(500).json({ error: 'Chave da API da Anthropic ausente ou inválida no servidor (configure ANTHROPIC_API_KEY).' });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return res.status(429).json({ error: 'Limite de requisições à IA atingido -- tente novamente em instantes.' });
  }
  if (err instanceof Anthropic.APIError) {
    return res.status(502).json({ error: `Erro na API da Anthropic: ${err.message}` });
  }
  // client.messages.parse() (respostas em formato estruturado/JSON, usado em
  // vários endpoints via zodOutputFormat) lança um Anthropic.AnthropicError
  // "solto" (não um APIError) quando a resposta veio truncada (max_tokens
  // baixo demais) ou não bateu byte a byte com o schema esperado -- nesses
  // casos o texto de err.message já traz o motivo real, então vale mostrar
  // (a mensagem nunca contém segredo nenhum, só o JSON/erro de validação).
  if (err instanceof Anthropic.AnthropicError) {
    return res.status(502).json({ error: `A IA retornou uma resposta em formato inesperado: ${err.message}` });
  }
  return res.status(500).json({ error: 'Erro inesperado ao consultar a IA.' });
}

module.exports = { Anthropic, client, MODEL, handleAnthropicError };
