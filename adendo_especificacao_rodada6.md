# Adendo à Especificação — Rodada 6: Cockpit de Evolução Digital

> Substitui a Etapa 3 (painel de interpretação) construída nas Rodadas 3-5 por uma experiência
> em três seções — Panorama, Insights, Roadmap — conforme a especificação funcional detalhada
> fornecida pelo pesquisador, refinada e ampliada abaixo. Mantém intactas todas as regras de
> fidelidade metodológica já estabelecidas nos adendos anteriores.

---

## 0. Nota técnica importante — leia antes de implementar

As seções **Panorama** e **Insights** são uma evolução do que já existe (mais visual, mais
interativo, melhor identidade) — **não exigem infraestrutura nova**, dá para construir em cima
do que já está no ar.

A seção **Roadmap** é de natureza diferente: ela pressupõe **dados que persistem entre sessões ao
longo de meses** (ações criadas, status atualizado, revisões de 3/6/12 meses, comparação com
avaliações anteriores). A aplicação hoje não tem banco de dados nem nenhuma forma de identificar
a mesma organização numa visita futura — cada avaliação vive só na sessão do navegador.

**Instrução**: implemente as três seções. Para o Roadmap, se a adição de um banco de dados e um
mecanismo simples de identificação de organização (não precisa ser login completo — pode ser algo
tão simples quanto um código de acesso por organização) representar uma mudança estrutural grande
o suficiente para merecer revisão separada antes de seguir, **pare e avise antes de prosseguir com
essa parte específica**, mesmo que já tenha implementado Panorama e Insights. As duas primeiras
seções podem e devem ser entregues completas de qualquer forma.

---

## 1. PANORAMA — "Onde estamos?"

Camada de visualização do diagnóstico. Sem tabela como abertura — hero section com forte
hierarquia visual, o resultado como elemento dominante da tela.

**Conteúdo, seguindo a especificação fornecida:**
- Abertura: nome da organização, "Diagnóstico de Maturidade Digital", data da avaliação,
  indicadores contextuais (34 atributos · 2 capacidades · 17 atributos agregados), ações
  discretas (Relatório DEXi / Conversar com a IA).
- Resultado de Maturidade Digital em destaque, sobre a escala qualitativa oficial de 4 níveis —
  **nunca como pontuação numérica inventada**. Interação "Como chegamos aqui?" direciona para
  Insights.
- Capacidade Digital e Capacidade Organizacional, apresentação visual comparável (o radar já
  existente pode evoluir para este componente).
- **Visão integrada dos 34 atributos** — heatmap respeitando a hierarquia real
  Capacidade → Grupo → Atributo (usar a estrutura já extraída de `dexiModel.js`, nunca inventar
  agrupamento). Clique num atributo direciona para o contexto correspondente em Insights.
- **Estrutura do diagnóstico** — visualização hierárquica com drill-down (sunburst ou equivalente)
  da árvore real do modelo.
- **Atual × Referência**: só exibir quando houver uma referência real disponível (meta definida
  pela organização, ou avaliação anterior) — nunca simular uma meta ou benchmark que não foi
  fornecido. Diferença sempre qualitativa, nunca percentual artificial.
- **Evolução histórica**: só exibir quando existir mais de uma avaliação real da mesma
  organização — ver nota da seção 0 sobre persistência. Sem isso, omitir a seção (não simular
  linha do tempo vazia).
- Exploração com filtros (Capacidade / Grupo / Nível / Atributo) e busca.
- Transição para Insights ao final, como convite, não como fim de relatório.

## 2. INSIGHTS — "O que isso significa?"

Camada de interpretação — o usuário conversa com o diagnóstico, não só lê.

**Conteúdo:**
- Abertura editorial: síntese curta gerada pela IA, com distinção visual clara entre
  **Resultado** (produzido pelo DEXi), **Interpretação** (o que os dados permitem compreender) e
  **Possibilidades** (o que pode ser explorado) — mesma separação de quatro tipos de conteúdo já
  exigida desde a especificação original, agora com tratamento visual, não só textual.
- **Converse com seu diagnóstico**: chat integrado à experiência (não um botão isolado tipo "abrir
  chatbot"), com perguntas sugeridas ("Por que chegamos a esse resultado?", "Quais nossos pontos
  de força?", etc.) — usa a mesma engine de conversa e regras já implementadas (nunca inventa
  resultado, rotula simulação, etc.).
- Visualização de rastreabilidade: Maturidade → Capacidade → Grupo → Atributo → Resposta →
  Evidência — usa o `registro_completo` real da coleta, nunca texto genérico.
- Pontos de força e pontos de atenção como cards visuais, cada um com atributo/grupo, nível,
  evidência real e interpretação — ação "Perguntar à IA" abre a conversa já contextualizada
  naquele ponto específico.
- Exploração de atributo individual (nível atual, o que foi identificado, evidência, interpretação,
  possibilidades) — substitui e amplia o "centro de aprendizado" das rodadas anteriores; mantém a
  **regra anti-alucinação**: sugestões de estudo por tema/área de conhecimento, nunca citação de
  livro/autor específico como referência verificada.
- Ponte para o Roadmap: "Adicionar ao Roadmap" em qualquer possibilidade relevante.

## 3. ROADMAP — "O que vamos fazer?"

Camada de ação — ver nota técnica da seção 0 antes de implementar.

**Conteúdo, condicionado à decisão de persistência:**
- Timeline visual de 12 meses (0-3 / 3-6 / 6-12 meses), ações como elementos distribuídos nela.
- Cards de ação: origem (vinculada a um atributo/grupo real do diagnóstico — nunca uma ação sem
  rastreabilidade até o resultado), objetivo, responsável, prazo, status.
- "Criar roadmap com IA": a IA pode propor um conjunto inicial de ações a partir do diagnóstico,
  das respostas da coleta e dos pontos de atenção — **toda proposta da IA deve aparecer
  explicitamente rotulada como "Sugestão da IA"**, nunca como plano definido; o usuário decide o
  que entra de fato no Roadmap. Mesma regra de "recomendação como possibilidade, não prescrição"
  já estabelecida.
- Conversa contextual por ação (quebrar em etapas, sugerir indicador, prazo, responsável).
- Acompanhamento visual de status (não iniciadas / em andamento / concluídas / pausadas).
- Revisões de 3, 6 e 12 meses — só fazem sentido com o tempo realmente passando; construir a
  estrutura, mas não há como testar o ciclo completo de forma sintética/imediata. Documentar essa
  limitação de teste no README.

## 4. Identidade visual — elevar, não substituir

**A base é a identidade ORBE já em uso** (paleta oficial, logo, tipografia) — não criar uma
identidade paralela para o Cockpit. Elevar dentro dela:

- Produto deve parecer **aplicação digital contemporânea**: evitar campos excessivos, tabelas
  longas, aparência de sistema administrativo. Privilegiar cards, grandes áreas de respiro,
  tipografia hierarquizada, microinterações, transições suaves.
- Navegação persistente entre as três seções (Panorama | Insights | Roadmap), com a seção atual
  destacada visualmente; a conversa com a IA acessível nas três.
- **Oportunidade técnica**: como esta é uma aplicação Node real (não um artifact do Claude.ai),
  não há mais a restrição de evitar bibliotecas externas — pode usar uma biblioteca de
  visualização de verdade (ex. D3.js) para o heatmap, o sunburst e o dumbbell plot de evolução,
  em vez de construir tudo em SVG manual como nas rodadas anteriores. Escolher a ferramenta que
  produza o melhor resultado visual dentro da paleta oficial.
- Visualidade antes de texto: priorizar forma → gráfico → ícone → número/categoria → texto
  explicativo, sempre que a informação permitir.

## 5. O que não muda (todas as regras já estabelecidas continuam valendo)

- O DEXi continua a única fonte do resultado oficial — nada é recalculado.
- Separação entre resultado / interpretação / simulação / informação da organização, sempre
  visível.
- Simulação sempre rotulada como simulação, nunca confundida com resultado oficial.
- Nenhum percentual, meta ou histórico é inventado quando o dado real não existe — a interface
  omite a seção em vez de simular.
- Regra anti-alucinação de citação no que virou a exploração de atributo/possibilidades de estudo.
- Fidelidade textual das perguntas e alternativas na Etapa 1 — inalterada, esta rodada não mexe
  na coleta.
