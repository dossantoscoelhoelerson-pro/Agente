# Diagnóstico de Maturidade Digital

Ferramenta de coleta conversacional e interpretação de resultado para o protótipo de
dissertação de mestrado (PROFNIT/UFSJ), aplicando o modelo de Kljajić Borštnar e Pucihar
(2021), com o **DEXi** como motor oficial de cálculo. A especificação completa está em
`especificacao_experiencia_conversacional.md`.

## Arquitetura

- **Backend**: Node.js + Express (`server/`). Único responsável por falar com a API da
  Anthropic -- a chave de API nunca é exposta ao navegador.
- **Frontend**: HTML/CSS/JS vanilla, sem build step (`public/`) -- mesma abordagem do
  protótipo `diagnostico_maturidade_digital.html`, agora chamando o backend próprio em vez
  de `claude.use(...)`.
- **Asset**: `assets/template.dxi` é o template original do modelo DEXi (extraído e validado
  a partir do protótipo), servido como arquivo estático e editado no navegador como texto
  puro (nunca reserializado por um parser XML -- ver seção 7 da especificação).

```
Usuário -> [Etapa 1: coleta conversacional] -> CSV + .dxi preenchido
                                                     |
                                 (ETAPA MANUAL, fora da ferramenta)
                                 Usuário importa o .dxi no DEXi,
                                 roda "Evaluate", exporta o resultado
                                                     |
Usuário -> [Etapa 3: upload do resultado] -> conversa de interpretação (IA)
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

Para hosts serverless (ex. Vercel), os endpoints em `server/routes.js` podem ser adaptados
para funções individuais sem alterar a lógica -- o servidor Express atual é a forma mais
simples de rodar em qualquer outro lugar sem essa adaptação.

## Estrutura

```
server/
  index.js        servidor Express (estáticos + API)
  routes.js        endpoints /api/attrs, /api/collect/turn, /api/interpret/turn
  attrs.js          os 34 atributos básicos (fonte única de verdade)
  prompts.js        prompts dos dois agentes
  anthropicClient.js cliente da Anthropic + tratamento de erros
public/
  index.html
  css/styles.css
  js/app.js          estado, telas, chamadas ao backend
  js/dxi.js          decodeTemplate/fillDxi/splitKeepEnds/validateDxi
assets/
  template.dxi       template original do modelo DEXi
```

## O que ainda falta (pendências conhecidas da especificação)

- A redação oficial e definitiva das 34 perguntas ainda não foi entregue pelo pesquisador
  -- por ora, o campo `descricao` de cada atributo (embutido no protótipo) é a base
  provisória e legítima da pergunta.
- Hospedagem definitiva e persistência entre sessões: decisões em aberto, não bloqueiam
  esta primeira versão (ver especificação, seção 12).
