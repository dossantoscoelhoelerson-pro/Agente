# Adendo à Especificação — Rodada 14: Rodapé, Textos, Legendas e Exportação do Roadmap

---

## 1. Rodapé institucional — em todas as páginas da aplicação

Criar um rodapé horizontal, presente em **todas as telas** (Home, Conheça a ORBE, coleta,
Panorama, Insights, Roadmap):

**Fundo**: Azul Profundo sólido, ocupando toda a largura. Composição limpa, bastante espaço de
respiro, sem excesso de elementos.

**Lado esquerdo — identidade**: logo oficial da ORBE (símbolo aprovado, sem alteração de forma
ou cor), com "Maturidade Digital" abaixo do nome ORBE — funcionando como assinatura principal.

**Centro — identificação do produto**: "AGENTE DE IA" em destaque, acima do texto institucional;
abaixo: "Um produto tecnológico desenvolvido por PROFNIT UFSJ para impulsionar a maturidade
digital das organizações." — com "PROFNIT UFSJ" em destaque numa cor derivada da paleta oficial.

**Separador**: linhas verticais finas em azul-claro/ciano entre as áreas, com transição sutil
inspirada na paleta multicolorida da marca — discreta, sem gradiente exagerado.

**Lado direito — contato**: título "Contato", e-mail `carvalhowelerson@gmail.com`. Sem redes
sociais (nenhum LinkedIn, Instagram, YouTube, Spotify).

**Linha inferior**: separador horizontal fino; à esquerda "© 2026 ORBE. Todos os direitos
reservados."; à direita "PROFNIT UFSJ · PRODUTO TECNOLÓGICO".

**Direção visual**: logo grande e destacado, tipografia moderna e limpa, alto contraste, espaço
negativo generoso, linhas finas discretas, detalhes pontuais em Azul Digital, composição
horizontal equilibrada. Deve parecer produto tecnológico com credibilidade acadêmico-
institucional — nunca um site universitário tradicional. O símbolo da ORBE não é redesenhado,
reinterpretado, simplificado nem recolorido em nenhuma aplicação.

## 2. Remover ponto final de duas frases do Hero

- "Sua parceira na jornada da transformação digital" (sem ponto)
- "Aqui você encontra uma experiência completa para entender onde sua organização está, o que
  isso significa e como evoluir com base em dados, insights e ação" (sem ponto)

## 3. "Conheça a ORBE" — nova versão do texto do Bloco 1 (substitui a da Rodada 13)

Esta versão substitui a da rodada anterior — usar exatamente este texto, em três parágrafos.
Negrito escolhido para dar hierarquia de leitura (indicado abaixo, sem exagerar):

> A transformação digital não acontece apenas pela adoção de novas tecnologias, ela se constrói
> na forma como a organização trabalha, toma decisões, desenvolve o time, utiliza dados e conduz
> suas mudanças. A ORBE foi criada para conectar essas dimensões e transformar essa complexidade
> em uma **visão integrada da maturidade digital**.
>
> O nome ORBE remete à ideia de **totalidade, conjunto e visão ampla**. Assim como um orbe
> representa um todo formado por diferentes elementos que se relacionam, a ORBE busca olhar para
> a maturidade digital de forma **integrada**, conectando diferentes dimensões da organização
> para construir uma compreensão mais completa de sua realidade.
>
> A proposta é simples: tornar mais fácil **entender o estágio atual** da organização,
> **compreender o que existe por trás desse resultado** e **enxergar possibilidades de
> evolução**.

**Slogan de fechamento** (substitui o formato da Rodada 13 — mesmo box em Azul Profundo, só o
texto muda): **"ORBE | Visão para compreender, inteligência para evoluir"** (sem ponto final,
separador `|`, "inteligência" em minúscula).

## 4. "Por que a ORBE?" — remover ponto final da última frase do bloco

Mesma lógica dos itens acima — a última frase desse bloco perde o ponto final.

## 5. Legendas nas árvores do Panorama

**Árvore de atributos**: adicionar subtítulo "Como os 34 atributos se distribuem, do nível mais
baixo (vermelho) ao mais alto (verde)?" e uma legenda visual com bolinhas nas cores do gradiente
(vermelho → laranja/amarelo → amarelo-esverdeado → verde) indicando o que cada cor significa
(nível 1 a 4 da escala qualitativa).

**Árvore de oportunidades**: adicionar subtítulo "Onde vale focar primeiro? Os pontos em destaque
são os de nível mais baixo no resultado real." e a mesma legenda de cores.

## 6. Correção de contraste no chat de Insights (bug real)

Na seção "Vamos entender esse resultado?" (o chat), a pergunta do próprio usuário aparece numa
caixa em Azul escuro, mas o texto da pergunta está com uma cor que se mistura com o fundo da
caixa — fica praticamente ilegível, parece bug. Corrigir a cor da fonte da caixa do usuário para
branco (ou outra cor clara com contraste adequado sobre o Azul escuro), mantendo a resposta da IA
como já está.

Confirmar também que o título dessa seção é exatamente **"Vamos entender esse resultado?"** (com
interrogação) de forma consistente em toda a aplicação.

## 7. Exportação em PDF do Roadmap (nova funcionalidade)

Adicionar ao Roadmap uma exportação em PDF, no mesmo padrão já existente para o painel de
Insights/Panorama — reunindo as ações (manuais e sugeridas pela IA, sempre identificando quais são
"Sugestão da IA"), status, e o conteúdo das conversas contextuais por ação, num relatório
para download. Reaproveitar a mesma infraestrutura de geração de PDF já implementada, não criar
um mecanismo novo do zero.

## 8. O que não muda

Nenhuma regra de fidelidade metodológica ou lógica de dado é alterada nesta rodada, exceto a
adição da exportação em PDF do Roadmap (item 7), que é puramente uma funcionalidade de saída —
não altera nenhum cálculo, dado ou regra existente.
