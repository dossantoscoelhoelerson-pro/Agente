# ORBE — Diagnóstico de Maturidade Digital

**ORBE** ("Visão integrada") é a ferramenta de coleta conversacional e interpretação de
resultado para o protótipo de dissertação de mestrado (PROFNIT/UFSJ), aplicando o modelo de
Kljajić Borštnar e Pucihar (2021), com o **DEXi** como motor oficial de cálculo. A
especificação completa está em `especificacao_experiencia_conversacional.md`, com correções
e adições em `adendo_especificacao_rodada2.md` até `adendo_especificacao_rodada8.md`.

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
- **Home é a porta de entrada** (`screenHome()`/`screenAbout()` em `public/js/app.js`,
  adendo rodada 9) -- sidebar fixa com 4 itens sempre clicáveis, espelhando os três
  caminhos abaixo mais a própria Início (rodada 11, seção 1), hero com ilustração
  orbital em SVG (nenhuma foto foi fornecida como asset) e três caminhos:
  1. **"Conhecer a ORBE"** -- tela nova e só explicativa (`screenAbout()`): o que é a
     ferramenta, o papel da IA, a base metodológica (Kljajić Borštnar & Pucihar, 2021 /
     DEX/DEXi), com uma camada `<details>` opcional mais técnica e um cartão de atribuição
     acadêmica (autor, orientador, PROFNIT/UFSJ, com links para os sites oficiais).
  2. **"Diagnóstico de Maturidade Digital"** -- fluxo já existente (`screenIntro()` →
     coleta → DEXi manual → upload → Panorama), sem nenhuma mudança de lógica.
  3. **"Já tenho um diagnóstico"** -- pula a Etapa 1 inteira direto para
     `screenUpload()` (`state.skipCollection = true`), pedindo só o nome da organização
     (que normalmente viria da Etapa 1). Sem `registro_completo`, a rastreabilidade do
     Insights mostra uma nota breve e discreta em vez do atributo/resposta específicos --
     nunca um alerta de abertura, e nunca bloqueia o fluxo.
  O topo direito (notificação/avatar "Visitante") é um placeholder estático coerente com
  a identidade visual -- a aplicação não tem sistema de login nesta fase (decisão em
  aberto desde a rodada 6, junto com a persistência do Roadmap).
- **Etapa 3 aceita o resultado do DEXi** por upload de PDF (texto extraído no backend com
  `pdf-parse`) ou `.txt/.json/.csv` colado/carregado.
- **Etapa 3 é o "Cockpit de Evolução Digital"** (adendo rodada 6, substitui o painel das
  rodadas 3-5): três seções que são três momentos metodológicos da jornada, não só três
  páginas -- **Panorama** ("Onde estamos?", visualizar), **Insights** ("O que isso
  significa?", interpretar/explorar) e **Roadmap** ("O que vamos fazer?", agir). Todas
  partem do mesmo resultado oficial extraído do DEXi (`POST /api/interpret/extract`, nunca
  recalculado). Detalhes de cada seção em `public/js/cockpit.js`:
  - **Panorama** (`screenPanorama()` em `public/js/cockpit.js` -- estrutura consolidada na
    rodada 9, refino visual da rodada 7): "estado geral → perfil → estrutura → leitura geral
    → árvore de atributos → capacidades → explorar → zoom", oito seções que se sucedem como
    uma leitura progressiva, não gráficos concorrendo por atenção. (1) Abertura com nome,
    contexto da organização (texto literal da coleta, nunca decomposto/inferido em
    setor/porte/local por IA) e indicadores reais. (2) Resultado em destaque com indicador
    circular unificado ao selo de classificação (a posição do nível oficial na própria
    escala de 4 níveis, nunca um percentual calculado), e logo abaixo, no mesmo cartão,
    **duas faixas qualitativas horizontais** para as capacidades Digital e Organizacional
    (substituíram o mapa de dispersão + radares da rodada 7 -- menos elementos, nenhuma
    leitura de "escala 0-100"). (3) **Estrutura do diagnóstico** (sunburst D3, fundo cinza
    claro, alinhado à esquerda -- verde/amarelo já têm significado semântico específico no
    resto da aplicação, ver rodada 10 seção 9) e **Capacidades** (grupos de cada dimensão
    como barras qualitativas horizontais) lado a lado no mesmo `.cockpit-grid-2`, para
    ficarem no mesmo campo de visão (pedido do usuário, rodada 10). (4) **Árvore de
    atributos** (dendrograma D3, raiz em Maturidade Digital, nós coloridos num gradiente
    vermelho→verde conforme o nível real -- exceção pontual e funcional à paleta de marca,
    documentada em `treeLevelColor()`). (5) **Explore seu diagnóstico**: tabela navegável
    (Capacidade/Grupo/Atributo/Nível) com filtros e busca, clicar numa linha abre a
    exploração do atributo. "Atual × Meta" e "árvore de oportunidades" migraram para Roadmap
    e Insights respectivamente (ver abaixo --
    são leitura de futuro/interpretação, não descrição do que foi encontrado). Comparação com
    mercado/benchmark foi avaliada e **descartada deliberadamente** -- não existe dado real
    disponível no projeto para isso.
  - **Insights** (`screenInsights()`; postura conversacional refinada nas rodadas 8-9 -- ver
    `adendo_especificacao_rodada8.md`): síntese de abertura gerada por IA com três blocos
    visualmente distintos (Resultado -- montado no cliente a partir do dado real, nunca da IA
    --, Interpretação e Possibilidades), **árvore de oportunidades** (dendrograma D3 com os
    pontos de atenção em destaque -- migrada do Panorama, por ser leitura interpretativa),
    cards de pontos fortes/pontos de atenção, exploração de atributo individual (reaproveita
    a explicação do Bloco 2 já gerada na Etapa 1 quando disponível, sem chamada nova). **O
    consultor ORBE** ("Vamos entender esse resultado.") é o coração desta seção: a primeira
    mensagem do chat já abre contextualizada (reaproveita a síntese já gerada, sem chamada
    nova à IA só para o texto de abertura) com **caminhos concretos como chips clicáveis**
    (os grupos reais da dimensão mais fraca no resultado). A cada resposta do agente
    (`POST /api/interpret/turn`, saída estruturada validada contra os nomes reais de
    dimensão/grupo/atributo -- nunca um nome inventado), novos chips aparecem para continuar
    a conversa sem reformular a pergunta do zero. Postura definida em
    `INTERPRET_SYSTEM_PROMPT` (`server/prompts.js`): consultor, nunca auditor/FAQ -- responde
    primeiro a partir do resultado oficial em texto corrido natural; nunca abre com alerta de
    inconsistência (só aparece, curta e contextual, quando relevante para a pergunta feita, e
    só interrompe a resposta quando impede responder com segurança); nunca termina com
    pergunta genérica de fechamento; usa o histórico da conversa para resolver referências
    implícitas ao que já foi discutido. Nenhuma regra de fidelidade ao resultado do DEXi
    muda -- é só o comportamento conversacional que é refinado.
  - **Roadmap** (`screenRoadmap()`): "Atual × Meta" (meta escolhida pelo usuário nesta
    sessão -- migrada do Panorama, por ser pergunta de gestão/futuro, nunca inventada nem
    persistida), timeline de 12 meses (0-3/3-6/6-12), ações criadas manualmente ou propostas
    pela IA a partir dos pontos de atenção (sempre rotuladas "Sugestão da IA", nunca
    autoaceitas), conversa contextual por ação, status (não iniciada/em andamento/
    concluída/pausada). **Funciona só com estado de sessão** (igual ao resto da aplicação
    hoje -- nada persiste entre sessões): revisões de 3/6/12 meses, comparação com uma
    avaliação anterior real e retomar o roadmap numa visita futura exigiriam um banco de
    dados e um mecanismo de identificação de organização entre sessões -- mudança estrutural
    deliberadamente **não implementada** (ver nota explícita na própria tela do Roadmap e na
    seção 0 do adendo rodada 6).
  - **D3.js** é servido localmente (`public/js/vendor/d3.min.js`, ver o README ao lado) --
    não por CDN externo, para não depender de um serviço de terceiros no host de deploy.
  - Exportação do Cockpit inteiro como PDF continua disponível (`pdfkit`, server-side) --
    a seção "Centro de aprendizado" do PDF agora mostra as ações do Roadmap.
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
  js/app.js               estado compartilhado, roteador de telas, Home e os três
                            caminhos (adendo rodada 9), Etapa 1 (4 blocos por atributo),
                            extração do resultado do DEXi (ensurePanel)
  js/cockpit.js             Cockpit de Evolução Digital -- Panorama/Insights/Roadmap
                            (adendo rodada 6)
  js/dxi.js               decodeTemplate/fillDxi/splitKeepEnds/validateDxi
  js/charts.js             gráficos SVG pequenos reaproveitados no Panorama (comparação das
                            capacidades, indicador circular de posição na escala)
  js/vendor/               bibliotecas de terceiros servidas localmente (D3.js -- ver
                            public/js/vendor/README.md)
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
| `POST /api/interpret/extract` | status + dimensões + grupos, extraídos do resultado do DEXi (base de todo o Cockpit) |
| `POST /api/interpret/learning` | mantido por compatibilidade (não usado pelo Cockpit atual) |
| `POST /api/interpret/turn` | Insights -- consultor ORBE ("Vamos entender esse resultado."); retorna `message` + `nextSteps` (caminhos concretos validados) |
| `POST /api/interpret/export-pdf` | exporta o Cockpit completo como PDF |
| `POST /api/insights/synthesis` | Insights -- síntese de abertura (interpretação + possibilidades) |
| `POST /api/insights/attribute-explore` | Insights -- possibilidades de evolução de um atributo (exploração individual) |
| `POST /api/roadmap/generate` | Roadmap -- proposta inicial de ações a partir dos pontos de atenção ("Sugestão da IA") |
| `POST /api/roadmap/action-turn` | Roadmap -- conversa contextual sobre uma ação específica |

## Sistema de design

Dois passes sobre a mesma base estrutural (`public/css/styles.css`, bloco `:root`):
um primeiro refinando estrutura/uso sem alterar nenhum matiz de identidade, e a
rodada 9 (`adendo_especificacao_rodada9.md`) trocando os próprios hex da paleta e a
tipografia em toda a aplicação -- Home, coleta, Panorama, Insights, Roadmap e PDF.

- **Paleta oficial (rodada 9)**: `--ink` Azul Profundo `#003F69`, `--blue` Azul
  Digital `#1E8FC8`, `--green` Verde Inteligência `#2BBFB3`, `--yellow` Amarelo
  Evolução `#FDC350`, `--red` Vermelho Identidade `#DF5266` -- mesma função
  semântica de sempre (ver comentário no topo do CSS), só os hex mudaram. O logo
  não muda nunca (arquivo original, sem redesenho). Os fundos estruturais
  (`--paper`/`--paper-raised`/`--etapa1-bg`) são ajustes explícitos de rodadas
  anteriores a pedido do usuário e não foram desfeitos; `--home-bg` (`#F5F3ED`,
  "Off-white" do adendo) é novo, usado só no fundo da Home.
- **Tokens de cor 60/30/10**: 60% neutra dominante (`--paper`/`--paper-raised`/
  `--line`/`--ink`), 30% apoio/navegação (`--ink-soft`/`--blue`), 10% destaque
  pontual (`--green`/`--yellow`, nunca preenchimento amplo).
- **Auditoria WCAG AAA recalculada para os novos tons** (pedido explícito do
  adendo 9): `--ink-soft`, `--blue-soft`/`-strong`, `--green-soft`/`-strong`,
  `--yellow-soft`/`-strong` e `--red-soft` foram todos recalculados a partir dos
  hex novos, mantendo a mesma lógica já estabelecida (badges usam `--ink` como
  cor do texto sobre o próprio fundo "-soft", nunca a cor de expressão; as
  mesmas três exceções documentadas no CSS continuam valendo). Valores de cor
  fixos fora de variável CSS (gráficos em `public/js/charts.js`, gradiente das
  árvores D3 em `public/js/cockpit.js`, PDF exportado em `server/exportPdf.js`)
  foram atualizados manualmente para os novos hex, como o adendo pediu.
- **Tipografia**: Manrope substitui Fraunces + Inter em toda a aplicação --
  uma família única para título e corpo; a hierarquia visual que antes vinha da
  troca serifada/sem-serifa agora vem só do peso (ExtraBold/Bold nos títulos,
  SemiBold em subtítulos, Regular no corpo). Escala geométrica Major Third
  (razão 1.25, `--text-xs` a `--text-2xl`) continua aplicada à hierarquia
  principal de título/leitura; `line-height` 1.6 em blocos de texto; espaçamento
  entre seções sempre o dobro do espaçamento interno dos componentes
  (`--space-component`/`--space-section`).
- **Menos bordas, mais espaço**: cartões cujo fundo já os distingue da página
  (`.card`, `.cockpit-card`, `.roadmap-action-card`, `.insight-card`, `.home-card`
  etc.) usam sombra suave em vez de borda de 1px.
- **Micro-interações**: `--ease-smooth: cubic-bezier(0.25, 1, 0.5, 1)` em botões,
  opções de resposta, itens de navegação, chips e cartões de ação -- hover com
  leve elevação (sombra) e escala até 1.02, `:focus-visible` visível em todos.
- **Ícones chapados/sólidos** (adendo rodada 10, seção 6): substituem os emojis da
  Home (cartões, barra de capacidades, sidebar, notificação) -- `ICON_PATHS`/`icon()`
  em `public/js/app.js`, um único fill sólido nas cores oficiais da marca.
- **Navegação sempre disponível** (rodada 10, seção 1): o logo do cabeçalho fica
  clicável em todas as telas fora da Home, sempre voltando para a Início.
- **Logo atualizado** (rodada 10, seção 3): novo arquivo em PNG com fundo transparente de
  verdade (o pesquisador reenviou como anexo de arquivo, preservando o canal alfa -- a
  primeira tentativa, colada inline no chat, tinha sido reconvertida para `.webp` sem
  transparência), assinatura trocada de "Visão integrada" para "Maturidade Digital", favicon
  regenerado a partir do símbolo. Ver `public/assets/brand/README.md`.
- **Sidebar com 4 itens fixos** (adendo rodada 11, seção 1) -- Início / Conhecer a ORBE /
  Realizar um diagnóstico / Já tenho um diagnóstico, sempre clicáveis (substituem
  Insights/Roadmap, que dependiam de um diagnóstico já carregado -- essa navegação já
  existe dentro do Cockpit via `.cockpit-nav`). Logo da sidebar maior.
- **`orbe_simbolo.png`** (rodada 11, seção 2) -- só o símbolo (sem texto), usado nos
  emblemas pequenos do hero e da seção "Por que a ORBE" em vez do lockup completo: o
  lockup é uma imagem larga (~3:1) com texto, que encolhida virava uma mancha ilegível
  lendo como "uma caixa borrada" -- não era falta de transparência de verdade. O mesmo
  fundo branco (real, não uma ilusão de escala) também foi removido de `.intro-logo` na
  tela de abertura da coleta -- sobrava de quando o PNG antigo tinha fundo sólido
  embutido, virou redundante (e visível) depois que o arquivo passou a ser transparente.
- **Upload consolidado** (rodada 11, seção 5) -- o caminho "Já tenho um diagnóstico" tinha
  duas áreas de upload separadas (JSON da coleta / resultado do DEXi); viraram uma só, que
  reconhece automaticamente qual é qual pelo conteúdo (só o JSON da coleta tem a chave
  `respostas` -- nunca ambíguo, mesmo se o resultado do DEXi também for `.json`).

## O que ainda falta (pendências conhecidas da especificação)

- **Persistência entre sessões (decisão em aberto, adendo rodada 6, seção 0)**: hoje nada
  na aplicação sobrevive a um recarregamento de página -- nem a coleta, nem o resultado do
  DEXi, nem o Roadmap. Isso é suficiente para Panorama e Insights (visualizar/interpretar um
  resultado dentro da mesma sessão), mas limita três coisas específicas do Roadmap/Panorama
  que dependeriam de dados reais entre visitas: revisões de 3/6/12 meses do Roadmap,
  comparação "Atual × Referência" com uma avaliação anterior real, e evolução histórica.
  Implementar isso exigiria um banco de dados simples e um mecanismo de identificação de
  organização entre sessões (não precisa ser login completo -- pode ser um código de acesso
  por organização) -- mudança estrutural deliberadamente deixada para decisão do pesquisador
  antes de implementar, em vez de simular esses dados.
- Hospedagem definitiva: decisão em aberto, não bloqueia esta primeira versão (ver
  especificação, seção 12).
- Os rótulos legíveis das 2 dimensões + 7 grupos do painel (`server/dexiModel.js`, campo
  `label`) e a limpeza cosmética dos tokens de escala agregada (`DISPLAY_LEVELS`, ex.
  "Medio.Baixo" -> "Médio-baixo") foram curados por mim a partir do `template.dxi` -- ao
  contrário de `mapeamento_exibicao.json` (revisado pelo pesquisador, rodada 4), esses ainda
  não passaram por revisão humana.
- A paleta de cores oficial não tem uma especificação de modo escuro -- o modo escuro deste
  projeto é uma extensão minha, mantendo os mesmos matizes ajustados de luminosidade
  (documentado no topo de `public/css/styles.css`), não uma decisão do pesquisador.
