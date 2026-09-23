# Adendo à Especificação — Rodada 7: Refinamento Visual do Panorama

> Complementa a Rodada 6 (Cockpit de Evolução Digital). Foco exclusivo na seção Panorama —
> Insights e Roadmap não são tocados nesta rodada.

---

## 0. Diagnóstico do pesquisador sobre o Panorama atual

O layout atual está espalhado em seções grandes e separadas (visão inicial, depois capacidades,
depois grupos, depois heatmap/sunburst), o que passa sensação de vazio e pouco detalhamento,
mesmo com bastante conteúdo. O pedido desta rodada é **consolidar visualmente** o que já existe e
**adicionar duas visualizações novas** (árvore de atributos e árvore de oportunidades), sem
aumentar a sensação de dispersão — o oposto do problema atual.

**Nota explícita para não gerar dado inventado**: um pedido de "visão de mercado/benchmark" foi
avaliado e **descartado nesta rodada** — não existe fonte de dado real de mercado disponível no
projeto, e simular isso seria inventar informação, o que contraria a regra central de todo o
projeto. Não implementar nenhuma comparação com "mercado" ou benchmark externo.

## 1. Árvore de atributos (nova visualização)

Uma visualização em árvore (dendrograma), com a raiz em **Maturidade Digital**, ramificando para
as 2 dimensões, depois os 7 grupos, depois os 34 atributos básicos nas pontas — usando a mesma
hierarquia real já extraída de `template.dxi` (a mesma fonte de dados do heatmap e do sunburst
existentes, nunca uma estrutura inventada à parte).

**Coloração dos ramos/nós**: cada atributo (e, se fizer sentido visualmente, cada grupo/dimensão
também) recebe uma cor num gradiente do vermelho ao verde, de acordo com a posição do valor
qualitativo daquele nó na própria escala de 4 níveis (nível 1 de 4 = vermelho, nível 2 = laranja/
amarelo, nível 3 = amarelo-esverdeado, nível 4 = verde) — a cor é sempre derivada do nível real do
DEXi, nunca de uma pontuação numérica inventada.

**Interação**: ao clicar em um atributo na árvore, abrir a mesma tela de zoom/exploração de
atributo que já existe (da Rodada 6) — mostrando o que levou àquele nível (respostas da coleta,
evidência, interpretação). Não duplicar essa lógica, reutilizar o componente já construído.

## 2. Dois gráficos radar lado a lado (substituindo o radar único atual)

Em vez de um único radar combinando os 7 grupos, apresentar **dois radares lado a lado**:
- Radar da **Capacidade Digital** — os 4 grupos (Tecnologia Digital, Papel da TI, Modelo de
  Negócio, Estratégia).
- Radar da **Capacidade Organizacional** — os 3 grupos (Recursos Humanos, Cultura Organizacional,
  Gestão).

Mesma paleta e mesma fonte de dado (resultado oficial do DEXi) do radar atual — só a separação em
dois muda, para permitir comparação lado a lado de cada dimensão isoladamente, em vez de misturar
as duas escalas num único gráfico.

## 3. Consolidação do layout — "visão inicial" + "capacidades" juntas

Agrupar em uma única seção compacta (não mais telas/blocos grandes e separados):
1. A abertura executiva (nome da organização, resultado geral, data);
2. Os dois radares lado a lado (item 2 acima);
3. Os elementos que já existiam nessa parte (heatmap, sunburst) permanecem, mas revisar o
   espaçamento para reduzir a sensação de dispersão — menos "seções empilhadas", mais "um painel
   coeso".

Objetivo: a pessoa entende o essencial rolando pouco, sem passar por vários blocos grandes e
soltos em sequência.

## 4. Árvore de oportunidades

Uma segunda visualização em árvore, com a mesma estrutura hierárquica da árvore de atributos
(item 1), mas com foco visual nos **pontos de atenção** — os nós de nível mais baixo (vermelho/
laranja) ganham destaque (ex.: maior, mais saturado, ou com um indicador visual de "oportunidade"),
enquanto os nós já desenvolvidos (verde) ficam visualmente discretos. A intenção é que essa
segunda árvore funcione como um mapa rápido de "onde vale focar primeiro" — sempre com base no
resultado real, nunca uma priorização inventada pela IA sem relação com os níveis reais.

## 5. O que não muda

Segue tudo que já estava definido: DEXi como única fonte do resultado oficial, nenhum percentual
inventado, Insights e Roadmap desta rodada ficam como estavam na Rodada 6, identidade visual ORBE
mantida (as cores do gradiente vermelho-verde das árvores são uma exceção pontual e funcional —
sinalizam nível qualitativo, não substituem a paleta de marca no resto da interface).
