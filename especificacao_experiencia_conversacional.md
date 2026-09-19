# Especificação — Experiência Conversacional da Ferramenta de Diagnóstico de Maturidade Digital

> Este documento é a especificação completa para construir a aplicação web. Ele consolida tudo
> que já foi definido, testado e validado ao longo do projeto — a ideia é que você (Claude Code)
> leia isto e já tenha contexto suficiente para construir sem precisar redescobrir decisões já
> tomadas. Pergunte apenas o que genuinamente não está coberto aqui.

---

## 1. Contexto do projeto

Esta é a ferramenta de um protótipo de dissertação de mestrado (PROFNIT/UFSJ), que aplica o
modelo acadêmico de **Kljajić Borštnar e Pucihar (2021)** — "Multi-Attribute Assessment of
Digital Maturity of SMEs" — usando o software **DEXi** como motor oficial de cálculo do
diagnóstico. A IA nunca substitui o DEXi; ela é a camada de interação — coleta, estrutura, e
depois interpreta o resultado que o DEXi calculou.

## 2. Arquitetura (preservar exatamente)

```
Usuário -> [Ferramenta: coleta conversacional] -> CSV + .dxi preenchido
                                                        |
                                    (ETAPA MANUAL, fora da ferramenta)
                                    Usuário importa o .dxi no DEXi,
                                    roda "Evaluate", exporta o resultado
                                                        |
Usuário -> [Ferramenta: upload do resultado] -> relatório de interpretação (IA)
```

**Não automatize a etapa do DEXi.** Isso é intencional — o DEXi precisa continuar sendo a
referência oficial do diagnóstico, por definição metodológica do projeto. A ferramenta é **uma
única aplicação**, não "dois agentes separados" — a pessoa não deve sentir uma transição abrupta
entre a parte de coleta e a parte de interpretação, mesmo com a pausa manual no meio.

## 3. Ponto de partida

Existe um protótipo funcional em `diagnostico_maturidade_digital.html` (arquivo único, HTML/CSS/
JS vanilla, sem dependências externas de build) que já implementa boa parte disto e foi testado.
Use-o como referência de comportamento e, na medida do possível, como base de código — ele já
contém:
- os 34 atributos básicos embutidos (nome, descrição, dimensão, grupo, as 4 alternativas de cada);
- o algoritmo de preenchimento do `.dxi`, validado byte a byte contra a saída de um script Python
  equivalente e contra um `.dxi` real exportado pelo próprio DEXi;
- a lógica de conversa turno a turno via chamada de IA.

**O que muda na versão que você vai construir**: no protótipo, as chamadas de IA usam uma API
disponível apenas dentro do preview de artifacts do Claude.ai (`claude.use('sample')`,
`claude.use('downloads')`) — isso **não existe** fora daquele ambiente. Na aplicação real, você
precisa:
- Integrar com a **API da Anthropic** de verdade (`https://api.anthropic.com/v1/messages`), com
  a chave de API guardada no backend (nunca exposta no frontend).
- Implementar download de arquivo com o método padrão do navegador (Blob + link), já que fora do
  Claude.ai isso funciona normalmente sem precisar de nenhuma capability especial.

## 4. Modelo de dados dos 34 atributos

Cada atributo tem: `id` (nome oficial, ex. `"Blockchain"`), `descricao` (texto explicativo,
extraído do arquivo do modelo — trate como a base da pergunta, não como pergunta pronta), 4
`niveis` (as alternativas oficiais, do pior para o melhor, ex. `["Nao.utiliza", "Sem.necessidade",
"Planeja", "Utiliza"]`), `dimensao` ("Capacidade Digital" ou "Capacidade Organizacional") e
`grupo` (o atributo agregado pai na hierarquia). Esses dados já estão embutidos no protótipo — use
a mesma lista, na mesma ordem (a ordem reproduz a estrutura do artigo original e não pode ser
alterada).

**Pendência conhecida**: o formulário com a redação oficial e definitiva de cada pergunta (fora da
descrição já disponível) ainda não foi entregue pelo pesquisador. Até lá, o `descricao` de cada
atributo é a base legítima e provisória da pergunta — não invente um texto de pergunta diferente
disso.

## 5. Regra de fidelidade (inegociável)

- O texto das 4 alternativas de cada atributo nunca pode ser reescrito, resumido, traduzido ou
  parafraseado — em nenhuma tela, nenhum botão, nenhum arquivo de saída.
- Nunca existe uma 5ª alternativa (nem "outra opção", nem "não sei", nem "pular") como opção
  selecionável formalmente — dúvida se resolve com esclarecimento + reapresentação das mesmas 4.
- A ordem dos 34 atributos é fixa.
- A IA nunca infere uma resposta com base no setor/perfil da organização sem informação
  específica sobre o próprio atributo.

## 6. Etapa 1 — Coleta conversacional

Não é um formulário estático — é uma conversa real, com a IA decidindo o próximo passo a cada
turno (chamada de API por turno, não um script fixo de perguntas).

**Fluxo por atributo**: contextualizar (1 frase) -> pergunta aberta -> avaliar se a resposta já é
suficiente para identificar a alternativa -> aprofundar só se necessário (nunca por segurança
excessiva) -> apresentar as 4 alternativas oficiais para escolha -> registrar assim que houver
clareza, sem pedir confirmação redundante.

**Entrada híbrida, sempre visível ao mesmo tempo**: a cada turno, o usuário tem tanto as 4
alternativas como botões/cards clicáveis (quando a IA decidir que é hora de apresentá-las) quanto
um campo de texto livre sempre disponível — nunca uma coisa escondendo a outra. Clicar num botão
oficial registra direto (o clique já é confirmação). Texto livre volta para a IA interpretar.

**O contrato de resposta da IA a cada turno** (já testado no protótipo, formato JSON):
```json
{"action": "ask" | "present_options" | "register",
 "message": "texto curto e natural para o usuário",
 "chosen": "uma das 4 alternativas oficiais, exatamente como escrito -- só quando action=register"}
```

**Tom**: acolhedor, natural, consultivo — nunca burocrático ou robótico. Isso é sobre a moldura da
conversa (como a IA fala), nunca sobre o conteúdo oficial (pergunta/alternativas), que é sempre
literal.

**Progresso**: mostrar de forma simples (ex. "atributo 12 de 34"), sem poluir a tela.

**Correção**: o usuário pode voltar a um atributo anterior e mudar a resposta a qualquer momento,
sem que isso afete outros atributos já registrados.

## 7. Saída da Etapa 1 — três arquivos

Ao final dos 34 atributos, gerar:

**(a) CSV**: uma coluna por atributo (nome exato), uma linha com os valores (nomes exatos das
alternativas escolhidas).

**(b) JSON estruturado**: `{organizacao, contexto_organizacao, respostas: {atributo: alternativa},
registro_completo: [...]}` — o `registro_completo` guarda, por atributo, a resposta e o histórico
relevante da conversa, para uso posterior na interpretação (Etapa 3).

**(c) `.dxi` preenchido, pronto para importar no DEXi.** Esta é a parte mais sensível
tecnicamente — siga exatamente esta técnica, já validada:

- O template original do `.dxi` (arquivo XML) precisa estar disponível para a aplicação (como um
  asset estático do projeto).
- **Nunca reserialize o XML inteiro usando uma biblioteca XML genérica** (isso já causou um bug
  real: bibliotecas como `xml.etree.ElementTree` do Python, ou equivalentes em JS que parseiam e
  reescrevem a árvore inteira, trocam aspas duplas por simples na declaração `<?xml version="1.0"
  encoding="UTF-8"?>` e alteram a quebra de linha de `\r\n` para `\n` — o DEXi rejeita o arquivo
  resultante com o erro "Missing or unrecognized XML header").
- **A técnica correta**: editar o arquivo como **texto puro, linha a linha**, preservando cada
  byte original, e substituindo apenas o conteúdo das linhas `<OPTION>...</OPTION>`. Cada
  atributo no template tem 3 linhas `<OPTION>*</OPTION>` (placeholders para até 3 organizações de
  teste) logo após seu bloco `<SCALE>` (se básico) ou `<FUNCTION>` (se agregado), antes de
  qualquer atributo filho aninhado. O algoritmo:
  1. Percorrer o arquivo linha por linha, mantendo o nome do atributo atual (a última
     `<NAME>...</NAME>` cuja linha seguinte contém `<DESCRIPTION>`).
  2. Antes do primeiro `<ATTRIBUTE>` do documento, há 3 linhas `<OPTION>Organizacao.X</OPTION>` —
     colapsar para 1 linha com o nome real da organização avaliada.
  3. Para cada atributo: ao encontrar uma sequência de linhas `<OPTION>*</OPTION>` (normalmente
     3), colapsar para 1 linha. Se o atributo é um dos 34 básicos, o valor vira o **índice
     numérico** (0 a 3) da alternativa escolhida, na mesma ordem da lista `niveis`. Se é um dos 17
     atributos agregados (ou a raiz), o valor continua `*` — o DEXi calcula isso sozinho ao rodar
     "Evaluate".
  4. Nada mais no arquivo é tocado — hierarquia, escalas, funções `LOW`, regras, tudo permanece
     idêntico ao template.
- **Validação antes de entregar o arquivo**: confirmar que a primeira linha usa aspas duplas
  (`encoding="UTF-8"`, não aspas simples), e que o número de atributos agregados+raiz com `*`
  restante é **17** (não 18 — esse foi um erro cometido e corrigido durante o desenvolvimento;
  são 34 básicos + 17 não-básicos = 51 atributos no total). Se a validação falhar, ainda assim
  entregue o arquivo, mas avise claramente o usuário — nunca bloqueie silenciosamente o download.
- Existe uma implementação de referência em JavaScript já validada (dentro do
  `diagnostico_maturidade_digital.html`, funções `fillDxi`, `decodeTemplate`, `splitKeepEnds`,
  `validateDxi`) — pode reaproveitar diretamente.

## 8. Etapa 2 — tela de instrução manual

Uma tela simples, sem interação de IA, explicando: importar o `.dxi` (ou CSV) no DEXi, rodar
"Evaluate", exportar o resultado, e voltar para a ferramenta. Deixe claro que esta etapa é
proposital e não vai ser automatizada.

## 9. Etapa 3 — upload do resultado + relatório de interpretação

Tela de upload (arquivo de texto/JSON/CSV, ou colar texto direto) para o resultado do DEXi. A
ferramenta já tem, da Etapa 1, o `registro_completo` da mesma sessão — não precisa pedir de novo
se for a mesma sessão contínua; se for uma sessão nova, ofereça também o upload do JSON da coleta.

**Regras da interpretação** (mesmo papel do "Agente 2" do projeto):
- O resultado do DEXi é sempre a referência oficial — nunca recalcular, nunca alterar.
- Validar consistência antes de interpretar: mesma organização, mesma rodada, 34 atributos
  presentes, sem duplicidade ou conflito. Se houver divergência, sinalizar e não corrigir
  silenciosamente.
- Diferenciar sempre 4 tipos de conteúdo, nunca apresentados como equivalentes: **resultado
  oficial** (do DEXi), **interpretação** (leitura em linguagem natural), **simulação** (cenário
  hipotético, sempre rotulado como tal e nunca confundido com resultado oficial), **informação da
  organização** (vinda da coleta).
- Recomendações são sempre formuladas como possibilidade ("uma ação possível seria..."), nunca
  como prescrição ("a organização deve...").
- Responder primeiro à pergunta específica do usuário — não despejar um relatório completo por
  padrão; abrir a conversa pelo resultado, com leitura executiva curta, e oferecer aprofundamento.
- Dois níveis de profundidade disponíveis: executivo (padrão, linguagem simples) e técnico (sob
  pedido, com nomes de atributos, regras, cadeia de rastreabilidade).
- Ao explicar a origem do resultado, usar a cadeia: resultado final -> dimensão -> atributo
  agregado -> atributos relevantes -> respostas da organização (Etapa 1).
- Sobre a origem das regras de agregação, se perguntado: só a regra raiz (como Capacidade Digital
  e Capacidade Organizacional se combinam no resultado final) é diretamente sustentada pelo
  artigo original; as regras dos níveis intermediários foram operacionalizadas pelo pesquisador
  para viabilizar a execução no DEXi — isso é uma limitação documentada, não deve ser apresentado
  como se fossem as tabelas originais dos autores.

## 10. Requisitos técnicos gerais

- Aplicação web hospedada, com link próprio (fora do claude.ai).
- Backend simples para intermediar as chamadas à API da Anthropic (a chave de API nunca deve
  ficar exposta no código do frontend).
- Sem necessidade de conta de usuário/login nesta fase — uma avaliação por sessão de navegador é
  suficiente por enquanto.
- Sem persistência de longo prazo obrigatória nesta fase (ok se o progresso se perder ao fechar a
  aba) — pode ser adicionado depois, se fizer sentido.
- Design limpo e profissional, consistente com o protótipo (tipografia serifada para títulos,
  paleta discreta, sem clichês visuais de "SaaS genérico").

## 11. O que já foi validado (não precisa redescobrir)

- O algoritmo de preenchimento do `.dxi` foi testado com dados reais de uma organização e
  comparado byte a byte com a saída de um script Python equivalente — resultado idêntico.
- O resultado final recalculado a partir dos dados preenchidos bateu exatamente com a
  classificação oficial de três organizações de teste avaliadas de fato no DEXi.
- A regra de fidelidade textual (nunca alterar pergunta/alternativas) e a distinção entre os 4
  tipos de conteúdo na interpretação (resultado/interpretação/simulação/informação) foram
  refinadas ao longo de várias rodadas de uso real e são o núcleo metodológico do projeto — não
  simplifique ou remova essas regras para "melhorar a experiência".

## 12. Perguntas em aberto (só pergunte se realmente precisar decidir agora)

- Onde hospedar (Vercel, Netlify, outro) — decisão do usuário, sem preferência técnica forte.
- Se/quando adicionar persistência de dados entre sessões — não é requisito desta primeira versão.
- O formulário oficial com a redação definitiva das perguntas — ainda não existe; use a descrição
  do modelo como base provisória até ser fornecido.
