// Exportação em PDF do painel da Etapa 3 (adendo rodada 3, seção 2).
// Gerado no servidor com pdfkit a partir dos MESMOS dados já mostrados na
// tela (nunca recalculados aqui) -- preserva a separação entre resultado
// oficial, panorama da organização e recomendações do centro de
// aprendizado.
const PDFDocument = require('pdfkit');

// Paleta oficial (adendo rodada 4, seção 2), adaptada ao PDF: os tons puros
// de Azul Digital/Verde Inteligência falham contraste AA como texto em
// fundo branco, então usamos variantes mais escuras da mesma família (mesma
// lógica do --blue-strong/--yellow-strong em public/css/styles.css).
const PDF_INK = '#123F63';       // Azul Profundo -- estrutural
const PDF_INK_SOFT = '#4D6F8A';
const PDF_GREEN_STRONG = '#2F8077'; // Verde Inteligência escurecido -- centro de aprendizado
const PDF_STATE_TEXT = '#3A3F44';   // cor de estado neutra -- nunca vermelho para aviso/erro

function h1(doc, text) {
  doc.moveDown(0.6).fontSize(18).fillColor(PDF_INK).font('Helvetica-Bold').text(text);
}
function h2(doc, text, color) {
  doc.moveDown(0.8).fontSize(13).fillColor(color || PDF_INK).font('Helvetica-Bold').text(text.toUpperCase());
}
function p(doc, text, opts) {
  doc.moveDown(0.2).fontSize(11).fillColor(PDF_INK).font('Helvetica').text(text, opts);
}
function small(doc, text) {
  doc.moveDown(0.1).fontSize(9).fillColor(PDF_INK_SOFT).font('Helvetica-Oblique').text(text);
}

function buildReportPdf(data) {
  const {
    orgName,
    orgContext,
    nivelFinalLabel,
    capDigitalLabel,
    capOrganizacionalLabel,
    grupos, // [{label, nivelLabel}]
    panorama, // {respondidos, total, maisBaixas: [id], maisAltas: [id]}
    temas, // [{tema, porque}]
    consistenciaOk,
    dexiText,
  } = data;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    h1(doc, 'Diagnóstico de Maturidade Digital');
    p(doc, orgName || '(organização não informada)', { continued: false });
    if (orgContext) small(doc, orgContext);
    // "Kljajic Borstnar" sem diacriticos: a fonte padrao do pdfkit (WinAnsi/
    // Latin-1) nao cobre os caracteres croatas c/s com caron -- mesma grafia
    // ja usada nos metadados internos do template.dxi por esse motivo.
    small(doc, 'Modelo de Kljajic Borstnar e Pucihar (2021), processado pelo DEXi.');

    h2(doc, 'Resultado oficial do DEXi');
    doc.moveDown(0.1).fontSize(22).fillColor(PDF_INK).font('Helvetica-Bold').text(nivelFinalLabel || 'Não identificado no texto carregado');
    if (!consistenciaOk) {
      doc.moveDown(0.3).fontSize(10).fillColor(PDF_STATE_TEXT).font('Helvetica-Bold')
        .text('Atenção: a validação de consistência encontrou divergências entre a coleta e o resultado -- ver detalhes na ferramenta.');
    }

    h2(doc, 'Dimensões');
    p(doc, `Capacidade Digital: ${capDigitalLabel || 'não identificado no texto carregado'}`);
    p(doc, `Capacidade Organizacional: ${capOrganizacionalLabel || 'não identificado no texto carregado'}`);

    h2(doc, 'Grupos');
    (grupos || []).forEach((g) => p(doc, `${g.label}: ${g.nivelLabel || 'não identificado no texto carregado'}`));

    h2(doc, 'Panorama da coleta');
    p(doc, `${panorama.respondidos} de ${panorama.total} atributos respondidos.`);
    if (panorama.maisBaixas && panorama.maisBaixas.length) {
      p(doc, `Respostas no nível mais baixo da própria escala: ${panorama.maisBaixas.join(', ')}.`);
    }
    if (panorama.maisAltas && panorama.maisAltas.length) {
      p(doc, `Respostas no nível mais alto da própria escala: ${panorama.maisAltas.join(', ')}.`);
    }
    small(doc, 'Panorama informativo, a partir das respostas da coleta -- não é uma explicação causal do resultado do DEXi.');

    h2(doc, 'Centro de aprendizado', PDF_GREEN_STRONG);
    if (temas && temas.length) {
      temas.forEach((t) => {
        doc.moveDown(0.3).fontSize(11).font('Helvetica-Bold').fillColor(PDF_INK).text(t.tema);
        p(doc, t.porque);
      });
    } else {
      p(doc, 'Nenhum tema gerado nesta sessão.');
    }
    small(doc, 'Temas de estudo sugeridos por IA, vinculados aos pontos de atenção do diagnóstico -- não são referências bibliográficas curadas ou verificadas pelo projeto.');

    h2(doc, 'Texto do resultado do DEXi (fornecido pelo usuário)');
    doc.moveDown(0.2).fontSize(9).fillColor(PDF_INK_SOFT).font('Courier').text((dexiText || '').slice(0, 6000), { lineGap: 1 });

    doc.end();
  });
}

module.exports = { buildReportPdf };
