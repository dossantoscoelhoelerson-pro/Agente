# Adendo à Especificação — Rodada 9: Home ORBE, Paleta Atualizada e Fluxo de 3 Caminhos

> Substitui a versão anterior deste adendo (nunca publicada no GitHub). Encaminha a especificação
> funcional completa da Home fornecida pelo pesquisador (`ORBE — Especificação Funcional da Home`,
> conteúdo reproduzido nas seções 2-3 abaixo) e soma a atualização de paleta/tipografia e a lógica
> de fluxo de entrada da aplicação.

---

## 1. Atualização de paleta e tipografia — aplicar em toda a aplicação, não só na Home

**Decisão confirmada pelo pesquisador**: a paleta abaixo substitui a paleta da Rodada 4 em
**toda** a aplicação (Home, Etapa 1/coleta, Panorama, Insights, Roadmap, PDF exportado) — não é
uma paleta exclusiva da Home.

| Cor | Hex novo | Hex antigo (aposentar) | Função (sem mudança) |
|---|---|---|---|
| Azul Profundo | `#003F69` | ~~#123F63~~ | Estrutura, títulos, navegação, confiança |
| Azul Digital | `#1E8FC8` | ~~#3E9BC1~~ | Tecnologia, interação, dados |
| Verde Inteligência | `#2BBFB3` | ~~#43B7AA~~ | IA, inteligência, insights, integração |
| Amarelo Evolução | `#FDC350` | ~~#F7C84B~~ | Aprendizagem, oportunidades, evolução |
| Vermelho Identidade | `#DF5266` | ~~#D96F72~~ | Identidade, destaque, diferenciação |
| Off-white | `#F5F3ED` | (sem mudança) | Fundo, respiro, leveza |

**Tipografia**: trocar para **Manrope** em toda a aplicação (títulos Bold/ExtraBold, subtítulos
SemiBold, corpo Regular, indicadores Medium/SemiBold, navegação Medium) — substitui a combinação
Fraunces + Inter usada até aqui.

**Atenção a lugares onde a cor está com valor fixo, não em variável CSS** (identificados em
rodadas anteriores): os gráficos SVG/D3 (`public/js/charts.js` e os componentes de árvore da
Rodada 7) e o PDF exportado (`server/exportPdf.js`, que inclusive já usa variantes mais escuras de
algumas cores por contraste de acessibilidade) têm os valores de cor escritos diretamente no
código, não lidos de variável — esses pontos precisam ser atualizados manualmente para os novos
hex, não só o CSS. Reavaliar também se as variantes de contraste (texto sobre branco) já
calculadas para a paleta antiga continuam com contraste adequado nos novos tons, ou se precisam
ser recalculadas.

**Logo**: sem alteração — o símbolo oficial da ORBE continua exatamente como fornecido
(arquivo já no repositório), nunca redesenhado ou recolorido.

## 2. Home — estrutura e conteúdo

Implementar integralmente a especificação funcional completa fornecida pelo pesquisador (anexa a
este adendo). Resumo dos elementos principais, para referência rápida — o documento anexo é a
fonte de verdade para os detalhes de texto, hierarquia e comportamento:

- **Navegação**: sidebar fixa à esquerda (Início / Diagnóstico / Insights / Roadmap), com item
  ativo destacado; topo direito com notificações/avatar/nome (usar placeholder coerente, já que
  não há sistema de conta de usuário nesta fase do projeto — ver nota abaixo).
- **Hero**: selo, título "Bem-vindo à ORBE", headline, texto de abertura, imagem de pessoa
  observando paisagem ampla (jornada/perspectiva), com elemento gráfico de linhas orbitais/pontos
  de conexão sobreposto, sem substituir o logo oficial.
- **Seção de entrada** com os três cards (ver seção 3 deste adendo para a lógica de cada um).
  Card 2 ("Diagnóstico de Maturidade Digital") deve ter destaque visual maior — é o caminho
  principal para quem ainda não tem diagnóstico.
- **Barra de capacidades**: Metodologia DEXi / Inteligência Artificial / Consultoria
  especializada, discreta, sem parecer seção promocional.
- **Linguagem gráfica**: linhas orbitais, pontos, formas orgânicas, círculos, áreas translúcidas,
  gradientes muito suaves — nos cantos de cards e fundos, sem dominar a interface.
- Seguir as diretrizes de responsividade, hierarquia visual, tipografia, botões e cards descritas
  no documento anexo, item por item.

**Nota sobre avatar/nome/cargo no topo direito**: a aplicação não tem sistema de login/conta de
usuário nesta fase (isso ficou como decisão em aberto desde a Rodada 6, junto com a persistência
do Roadmap). Implementar esse elemento como estático/placeholder por enquanto, sem funcionalidade
real por trás — não criar um sistema de autenticação como efeito colateral desta rodada.

## 3. Os três caminhos — lógica de fluxo

**Card 1 — "Conhecer a ORBE"**: tela nova, explicando o que é a ORBE, o problema que resolve, o
papel da IA, e a base metodológica (Kljajić Borštnar & Pucihar, 2021 / DEX / DEXi) em linguagem
simples, com camada opcional mais detalhada para quem quiser aprofundar.

**Card 2 — "Diagnóstico de Maturidade Digital"**: leva ao fluxo já existente — Agente 1 (coleta
dos 34 atributos) → DEXi manual → upload do resultado → Panorama. Nenhuma mudança de lógica, só a
porta de entrada é nova.

**Card 3 — "Já tenho um diagnóstico"**: **pula toda a Etapa 1**. Leva direto para a tela de
upload/colagem de resultado do DEXi que já existe (reaproveitar o endpoint e a lógica de
extração/validação já implementados, não duplicar), seguindo direto para Panorama depois de
carregado.

**Limitação a comunicar, de forma discreta e não alarmante (mesma postura da Rodada 8), quando o
Card 3 for usado**: sem passar pela coleta, não existe `registro_completo` (respostas e
evidências da organização) para aquela avaliação — o Insights consegue explicar o resultado
oficial do DEXi normalmente, mas não consegue cruzar com "o que a organização respondeu" na
rastreabilidade. Avisar isso como uma nota breve, nunca como alerta de abertura da experiência.

## 4. Bloco 4 da coleta (Etapa 1) — texto mais humano

Substituir o rótulo técnico atual do campo de texto livre por algo como: *"Ficou em dúvida sobre
essa pergunta? Você pode explicar com suas próprias palavras. A ORBE ajuda a entender sua
resposta."* — só o texto ao redor do campo muda; a lógica de interpretação da resposta livre já
implementada continua a mesma.

## 5. Sobre a imagem de referência

O pesquisador vai enviar a imagem de referência visual diretamente na conversa com o Claude Code,
não por este adendo — usar como referência de composição quando/se for fornecida lá, sem
bloquear esta rodada por não tê-la aqui.

## 6. O que não muda

- Todas as regras de fidelidade metodológica, a separação resultado/interpretação/simulação, e a
  postura consultiva da Rodada 8 valem integralmente na Home e nos três caminhos.
- Nenhuma lógica de processamento, cálculo ou validação do DEXi muda nesta rodada — é uma rodada
  de identidade visual (paleta/tipografia, aplicada globalmente) e arquitetura de entrada
  (Home e os três caminhos), não de dado ou regra de negócio.
