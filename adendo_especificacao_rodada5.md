# Adendo à Especificação — Rodada 5: Painel Mais Robusto e Identidade Visual ORBE

> Complementa os adendos anteriores. Foco: elevar a Etapa 3 (interpretação) de "funcional" para
> "produto acabado", e aplicar a identidade visual definitiva (logo próprio do pesquisador).

---

## 1. Painel de interpretação — mais visões e análises

**Referência visual direta**: use o mockup em `orbe_identidade_visual_e_mockup.png` (anexo) como
guia concreto de direção — ele já mostra a estrutura esperada: menu lateral (Diagnóstico /
Dimensões / Atributos / Evolução / Relatórios), indicador circular de percentual para o resultado
geral, cards de dimensões com barra de progresso, lista de "atributos em destaque", e um card de
"próximos passos". Não copiar pixel a pixel, mas seguir essa lógica de organização — é a direção
de produto que o pesquisador já validou visualmente.

O painel atual (Rodada 3) já tem status geral, dois gráficos e o centro de aprendizado. Elevar
isso com mais profundidade analítica, sempre respeitando a regra de ouro: **todo número exibido
vem do resultado oficial do DEXi ou da coleta — nunca calculado ou inventado pela IA.**

**1.1 Visão por grupo, não só por dimensão.** Além dos dois gráficos já existentes (posição nas
duas dimensões + radar dos 7 grupos), adicionar uma visão que permita explorar **cada grupo
individualmente** (ex.: clicar em "Tecnologia Digital" e ver o detalhamento dos atributos básicos
que o compõem, com o valor de cada um). Isso dá profundidade sem sobrecarregar a tela principal —
detalhe sob demanda, não tudo de uma vez.

**1.2 Pontos fortes e pontos de atenção, como lista visual.** Uma seção dedicada — não misturada
no texto corrido — listando os atributos com melhor e pior desempenho, com indicador visual de
cor (verde/amarelo, seguindo a paleta oficial) e um resumo de uma linha para cada, vinculado à
resposta que a organização deu na coleta (rastreabilidade já exigida na especificação original).
No mockup, essa lógica aparece como "Atributos em destaque".

**1.3 Comparação entre dimensões com mais contexto.** O gráfico de posição das duas dimensões
(já existente) pode ganhar uma legenda/explicação inline de onde a organização está em relação às
quatro classificações finais possíveis (Ficando Atrás/Inicial/Avançado/Vencedor Digital) — hoje
isso só aparece como texto separado; unificar visualmente com o gráfico ajuda a leitura. No
mockup, o indicador circular de percentual com selo de classificação (ex.: "Avançado") cumpre
essa função — usar como referência.

**1.4 Consistência com o centro de aprendizado.** As sugestões do centro de aprendizado (Rodada
3, seção 1e) devem referenciar visualmente quais atributos fracos motivaram cada sugestão — hoje
a ligação existe no texto, mas pode ficar mais clara com uma referência visual direta (ex.: uma
etiqueta indicando de qual grupo/atributo aquela sugestão de estudo partiu). No mockup, o card
"Próximos passos" é a referência direta dessa seção.

**Nota importante sobre o mockup**: os números e percentuais que aparecem nele (64%, 59%, 41%,
etc.) são ilustrativos, criados só para compor a peça de design — não são valores reais nem
regra de cálculo. O painel continua obrigado a mostrar sempre o resultado real do DEXi.

## 2. Sensação de produto, não de formulário

Aplicar em toda a aplicação (Etapa 1 e Etapa 3), não só no painel:

- **Nome do produto: ORBE** ("Visão Integrada"). Usar esse nome de forma consistente no
  cabeçalho, na aba do navegador (title), e onde fizer sentido na comunicação da aplicação.
- **Navegação persistente**: um cabeçalho fixo simples (logo ORBE + nome), visível em todas as
  telas, para dar sensação de aplicativo contínuo, não de páginas soltas. O mockup sugere também
  um menu lateral na Etapa 3 (Diagnóstico / Dimensões / Atributos / Evolução / Relatórios) — bom
  padrão a seguir se a estrutura de conteúdo do painel comportar essas seções.
- **Transições suaves** entre telas/blocos (nada exagerado — só evitar o "pulo seco" de conteúdo
  trocando instantaneamente).
- **Cards e espaçamento consistentes** — revisar se a mesma lógica visual (cantos, sombra leve,
  respiro) se repete em todas as telas, não só nas mais recentes.
- Evitar aparência de "formulário longo" na Etapa 1 — o layout de 4 blocos já ajuda nisso, mas
  vale revisar se a transição entre atributos parece "próxima pergunta do formulário" ou "próximo
  passo de uma jornada guiada". A segunda é o objetivo.

## 3. Identidade visual — logo ORBE (arquivos fornecidos)

Arquivos anexos a este adendo:
- `orbe_logo_fundo_branco.png` — lockup principal (ícone + "ORBE" + "Visão integrada"), fundo
  branco.
- `orbe_logo_fundo_azul.png` — mesmo lockup, fundo no tom de azul claro (`#DFECF2`) já usado como
  fundo padrão da aplicação — provavelmente a versão mais direta para usar como está.
- `orbe_identidade_visual_e_mockup.png` — peça de referência com significado da marca, função de
  cada cor, e o mockup de produto citado na seção 1.

Usar exatamente esse material — não gerar um logo novo nem adaptar livremente o desenho da marca.
Aplicar:
- Como favicon da aplicação (derivar um recorte só do símbolo, sem o texto "ORBE", para os
  tamanhos pequenos de favicon/ícone — sem alterar o desenho, só recortar/redimensionar).
- No cabeçalho persistente (item 2).
- Na tela de abertura.
- No cabeçalho do PDF exportado.

**Nota sobre a função das cores, confirmada pelo material oficial**: Azul Profundo = organização/
ponto de partida; Azul Digital = conhecimento; Verde Inteligência = a IA que conecta e interpreta;
Amarelo Evolução = o diagnóstico que revela oportunidades; Vermelho = identidade/origem
institucional. Isso é consistente com o que já estava em uso — só reforça com a redação oficial
do pesquisador.
