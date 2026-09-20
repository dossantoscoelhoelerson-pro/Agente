# Adendo à Especificação — Correções e Melhorias (Rodada 2)

> Este documento complementa `especificacao_experiencia_conversacional.md`. Aplique junto com
> aquele documento — não o substitui.

---

## 0. Bug bloqueante (verificar primeiro)

O deploy no Render está caindo em modo de fallback ("Não consegui processar essa etapa
automaticamente — Chave da API da Anthropic ausente ou inválida no servidor") em vez de rodar a
conversa de IA. Antes de qualquer melhoria abaixo, confirme que `ANTHROPIC_API_KEY` está
configurada corretamente no ambiente do Render com uma chave válida (não revogada), e que a
aplicação consegue de fato chamar a API com sucesso. Se esse bug for a causa raiz da experiência
parecer "sem conversa" e das alternativas aparecerem em formato cru (ex. `Nao`,
`Reducao.Custos`), corrija isso antes de qualquer trabalho de UX abaixo, e reavalie o
comportamento com a chave funcionando.

## 1. Estrutura de quatro blocos em cada pergunta de atributo

A tela de cada atributo deve ter **quatro blocos visualmente distintos**, sempre nesta ordem —
não é uma única mensagem de chat parafraseada.

**Bloco 1 — Pergunta oficial, literal, seca.** O texto do atributo exatamente como está no
modelo (`descricao` em `modelo_maturidade_digital.json`). **Isso NÃO é o lugar da IA interpretar,
explicar ou reescrever a pergunta.** A única liberdade permitida aqui é cosmética: remover os
pontos separadores e adicionar acentuação (usando a tabela de mapeamento da seção 2 abaixo) — não
é paráfrase, é só melhorar a legibilidade do texto oficial.

> **Erro real já observado, para não repetir**: numa versão anterior, o Bloco 1 apareceu assim
> para o atributo Blockchain: *"Vamos falar sobre o uso de Blockchain na sua organização. Vocês
> já utilizam essa tecnologia, estão planejando adotá-la, ou nunca chegaram a considerar?"* —
> **isso está errado**, é a IA reescrevendo/interpretando a pergunta. O Bloco 1 deve mostrar o
> texto oficial do atributo, seco, sem essa reformulação conversacional.

**Bloco 2 — Explicação adaptada ao contexto da empresa.** Aqui sim a IA pode e deve interpretar
livremente: usar o setor/porte/contexto da organização (informado na abertura da sessão) para
explicar o que a pergunta significa na prática para aquele negócio específico, com exemplos
relevantes ao segmento (ex.: se for uma empresa do agro, os exemplos devem ser do agro). Esta é a
única camada onde a IA "conversa" e adapta.

**Bloco 3 — As 4 alternativas oficiais.** Exatamente as 4 opções da metodologia, sem criar
alternativa extra, sem interpretar, sem parafrasear o texto de cada opção (só a limpeza
cosmética de pontos/acentos da seção 2, se aplicado). Apresentadas como cards/botões clicáveis.

**Bloco 4 — Campo de conversa livre.** Um campo de texto simples, com um placeholder tipo
"Escreva sua dúvida ou sua resposta...", onde o usuário pode tirar dúvida ou responder em texto
livre. É aqui que a IA esclarece, ajuda a encontrar a alternativa certa, e eventualmente registra
a resposta — mas o Bloco 1 e o Bloco 3 nunca mudam de conteúdo por causa dessa conversa.

## 2. Mapeamento técnico → exibição (rascunho já gerado, precisa de revisão)

Pedido: mostrar as alternativas de forma mais legível — sem pontos separando palavras, com
acentuação — mesmo sabendo que, internamente, o valor usado no CSV/`.dxi` continua sendo o nome
técnico exato (ex.: `Nao.necessidade`, sem acento, com ponto).

**Isso é possível, mas com uma ressalva importante**: não dá para gerar a acentuação
automaticamente de forma confiável (um algoritmo que só troca "." por espaço não sabe, por
exemplo, que "Nao" deveria virar "Não" com acento, ou onde exatamente um acento deveria entrar em
cada palavra — isso exigiria adivinhar, e adivinhar errado seria pior que não acentuar).

**A forma correta**: criar uma tabela de mapeamento **curada manualmente** — um dicionário com os
136 valores (34 atributos × 4 alternativas) na forma técnica original e a forma de exibição
correspondente, revisada por uma pessoa (você, ou alguém que confirme a acentuação certa de cada
termo). Essa tabela vive só na camada de exibição — o valor técnico original nunca muda, é ele
que vai para CSV e `.dxi`. Ex.: `{"tecnico": "Nao.necessidade", "exibicao": "Sem necessidade"}`.

Já gerei um rascunho dessa tabela (`mapeamento_exibicao_rascunho.json`, 136 linhas) — precisa de
revisão humana antes de aplicar, especialmente as linhas onde a acentuação foi sugerida
automaticamente. Não aplicar sem revisar.

## 3. Etapa 3 — aceitar PDF do resultado do DEXi

Hoje o upload só aceita `.txt`/`.json`/`.csv`, mas o relatório real exportado pelo DEXi vem em
PDF — por isso não é possível carregar o resultado. Como agora existe um backend de verdade (não
é mais um artifact isolado no navegador), isso pode ser resolvido: extrair o texto do PDF no
servidor (ex. com uma biblioteca de extração de texto de PDF em Node) antes de enviar para a IA
interpretar. Adicionar suporte a `.pdf` no upload da Etapa 3, com extração de texto no backend.

## 4. Painel de resultados — "cockpit" com indicadores visuais e simulação

Além do relatório em texto, adicionar uma visão em painel para os resultados, incluindo:
- Indicadores visuais/gráficos do resultado por dimensão (Capacidade Digital / Capacidade
  Organizacional) e, quando fizer sentido, por grupo intermediário — sempre deixando claro que
  esses números vêm do resultado oficial do DEXi, nunca recalculados pela IA.
- Uma área para **simular cenários**: o usuário escolhe um atributo e uma alternativa hipotética
  diferente, a IA reaplica as regras disponíveis (`regras_agregacao_dexi.json`) e mostra o
  resultado simulado — sempre rotulado como simulação, nunca confundido com o resultado oficial
  (mesma regra da seção 9 da especificação original).
- Isso é adicional ao relatório em texto corrido já especificado — não o substitui.

## 5. Identidade visual do produto

Aplicar a especificação de identidade visual (paleta de 6 cores oficiais, com função definida
para cada uma — estrutura, tecnologia, inteligência, evolução, identidade, fundo — já escrita e
pronta para uso) em toda a aplicação: tela de coleta, painel de resultados, botões, gráficos e
conversação. Regras principais: Azul Profundo (`#123F63`) e Off-white (`#F5F3ED`) como base
estrutural; Azul Digital (`#3E9BC1`), Verde Inteligência (`#43B7AA`), Amarelo Evolução
(`#F7C84B`) e Vermelho Identidade (`#D96F72`) como cores de expressão, cada uma com função
semântica específica — não usar como decoração aleatória, e não usar vermelho como sinônimo
automático de erro nem amarelo como cor dominante.
