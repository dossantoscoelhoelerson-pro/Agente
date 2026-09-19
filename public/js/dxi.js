// Porte fiel da técnica validada no protótipo: edita o template .dxi como
// texto puro, linha a linha, tocando SOMENTE no conteúdo das linhas
// <OPTION>. Nunca reserializar o XML inteiro com um parser genérico --
// isso já trocou aspas duplas por simples na declaração <?xml ...?> e a
// quebra de linha de \r\n para \n, e o DEXi rejeita o arquivo resultante
// com "Missing or unrecognized XML header".

let templateCache = null;

async function decodeTemplate(){
  if(templateCache) return templateCache;
  const res = await fetch('/assets/template.dxi');
  if(!res.ok) throw new Error('Não consegui carregar o template .dxi do servidor (' + res.status + ').');
  templateCache = await res.text();
  return templateCache;
}

// split mantendo as quebras de linha originais, sem depender de lookbehind.
function splitKeepEnds(text){
  const out = [];
  let start = 0;
  for(let i = 0; i < text.length; i++){
    if(text[i] === '\n'){ out.push(text.slice(start, i+1)); start = i+1; }
  }
  if(start < text.length) out.push(text.slice(start));
  return out;
}

function fillDxi(templateText, orgName, answers, attrs){
  const lines = splitKeepEnds(templateText);
  const nameRe = /<NAME>(.*?)<\/NAME>/;
  const optRe = /^(\s*)<OPTION>(.*?)<\/OPTION>\s*$/;
  const scaleOf = {};
  const basicIds = new Set();
  attrs.forEach(a => { scaleOf[a.id] = a.niveis; basicIds.add(a.id); });

  const out = [];
  let seenAttr = false;
  let currentName = null;
  let i = 0;
  while(i < lines.length){
    const line = lines[i];
    if(line.indexOf('<ATTRIBUTE>') !== -1) seenAttr = true;

    const mName = nameRe.exec(line);
    if(mName){
      const lookahead = lines[i+1] || '';
      if(lookahead.indexOf('<DESCRIPTION>') !== -1) currentName = mName[1].trim();
    }

    const bodyNoEol = line.replace(/\r?\n$/, '');
    const mOpt = optRe.exec(bodyNoEol);
    if(mOpt){
      const indent = mOpt[1];
      const eol = line.slice(bodyNoEol.length);
      let j = i;
      while(j < lines.length && optRe.exec(lines[j].replace(/\r?\n$/, ''))){ j++; }

      if(!seenAttr){
        out.push(indent + '<OPTION>' + orgName + '</OPTION>' + eol);
      } else if(basicIds.has(currentName)){
        const chosen = answers[currentName];
        const levels = scaleOf[currentName];
        if(!chosen) throw new Error('Falta resposta para o atributo "' + currentName + '"');
        const idx = levels.indexOf(chosen);
        if(idx === -1) throw new Error('Alternativa "' + chosen + '" inválida para "' + currentName + '"');
        out.push(indent + '<OPTION>' + idx + '</OPTION>' + eol);
      } else {
        out.push(indent + '<OPTION>*</OPTION>' + eol);
      }
      i = j;
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join('');
}

function validateDxi(dxiText){
  const declOk = dxiText.slice(0, 60).indexOf('encoding="UTF-8"') !== -1;
  const starCount = (dxiText.match(/<OPTION>\*<\/OPTION>/g) || []).length;
  return { declOk, starCount, expectedStars: 17 };
}
