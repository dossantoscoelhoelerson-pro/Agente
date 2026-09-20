// Hierarquia e escalas dos 17 atributos agregados + raiz do modelo DEXi,
// extraídas diretamente de assets/template.dxi (o mesmo template oficial
// usado para preencher o .dxi) -- nomes, hierarquia e rótulos de escala
// não são inventados aqui, foram lidos do arquivo real. Usado pelo painel
// da Etapa 3 (adendo rodada 3) para saber quais nomes procurar no
// resultado colado/carregado do DEXi, e como posicionar cada um na escala
// de 4 níveis correspondente.
//
// Os rótulos em `label` (nomes legíveis de dimensão/grupo) e as entradas de
// DISPLAY_LEVELS (limpeza cosmética dos tokens de escala, ex.
// "Medio.Baixo" -> "Médio-baixo") foram curados manualmente, seguindo a
// mesma regra do mapeamento_exibicao_rascunho.json: só legibilidade,
// nenhum valor técnico é alterado.

const GROUP_SCALE = ['Baixo', 'Medio.Baixo', 'Medio.Alto', 'Alto'];

const ROOT = {
  id: 'MATURIDADE.DIGITAL',
  label: 'Maturidade Digital',
  niveis: ['Ficando.Atras', 'Inicial', 'Avancado', 'Vencedor.Digital'],
};

const DIMENSOES = [
  {
    id: 'CAP.DIGITAL',
    label: 'Capacidade Digital',
    niveis: ['Sem.Capacidade', 'Planejando', 'Limitada', 'Plena'],
  },
  {
    id: 'CAP.ORGANIZACIONAL',
    label: 'Capacidade Organizacional',
    niveis: ['Nao.Preparada', 'Planejando.Mudanca', 'Mudando.Lentamente', 'Mudanca.Continua'],
  },
];

// Os 7 grupos intermediários citados no adendo ("A1-A4 e B1-B3") -- filhos
// diretos das duas dimensões. Existem mais 7 subgrupos abaixo destes
// (A11-A13, A31-A32, B11-B12) que já aparecem em ATTRS[].grupo; não são
// usados no painel porque o adendo pede o radar neste nível (A1-A4/B1-B3).
const GRUPOS = [
  { id: 'A1.TEC.DIGITAL', label: 'Tecnologia Digital', dimensaoId: 'CAP.DIGITAL', niveis: GROUP_SCALE },
  { id: 'A2.PAPEL.INFORMATICA', label: 'Papel da TI', dimensaoId: 'CAP.DIGITAL', niveis: GROUP_SCALE },
  { id: 'A3.MODELO.NEGOCIO', label: 'Modelo de Negócio', dimensaoId: 'CAP.DIGITAL', niveis: GROUP_SCALE },
  { id: 'A4.ESTRATEGIA', label: 'Estratégia', dimensaoId: 'CAP.DIGITAL', niveis: GROUP_SCALE },
  { id: 'B1.RECURSOS.HUMANOS', label: 'Recursos Humanos', dimensaoId: 'CAP.ORGANIZACIONAL', niveis: GROUP_SCALE },
  { id: 'B2.CULTURA.ORGANIZACIONAL', label: 'Cultura Organizacional', dimensaoId: 'CAP.ORGANIZACIONAL', niveis: GROUP_SCALE },
  { id: 'B3.GESTAO', label: 'Gestão', dimensaoId: 'CAP.ORGANIZACIONAL', niveis: GROUP_SCALE },
];

const DISPLAY_LEVELS = {
  'Ficando.Atras': 'Ficando atrás',
  'Inicial': 'Inicial',
  'Avancado': 'Avançado',
  'Vencedor.Digital': 'Vencedor digital',
  'Sem.Capacidade': 'Sem capacidade',
  'Planejando': 'Planejando',
  'Limitada': 'Limitada',
  'Plena': 'Plena',
  'Nao.Preparada': 'Não preparada',
  'Planejando.Mudanca': 'Planejando mudança',
  'Mudando.Lentamente': 'Mudando lentamente',
  'Mudanca.Continua': 'Mudança contínua',
  'Baixo': 'Baixo',
  'Medio.Baixo': 'Médio-baixo',
  'Medio.Alto': 'Médio-alto',
  'Alto': 'Alto',
};

function displayLevel(tecnico) {
  if (!tecnico) return null;
  return DISPLAY_LEVELS[tecnico] || String(tecnico).replace(/\./g, ' ');
}

// Todos os nós agregados (dimensões + grupos), para varrer de uma vez.
const ALL_NODES = [...DIMENSOES, ...GRUPOS];

// Mapa dos 12 subgrupos-folha (usados em ATTRS[].grupo) para o grupo
// A1-A4/B1-B3 correspondente -- também extraído de assets/template.dxi.
// Os grupos que já estão no nível A1-A4/B1-B3 mapeiam para si mesmos.
const LEAF_TO_GROUP = {
  'A11.TEC.AVANCADAS': 'A1.TEC.DIGITAL',
  'A12.SMACIT': 'A1.TEC.DIGITAL',
  'A13.TEC.BASICAS': 'A1.TEC.DIGITAL',
  'A2.PAPEL.INFORMATICA': 'A2.PAPEL.INFORMATICA',
  'A3.MODELO.NEGOCIO': 'A3.MODELO.NEGOCIO',
  'A31.CLIENTES': 'A3.MODELO.NEGOCIO',
  'A32.ATIVIDADES': 'A3.MODELO.NEGOCIO',
  'A4.ESTRATEGIA': 'A4.ESTRATEGIA',
  'B11.CULTURA.COLABORADOR': 'B1.RECURSOS.HUMANOS',
  'B12.GESTAO.RH': 'B1.RECURSOS.HUMANOS',
  'B2.CULTURA.ORGANIZACIONAL': 'B2.CULTURA.ORGANIZACIONAL',
  'B3.GESTAO': 'B3.GESTAO',
};

function groupIdFor(leafGrupo) {
  return LEAF_TO_GROUP[leafGrupo] || leafGrupo;
}

module.exports = { ROOT, DIMENSOES, GRUPOS, ALL_NODES, DISPLAY_LEVELS, displayLevel, LEAF_TO_GROUP, groupIdFor };
