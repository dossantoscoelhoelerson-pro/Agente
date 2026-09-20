// Tabela de mapeamento técnico -> exibição (rascunho curado manualmente em
// mapeamento_exibicao_rascunho.json, ver adendo_especificacao_rodada2.md
// seção 2). Usada SOMENTE na camada de exibição do Bloco 3 (as 4
// alternativas oficiais) -- o valor técnico que vai para CSV/.dxi/registro
// nunca muda, continua sendo attr.niveis[i] como sempre foi.
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'mapeamento_exibicao_rascunho.json'), 'utf-8')
);

const DISPLAY_MAP = {}; // attrId -> { tecnico: exibicao }
raw.forEach((r) => {
  if (!r || typeof r.atributo !== 'string' || typeof r.tecnico !== 'string') return;
  (DISPLAY_MAP[r.atributo] || (DISPLAY_MAP[r.atributo] = {}))[r.tecnico] = r.exibicao_rascunho;
});

// Fallback defensivo caso um valor técnico não esteja na tabela curada:
// só remove os pontos separadores, sem tentar adivinhar acentuação (a
// mesma ressalva do adendo -- adivinhar acento errado é pior que não
// acentuar).
function displayLabel(attrId, tecnico) {
  const curated = DISPLAY_MAP[attrId] && DISPLAY_MAP[attrId][tecnico];
  if (curated) return curated;
  return String(tecnico).replace(/\./g, ' ');
}

module.exports = { DISPLAY_MAP, displayLabel };
