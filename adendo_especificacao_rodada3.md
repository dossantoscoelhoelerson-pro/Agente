# Adendo à Especificação — Rodada 3: Painel Visual da Etapa 3

> Complementa `especificacao_experiencia_conversacional.md` e `adendo_especificacao_rodada2.md`.
> Substitui e detalha a seção 4 do adendo da Rodada 2 ("painel de resultados"), que ainda não
> tinha sido implementada.

---

## 0. Diagnóstico do problema atual

A Etapa 3 hoje é só uma conversa de texto corrido — resultado em markdown, tabela simples, e um
campo de pergunta abaixo. Não há nenhum elemento visual (gráfico, indicador grande, cor
semântica), e a interação inteira depende de o usuário ler texto e digitar perguntas. Isso está
abaixo do padrão esperado para a entrega final — precisa virar um painel de verdade, no estilo de
uma ferramenta de BI/centro de controle, mantendo a conversa como um componente a mais, não como
a única forma de interação.

## 1. Estrutura do novo painel

Ao carregar o resultado do DEXi, a tela deve apresentar, nesta ordem, como um painel (não como
uma sequência de mensagens de chat):

**(a) Status geral — visual e grande.** O nível final (`MATURIDADE.DIGITAL`) em destaque máximo
na tela — tipografia grande, com indicador visual de posição na escala de 4 níveis (ex.: uma
barra ou selo mostrando onde "Inicial" fica entre Ficando Atrás/Inicial/Avançado/Vencedor
Digital). Sempre com o rótulo "Resultado oficial do DEXi" visível — nunca deixar essa origem
implícita.

**(b) Gráficos das duas dimensões.** Pelo menos dois gráficos:
- Um gráfico de posição das duas dimensões (Capacidade Digital x Capacidade Organizacional),
  no estilo do gráfico de dispersão usado no artigo original de referência (Kljajić Borštnar &
  Pucihar, 2021, Figura 4) — eixo X = Capacidade Digital, eixo Y = Capacidade Organizacional.
- Um gráfico radar/polar por grupo intermediário (A1-A4 e B1-B3), no estilo da Figura 5 do
  mesmo artigo, mostrando onde cada grupo está na escala.
Os valores dos gráficos vêm sempre do resultado oficial do DEXi — nunca recalculados pela IA.

**(c) Panorama por etapa/processo.** Uma visão resumida do caminho percorrido — quantos atributos
foram avaliados, principais respostas que mais pesaram no resultado — como uma seção de contexto,
não como texto corrido.

**(d) Centro de dúvidas (conversa).** A conversa que já existe hoje (perguntar "por quê", pedir
simulação, etc.) continua existindo, mas como **uma seção do painel**, não como a tela inteira.

**(e) Centro de aprendizado.** Com base nos pontos de atenção identificados no diagnóstico,
sugerir **temas e áreas de estudo** para a organização evoluir — não recomendações genéricas de
transformação digital, e sim ligadas aos atributos específicos que ficaram mais fracos (mesma
regra de vínculo com o diagnóstico já definida na especificação original, seção 9).

> **Cuidado importante nesta seção**: a IA não deve citar livros, autores ou fontes específicas
> como se fossem recomendações verificadas — isso arrisca inventar referências que não existem ou
> não são exatamente relevantes (alucinação de citação). Prefira sugerir **temas/áreas de
> conhecimento** (ex.: "gestão ágil", "liderança para transformação digital", "cultura de
> inovação organizacional") em vez de títulos específicos de livros com autor. Se o usuário pedir
> uma indicação de leitura específica, aí sim a IA pode sugerir, mas deixando claro que é uma
> sugestão da IA, não uma referência bibliográfica curada/verificada pelo projeto.

## 2. Exportação em PDF

Adicionar um botão para baixar o resultado completo (status, gráficos, panorama, recomendações do
centro de aprendizado) como PDF, gerado no backend (agora que existe servidor de verdade, isso é
viável — ex. com uma biblioteca de geração de PDF em Node a partir de HTML/dados). O PDF deve
preservar a mesma separação entre resultado oficial, interpretação e recomendação que já existe
na tela.

## 3. O que não muda

Todas as regras já definidas continuam valendo integralmente: o DEXi como única fonte do
resultado oficial, a separação entre resultado/interpretação/simulação/informação da organização,
simulação sempre rotulada, recomendações como possibilidade e não prescrição, transparência sobre
a origem das regras de agregação quando perguntado.
