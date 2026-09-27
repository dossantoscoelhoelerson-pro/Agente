# Identidade visual ORBE

Arquivos originais, fornecidos pelo pesquisador, usados exatamente como estão — nenhum
desenho foi gerado ou alterado por IA, só recorte/redimensionamento quando indicado.

## Versão atual (adendo rodada 10, seção 3)

O pesquisador enviou um novo arquivo com fundo **transparente** (PNG real, canal alfa
confirmado) e a assinatura trocada de "Visão integrada" para "Maturidade Digital". Esse
arquivo substituiu o conteúdo de dois caminhos que já existiam no código -- os nomes dos
arquivos ficaram os mesmos (para não precisar tocar em nenhuma referência no código), só o
conteúdo mudou:

- `orbe_logo_fundo_branco.png` — apesar do nome (herdado da versão anterior, com fundo
  branco de verdade), hoje é o lockup completo (ícone + "ORBE" + "Maturidade Digital" +
  linha "Agente de IA... PROFNIT UFSJ") em **PNG transparente** -- recorte direto do
  arquivo original enviado, sem redesenho.
- `orbe_lockup_branco.png` — mesmo lockup, recortado sem a linha "Agente de IA...
  PROFNIT UFSJ" (usado no cabeçalho fixo e na sidebar da Home, onde essa linha não cabe),
  também transparente. Derivado só por recorte do arquivo acima.
- `../favicon/*` — recorte só do símbolo (sem nenhum texto), redimensionado para os
  tamanhos padrão de favicon/ícone de app (16, 32, 48, 180, 192, 512px + .ico).
- `orbe_simbolo.png` — o mesmo recorte do símbolo (mesma origem do favicon, ~552x564,
  quase quadrado), em resolução maior, transparente. Novo na rodada 11: usado nos
  emblemas pequenos (círculo do hero, "Por que a ORBE") em vez do lockup completo --
  o lockup é uma imagem bem larga (proporção ~3:1) com texto; encolhido para um emblema
  pequeno, o texto virava uma mancha ilegível que lia como "uma caixa borrada" (era essa
  a origem do problema relatado no adendo rodada 11, seção 2 -- não era falta de
  transparência de verdade, o arquivo já era transparente desde a rodada 10; era o
  recorte errado sendo usado num espaço pequeno demais pra ele).

`orbe_logo_fundo_azul.png` / `orbe_lockup_azul.png` ficam como estavam (versão antiga, com
"Visão integrada", fundo `#DFECF2` sólido) -- **não são mais referenciados em nenhum lugar
do código**: com o arquivo novo sendo transparente, ele funciona sobre qualquer fundo, então
não existe mais necessidade de uma variante "fundo azul" separada. Mantidos só como
histórico.

`orbe_identidade_visual_e_mockup.png` — peça de referência (significado das cores + mockup
de produto), usada como guia de estrutura para o painel da Etapa 3, nunca copiada pixel a
pixel.
