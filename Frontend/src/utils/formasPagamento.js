// Mesma lista do backend (FORMAS_PAGAMENTO_VALIDAS em utils/validacao.js).
export const FORMAS_PAGAMENTO = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'debito', rotulo: 'Débito' },
  { valor: 'credito', rotulo: 'Crédito' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'outro', rotulo: 'Outro' },
];

export function rotuloFormaPagamento(valor) {
  return FORMAS_PAGAMENTO.find((f) => f.valor === valor)?.rotulo || valor;
}
