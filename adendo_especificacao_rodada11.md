# Adendo à Especificação — Rodada 11: Ajustes Finos de Navegação e Visual

---

## 1. Sidebar com 4 itens, espelhando os caminhos da Home

Trocar os itens atuais da sidebar por estes quatro, sempre clicáveis:
1. **Início** → Home
2. **Conhecer a ORBE** → tela explicativa
3. **Realizar um diagnóstico** → fluxo do Agente 1 (o que hoje é o Card 2 da Home)
4. **Já tenho um diagnóstico** → o caminho que pula a coleta (Card 3 da Home)

O logo da sidebar deve ficar **maior** do que está hoje.

## 2. Logo da Home — redesenho

O logo dentro dos círculos/anéis do Hero está pequeno demais, e tem um **fundo branco visível
diferente da cor de fundo ao redor** (deveria ser transparente, se integrando ao fundo da página,
não um retângulo/círculo branco destacado). Os círculos e anéis em si funcionam bem como conceito
— o problema é a execução: o logo precisa de mais destaque e presença, com fundo realmente
transparente, para dar mais evidência à marca, com um resultado mais profissional.

**Nota técnica para investigar**: esse mesmo problema (fundo branco atrás do logo, em vez de
transparente) aparece em mais de um lugar nesta rodada (ver também item 6) — vale verificar se é
uma regra de CSS compartilhada aplicando fundo branco a todo contêiner de logo, em vez de um
problema isolado por tela.

## 3. Reduzir espaço entre o texto de abertura e "Escolha o que você precisa"

Há espaço em branco excessivo entre o parágrafo de abertura do Hero ("Aqui você encontra uma
experiência completa...") e o título da seção seguinte ("Escolha o que você precisa"). Reduzir
esse espaçamento.

## 4. Selo do Hero — remover ponto final e alinhar estilo

O texto "Seu diagnóstico, com mais inteligência." deve perder o ponto final no fim ("Seu
diagnóstico, com mais inteligência"), e seu estilo tipográfico (peso, tamanho, alinhamento) deve
seguir a mesma linha visual do restante do bloco de abertura do Início — não destoar como um
elemento à parte.

## 5. Unificar os dois campos de upload no caminho "Já tenho um diagnóstico"

Hoje existem dois campos separados — um para o JSON da coleta (opcional) e outro para o resultado
do DEXi (.txt/.json/.csv/.pdf). Avaliar consolidar em **uma única área de upload**, aceitando
qualquer um dos formatos, com o sistema identificando pelo conteúdo/extensão qual arquivo é qual
(resultado do DEXi vs. JSON da coleta) — ou, se não for tecnicamente seguro distinguir
automaticamente os dois tipos, manter duas áreas mas com um design visual muito mais compacto e
unificado (lado a lado ou uma sobre a outra, com pouco espaço entre elas), deixando claro qual é
obrigatório e qual é opcional. Priorizar a solução de campo único se for viável sem ambiguidade.

## 6. Logo com fundo transparente na tela de diagnóstico

Na tela "Onde sua organização está na jornada digital?" (abertura do fluxo de diagnóstico), o
logo aparece com fundo branco em vez de transparente — mesma correção do item 2, aplicar aqui
também.

## 7. O que não muda

Nenhuma regra de fidelidade metodológica ou lógica de dado é alterada nesta rodada — são só
ajustes de navegação, espaçamento, texto e correção de fundo do logo.
