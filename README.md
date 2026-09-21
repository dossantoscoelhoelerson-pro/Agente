# ORBE — Diagnóstico de Maturidade Digital

**ORBE** ("Visão integrada") é a ferramenta de coleta conversacional e interpretação de
resultado para o protótipo de dissertação de mestrado (PROFNIT/UFSJ), aplicando o modelo de
Kljajić Borštnar e Pucihar (2021), com o **DEXi** como motor oficial de cálculo. A
especificação completa está em `especificacao_experiencia_conversacional.md`, com correções
e adições em `adendo_especificacao_rodada2.md`, `adendo_especificacao_rodada3.md`,
`adendo_especificacao_rodada4.md` e `adendo_especificacao_rodada5.md`.

## Arquitetura

- **Backend**: Node.js + Express (`server/`). Único responsável por falar com a API da
  Anthropic -- a chave de API nunca é exposta ao navegador.
- **Frontend**: HTML/CSS/JS vanilla, sem build step (`public/`) -- mesma abordagem do
  protótipo `diagnostico_maturidade_digital.html`, agora chamando o backend próprio em vez
  de `claude.use(...)`.
- **Asset**: `assets/template.dxi` é o template original do modelo DEXi (extraído e validado
  a partir do protótipo), servido como arquivo estático e editado no navegador como texto
  puro (nunca reserializado por um parser XML -- ver seção 7 da especificação). É também a
  fonte da hierarquia raiz/dimensões/grupos e das escalas de 4 níveis usadas no painel da
  Etapa 3 (`server/dexiModel.js`).
- **Tela de cada atributo em 4 blocos** (adendo rodada 2, seção 1): (1) a pergunta oficial,
  literal, vinda de `perguntas_oficiais.json` (nunca de `attr.descricao`, que é uma anotação
  técnica interna do modelo -- bug corrigido na rodada 3), nunca gerada/parafraseada pela IA;
  (2) uma explicação adaptada ao contexto da empresa, gerada pela IA; (3) as 4 alternativas
  oficiais, sempre visíveis como botões, rotuladas com o texto de exibição final em
  `mapeamento_exibicao.json` (adendo rodada 4 -- o valor técnico que vai para CSV/.dxi nunca
  muda); (4) um campo de conversa livre para dúvida ou resposta em texto.
- **Etapa 3 é um painel visual** (adendo rodada 3): status geral (nível final + posição na
  escala de 4 níveis), gráficos SVG (posição nas duas dimensões e radar dos 7 grupos
  intermediários -- sempre extraídos do resultado oficial do DEXi, nunca recalculados),
  panorama da coleta (client-side, a partir das respostas), centro de dúvidas (a conversa,
  agora reativa e como uma seção do painel) e centro de aprendizado (temas de estudo
  vinculados aos pontos de atenção, nunca livros/autores específicos). Aceita upload de PDF
  (o texto é extraído no backend com `pdf-parse`) além de `.txt/.json/.csv`. Tem exportação
  do painel inteiro como PDF (`pdfkit`, server-side).
- **Paleta de cores oficial** (adendo rodada 4, seção 2) aplicada em toda a aplicação --
  tela de coleta, painel, gráficos, botões e PDF exportado (`public/css/styles.css`, com a
  correspondência de cada cor documentada no topo do arquivo). Erros/avisos usam uma cor de
  estado neutra, nunca o Vermelho Identidade (regra explícita do adendo).
- **Textos de abertura e de contextualização da organização**: cópia exata do adendo rodada
  4 (seções 3 e 5), sem paráfrase.
- **Identidade visual ORBE** (adendo rodada 5): logo fornecido pelo pesquisador
  (`public/assets/brand/`), usado exatamente como está -- nunca redesenhado, só
  recortado/redimensionado (favicon derivado só do símbolo, cabeçalho fixo persistente em
  todas as telas, tela de abertura, cabeçalho do PDF exportado). Detalhes da proveniência de
  cada recorte em `public/assets/brand/README.md`. Transições suaves (fade) entre
  telas/blocos e cards/espaçamento revisados em toda a aplicação, não só nas telas mais
  recentes.
- **Painel da Etapa 3 elevado** (adendo rodada 5, seção 1), usando o mockup em
  `orbe_identidade_visual_e_mockup.png` como referência de organização (nunca cópia pixel a
  pixel, e nenhum dos números ilustrativos do mockup foi usado): navegação por abas
  (Diagnóstico / Dimensões / Atributos / Evolução / Relatórios -- adaptação do "menu lateral"
  do mockup para o layout estreito de coluna única já usado no resto da aplicação);
  indicador circular de posição unificado com o selo de classificação (preenchimento é
  sempre a posição do nível oficial dentro da própria escala de 4 níveis, nunca um
  percentual calculado ou inventado); detalhamento por grupo sob demanda (clique em um dos 7
  grupos para ver os atributos básicos que o compõem, com o valor de cada um); lista visual
  dedicada de "atributos em destaque" (pontos fortes/atenção), com indicador de cor e resumo
  de uma linha rastreável até a resposta real da coleta; sugestões do centro de aprendizado
  com etiqueta visual do grupo/atributo que motivou cada uma (validada no servidor contra a
  lista real de pontos de atenção, nunca um texto livre da IA). A aba Evolução não simula um
  histórico entre sessões que a ferramenta não guarda -- mostra a posição atual e é honesta
  sobre essa limitação em vez de inventar uma tendência.

```
Usuário -> [Etapa 1: coleta conversacional] -> CSV + .dxi preenchido
                                                     |
                                 (ETAPA MANUAL, fora da ferramenta)
                                 Usuário importa o .dxi no DEXi,
                                 roda "Evaluate", exporta o resultado
                                                     |
Usuário -> [Etapa 3: upload do resultado] -> painel + centro de dúvidas (IA)
```

## Rodando localmente

```bash
npm install
cp .env.example .env        # edite e coloque sua ANTHROPIC_API_KEY
npm start                   # ou: npm run dev (reinicia sozinho a cada alteração)
```

Abra `http://localhost:3000`.

Variáveis de ambiente (`.env`, nunca comitado):

| Variável            | Obrigatória | Default          |
|---------------------|-------------|-------------------|
| `ANTHROPIC_API_KEY`  | sim         | --                |
| `PORT`               | não         | `3000`            |
| `ANTHROPIC_MODEL`    | não         | `claude-sonnet-5` |

## Deploy

A aplicação é um servidor Node comum (Express servindo API + estáticos) -- roda em
qualquer host que execute Node.js 20+: Render, Fly.io, Railway, um VPS, etc. Basta
configurar `ANTHROPIC_API_KEY` nas variáveis de ambiente do host e rodar `npm start`
(ou `node server/index.js`). Não há dependência de infraestrutura específica de nenhum
provedor -- a escolha de onde hospedar é decisão do time do projeto (ver especificação,
seção 12).

### Deploy no Render sem usar terminal (Blueprint)

O repositório já tem um `render.yaml` na raiz com as configurações preenchidas
(build/start command, branch, plano free). Basta:

1. Ter uma chave da API da Anthropic (console.anthropic.com -> Settings -> API Keys).
2. No painel do Render (render.com): **New + -> Blueprint**.
3. Conectar/selecionar o repositório `dossantoscoelhoelerson-pro/Agente` -- o Render
   detecta o `render.yaml` sozinho.
4. Quando pedir o valor de `ANTHROPIC_API_KEY` (marcada como secreta no blueprint, por
   isso não vem preenchida), colar a chave.
5. Confirmar -- o Render builda e sobe o serviço e entrega uma URL pública
   (`https://diagnostico-maturidade-digital.onrender.com` ou similar).

No plano free o serviço "dorme" após um tempo sem uso -- o primeiro acesso depois disso
pode levar ~30-50s para acordar.

Para hosts serverless (ex. Vercel), os endpoints em `server/routes.js` podem ser adaptados
para funções individuais sem alterar a lógica -- o servidor Express atual é a forma mais
simples de rodar em qualquer outro lugar sem essa adaptação.

## Estrutura

```
server/
  index.js              servidor Express (estáticos + API)
  routes.js               todos os endpoints /api/* (ver abaixo)
  attrs.js                 os 34 atributos básicos (fonte única de verdade)
  officialQuestions.js      carrega perguntas_oficiais.json (Bloco 1)
  displayMap.js             carrega mapeamento_exibicao.json (Bloco 3)
  dexiModel.js              hierarquia raiz/dimensões/grupos e escalas (painel da Etapa 3),
                            extraídas de assets/template.dxi
  prompts.js                prompts dos agentes (explicação, coleta, extração,
                            aprendizado, centro de dúvidas)
  exportPdf.js              monta o PDF do painel (pdfkit)
  anthropicClient.js       cliente da Anthropic + tratamento de erros
public/
  index.html
  css/styles.css
  js/app.js               estado, telas (4 blocos por atributo, painel da Etapa 3 com abas)
  js/dxi.js               decodeTemplate/fillDxi/splitKeepEnds/validateDxi
  js/charts.js             gráficos SVG do painel (dimensões, radar dos grupos, indicador
                            circular de posição na escala)
  assets/
    brand/                 logo ORBE original + derivados só de recorte/redimensionamento
                            (ver public/assets/brand/README.md)
    favicon/                favicon/ícones de app derivados do símbolo do logo
assets/
  template.dxi            template original do modelo DEXi
perguntas_oficiais.json                     pergunta oficial de cada atributo (Bloco 1)
mapeamento_exibicao.json                    técnico -> exibição das 136 alternativas (Bloco 3),
                                             versão final revisada (adendo rodada 4)
```

Endpoints (`server/routes.js`):

| Endpoint | Uso |
|---|---|
| `GET /api/attrs` | os 34 atributos + pergunta oficial + texto de exibição das alternativas + grupo A1-A4/B1-B3 correspondente (`grupoTop`, painel da Etapa 3) |
| `GET /api/dexi-model` | hierarquia raiz/dimensões/grupos + escalas, para o painel |
| `POST /api/collect/explain` | Bloco 2 -- explicação adaptada ao contexto |
| `POST /api/collect/turn` | Bloco 4 -- turno da conversa livre de um atributo |
| `POST /api/extract-pdf` | extrai texto de um PDF enviado (Etapa 3) |
| `POST /api/interpret/extract` | status + dimensões + grupos, extraídos do resultado do DEXi |
| `POST /api/interpret/learning` | centro de aprendizado (temas de estudo) |
| `POST /api/interpret/turn` | centro de dúvidas -- turno da conversa sobre o resultado |
| `POST /api/interpret/export-pdf` | exporta o painel completo como PDF |

## O que ainda falta (pendências conhecidas da especificação)

- Hospedagem definitiva e persistência entre sessões: decisões em aberto, não bloqueiam
  esta primeira versão (ver especificação, seção 12).
- Os rótulos legíveis das 2 dimensões + 7 grupos do painel (`server/dexiModel.js`, campo
  `label`) e a limpeza cosmética dos tokens de escala agregada (`DISPLAY_LEVELS`, ex.
  "Medio.Baixo" -> "Médio-baixo") foram curados por mim a partir do `template.dxi` -- ao
  contrário de `mapeamento_exibicao.json` (revisado pelo pesquisador, rodada 4), esses ainda
  não passaram por revisão humana.
- A paleta de cores oficial não tem uma especificação de modo escuro -- o modo escuro deste
  projeto é uma extensão minha, mantendo os mesmos matizes ajustados de luminosidade
  (documentado no topo de `public/css/styles.css`), não uma decisão do pesquisador.
