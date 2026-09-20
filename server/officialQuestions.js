// Bloco 1 (pergunta oficial) precisa vir daqui, nunca de attr.descricao --
// descricao é uma anotação técnica interna do modelo (ver adendo rodada 3,
// bug corrigido: o Bloco 1 estava mostrando essa anotação em vez da
// pergunta real do formulário do orientador).
const fs = require('fs');
const path = require('path');

const OFFICIAL_QUESTIONS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'perguntas_oficiais.json'), 'utf-8')
);

function questionFor(attrId) {
  return OFFICIAL_QUESTIONS[attrId];
}

module.exports = { OFFICIAL_QUESTIONS, questionFor };
