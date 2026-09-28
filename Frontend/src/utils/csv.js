// Parser de CSV simples (aspas são respeitadas, mas não aspas escapadas tipo
// "" dentro de um campo) — suficiente pra extratos bancários exportados em
// CSV, que é o formato mais comum. Detecta ; ou , como separador olhando
// só a primeira linha.
export function analisarCSV(texto) {
  const linhas = texto.split(/\r\n|\n|\r/).filter((linha) => linha.trim() !== '');
  if (linhas.length === 0) return [];

  const delimitador = linhas[0].includes(';') ? ';' : ',';
  return linhas.map((linha) => dividirLinha(linha, delimitador));
}

function dividirLinha(linha, delimitador) {
  const campos = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i += 1) {
    const caractere = linha[i];
    if (caractere === '"') {
      dentroDeAspas = !dentroDeAspas;
    } else if (caractere === delimitador && !dentroDeAspas) {
      campos.push(atual.trim());
      atual = '';
    } else {
      atual += caractere;
    }
  }
  campos.push(atual.trim());
  return campos;
}

function normalizarCabecalho(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const CANDIDATOS_DATA = ['data', 'date', 'dt'];
const CANDIDATOS_DESCRICAO = ['descricao', 'historico', 'description', 'memo', 'lancamento', 'detalhes'];
const CANDIDATOS_VALOR = ['valor', 'value', 'amount', 'montante'];

// Tenta achar data/descrição/valor pelo nome das colunas do cabeçalho. Se não
// achar as três, assume a ordem mais comum (data, descrição, valor) e avisa
// quem chamou pra mostrar um aviso na tela.
export function detectarColunas(linhaCabecalho) {
  const normalizado = linhaCabecalho.map(normalizarCabecalho);

  const indiceData = normalizado.findIndex((c) => CANDIDATOS_DATA.some((cand) => c.includes(cand)));
  const indiceDescricao = normalizado.findIndex((c) => CANDIDATOS_DESCRICAO.some((cand) => c.includes(cand)));
  const indiceValor = normalizado.findIndex((c) => CANDIDATOS_VALOR.some((cand) => c.includes(cand)));

  if (indiceData !== -1 && indiceDescricao !== -1 && indiceValor !== -1) {
    return { indiceData, indiceDescricao, indiceValor, detectado: true };
  }

  return { indiceData: 0, indiceDescricao: 1, indiceValor: 2, detectado: false };
}

// Converte "1.234,56" / "1234,56" / "1234.56" / "R$ 12,50" pra número.
export function analisarValor(bruto) {
  let texto = String(bruto ?? '').replace(/[^\d,.-]/g, '').trim();
  if (!texto) return null;

  if (texto.includes(',') && texto.includes('.')) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (texto.includes(',')) {
    texto = texto.replace(',', '.');
  }

  const numero = parseFloat(texto);
  return Number.isFinite(numero) ? numero : null;
}

// Converte "DD/MM/YYYY", "DD/MM/YY" ou "YYYY-MM-DD" pra "YYYY-MM-DD".
export function analisarData(bruto) {
  const texto = String(bruto ?? '').trim();

  let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const [, dia, mes, anoBruto] = m;
    const ano = anoBruto.length === 2 ? `20${anoBruto}` : anoBruto;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  return null;
}
