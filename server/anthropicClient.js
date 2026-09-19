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
  return res.status(500).json({ error: 'Erro inesperado ao consultar a IA.' });
}

module.exports = { Anthropic, client, MODEL, handleAnthropicError };
