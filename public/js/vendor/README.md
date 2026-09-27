# vendor

Bibliotecas de terceiros servidas localmente (sem build step, mesmo espírito do
resto do projeto) -- evita depender de um CDN externo estar acessível no
ambiente onde a aplicação for hospedada.

- `d3.min.js` -- D3.js 7.9.0 (BSD-3-Clause/ISC), copiado de
  `node_modules/d3/dist/d3.min.js` (pacote oficial `d3` no npm). Usado pelo
  Cockpit de Evolução Digital (adendo rodada 6) para o heatmap dos 34
  atributos e o sunburst da estrutura do diagnóstico (`public/js/cockpit.js`).
  Para atualizar: `npm install d3 --no-save && cp node_modules/d3/dist/d3.min.js public/js/vendor/d3.min.js`.
