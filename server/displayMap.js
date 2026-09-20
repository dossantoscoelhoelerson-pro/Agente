// Tabela de mapeamento técnico -> exibição, versão final revisada linha a
// linha pelo pesquisador (mapeamento_exibicao.json, ver
// adendo_especificacao_rodada4.md seção 1 -- substitui em definitivo o
// antigo mapeamento_exibicao_rascunho.json, aposentado). Usada SOMENTE na
// camada de exibição do Bloco 3 (as 4 alternativas oficiais) -- o valor
// técnico que vai para CSV/.dxi/registro nunca muda, continua sendo
// attr.niveis[i] como sempre foi.
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'mapeamento_exibicao.json'), 'utf-8')
);

const DISPLAY_MAP = {}; // attrId -> { tecnico: exibicao }
raw.forEach((r) => {
  if (!r || typeof r.atributo !== 'string' || typeof r.tecnico !== 'string') return;
  (DISPLAY_MAP[r.atributo] || (DISPLAY_MAP[r.atributo] = {}))[r.tecnico] = r.exibicao;
});

// Fallback defensivo caso um valor técnico não esteja na tabela (não deve
// acontecer -- a tabela final cobre as 136 combinações -- mas evita
// quebrar a tela se o modelo de atributos mudar no futuro): só remove os
// pontos separadores, sem tentar adivinhar acentuação.
function displayLabel(attrId, tecnico) {
  const curated = DISPLAY_MAP[attrId] && DISPLAY_MAP[attrId][tecnico];
  if (curated) return curated;
  return String(tecnico).replace(/\./g, ' ');
}

module.exports = { DISPLAY_MAP, displayLabel };
