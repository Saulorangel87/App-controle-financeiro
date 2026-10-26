function numeroMonetarioValido(valor, permitirZero = false) {
  return typeof valor === 'number'
    && Number.isFinite(valor)
    && (permitirZero ? valor >= 0 : valor > 0);
}

function dataISOValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const dataConvertida = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(dataConvertida.getTime())
    && dataConvertida.toISOString().slice(0, 10) === data;
}

function mesISOValido(mes) {
  return typeof mes === 'string' && /^\d{4}-\d{2}$/.test(mes);
}

// Texto obrigatório: precisa ser string de verdade (um número ou objeto no
// JSON faria .trim()/.toLowerCase() estourar), não pode ser só espaços e
// respeita o tamanho máximo do campo.
function textoValido(valor, tamanhoMaximo) {
  return typeof valor === 'string' && valor.trim().length > 0 && valor.length <= tamanhoMaximo;
}

// Texto opcional: ausente (undefined/null/'') ou um texto válido.
function textoOpcionalValido(valor, tamanhoMaximo) {
  return valor === undefined || valor === null || valor === '' || (typeof valor === 'string' && valor.length <= tamanhoMaximo);
}

const FORMAS_PAGAMENTO_VALIDAS = ['dinheiro', 'debito', 'credito', 'pix', 'boleto', 'outro'];

// forma_pagamento é opcional: undefined/null/'' significa "não informado".
function formaPagamentoValida(valor) {
  return valor === undefined || valor === null || valor === '' || FORMAS_PAGAMENTO_VALIDAS.includes(valor);
}

module.exports = {
  numeroMonetarioValido,
  dataISOValida,
  mesISOValido,
  textoValido,
  textoOpcionalValido,
  FORMAS_PAGAMENTO_VALIDAS,
  formaPagamentoValida,
};
