# Adendo à Especificação — Rodada 4: Acentuação, Cores e Textos de Abertura

> Complementa os documentos anteriores. Trata três pontos independentes.

---

## 1. Mapeamento de exibição — versão final revisada

O `mapeamento_exibicao_rascunho.json` usado até agora era, como o próprio nome dizia, um
rascunho incompleto (várias linhas só tiveram o ponto trocado por espaço, sem acento). Substitua
**definitivamente** por `mapeamento_exibicao.json` (anexo a este adendo) — as 136 linhas (34
atributos × 4 alternativas) foram revisadas uma a uma. Esta é a versão final para uso em
produção, não precisa de nova revisão humana antes de aplicar.

Regra de uso (sem mudança em relação ao que já estava definido): a coluna `exibicao` é usada
apenas na tela; o valor em `tecnico` é o único que vai para CSV e `.dxi`. Pode aposentar o
`mapeamento_exibicao_rascunho.json` antigo — não usar mais.

## 2. Paleta de cores oficial do produto

Aplicar em toda a aplicação (tela de coleta, painel de resultados, gráficos, botões, PDF
exportado) — não só nas telas novas, revisar também o que já existe.

**Cores estruturais (base da interface):**

| Cor | Hex | RGB | Função |
|---|---|---|---|
| Off-white | `#F5F3ED` | (245, 243, 237) | Fundo principal — clareza, leveza, áreas de respiro |
| Azul Profundo | `#123F63` | (18, 63, 99) | Estrutura — títulos, textos principais, elementos de maior hierarquia |

**Cores de expressão (destaque, sempre com função semântica, nunca decorativas):**

| Cor | Hex | RGB | Função |
|---|---|---|---|
| Azul Digital | `#3E9BC1` | (62, 155, 193) | Tecnologia, conexão, interação — elementos clicáveis, links, progresso |
| Verde Inteligência | `#43B7AA` | (67, 183, 170) | Inteligência Artificial, integração, interpretação, insights |
| Amarelo Evolução | `#F7C84B` | (247, 200, 75) | Evolução, descoberta, oportunidades, próximos passos — usar com moderação, nunca como cor dominante |
| Vermelho Identidade | `#D96F72` | (217, 111, 114) | Identidade visual, destaque, associação institucional com a UFSJ — não usar como cor padrão de erro |

**Regra de aplicação**: Off-white e Azul Profundo formam a base de toda tela (fundo + estrutura/
texto). As quatro cores de expressão aparecem como destaque pontual, cada uma na sua função —
por exemplo, no painel da Etapa 3: o status geral e elementos estruturais em Azul Profundo; os
elementos interativos (botões, campo de conversa) em Azul Digital; o centro de aprendizado e
qualquer insight gerado pela IA em Verde; indicadores de oportunidade/evolução em Amarelo; a
identidade visual do produto (logo, cabeçalho) pode usar o Vermelho como toque de marca. Não usar
vermelho para estados de erro — usar uma cor de estado neutra para isso, preservando o vermelho
como elemento de identidade.

## 3. Tela de abertura — texto definitivo

Substituir o texto de abertura atual por este, exatamente como está escrito (é o texto oficial
que o pesquisador escreveu, não deve ser reescrito pela IA):

> **Onde sua organização está na jornada digital?**
>
> Responda 34 perguntas e descubra seu estágio de maturidade digital.
>
> A avaliação considera tecnologia, processos, pessoas, gestão e inovação e, ao final, apresenta
> um diagnóstico estruturado para ajudar a entender os principais pontos de atenção e evolução.
>
> *34 perguntas · 15–25 min · diagnóstico estruturado*
>
> Pesquisa aplicada desenvolvida no âmbito do PROFNIT — UFSJ, por Welerson Carvalho Coelho, sob
> orientação do Prof. Dr. Darlinton Barbosa Feres Carvalho, com base em Kljajić Borštnar e
> Pucihar (2021) e processamento pelo DEXi.
>
> **[ Começar agora → ]**

Nota técnica para o Claude Code: os nomes próprios "Kljajić Borštnar" usam caracteres croatas
(ć, š) que já causaram um problema de fonte na geração do PDF antes (renderizavam errado com a
fonte padrão) — usar a mesma fonte/configuração que já foi corrigida para esse caso, ou, se for
mais seguro, aplicar a mesma normalização ASCII que já é usada em outras partes do projeto.

## 4. Campo do nome da organização

Mantém como já está (sem alteração).

## 5. Texto de contextualização da organização — definitivo

Logo após o nome da organização, antes do primeiro atributo, substituir o texto atual por este:

> **Conte um pouco sobre sua organização**
>
> Antes de começarmos, queremos entender brevemente o contexto da organização que será avaliada.
> Conte, com suas próprias palavras, o que a organização faz, em qual setor ou mercado atua,
> quais são suas principais atividades, seu porte ou número aproximado de colaboradores.
>
> Não precisa ser formal nem detalhado. Escreva como você explicaria sua empresa para alguém que
> acabou de conhecê-la.
>
> Essas informações serão utilizadas apenas para contextualizar a conversa e tornar as perguntas
> mais adequadas à realidade da organização. Não é necessário fornecer informações confidenciais,
> dados financeiros detalhados ou uma descrição formal da empresa.
>
> *Exemplo:*
> *A MetalNova é uma indústria de médio porte localizada em São João del Rei-MG, que atua no
> setor metalúrgico. A empresa fabrica componentes metálicos para outras indústrias e possui
> aproximadamente 150 colaboradores. Atualmente, possui uma estrutura de produção tradicional e
> vem buscando ampliar o uso de tecnologias digitais em seus processos.*

O texto de exemplo (MetalNova) deve aparecer visualmente diferenciado do restante (ex.: itálico,
cor mais suave, ou dentro de uma caixa de exemplo) para deixar claro que é um exemplo ilustrativo,
não um campo a ser preenchido literalmente.
