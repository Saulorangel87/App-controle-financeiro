const express = require('express');
const db = require('../db');
const { numeroMonetarioValido } = require('../utils/validacao');
const { mesDaRequisicao } = require('../utils/datas');
const { paraCentavos, comValorEmReais } = require('../utils/dinheiro');

const router = express.Router();

// O valor guardado em orcamento_mensal é o dinheiro que entrou NO mês: as
// entradas lançadas nele (routes/entradas.js soma cada uma) mais ajustes
// feitos pelo "editar". O orçamento total de um mês é esse valor somado ao
// saldo que sobrou (ou faltou) nos meses anteriores — o saldo não zera na
// virada, funciona como uma conta corrente.
//
// Saldo anterior de M = Σ (orçamento do mês − gasto do mês) de cada mês
// antes de M, a partir do primeiro mês em que o usuário teve orçamento.
// Meses anteriores a esse não contam: os gastos de antes de a pessoa usar o
// orçamento virariam um negativo que ninguém reconhece. A soma é calculada a
// cada leitura, então corrigir uma despesa de outubro já corrige novembro.
//
// O saldo acumulado chegou na v2.1.3 (novembro de 2026): a primeira sobra
// carregada é a de outubro de 2026. Meses antes disso eram tratados como
// independentes (o orçamento muitas vezes era um limite copiado, não dinheiro
// que entrou), então somar as sobras deles inflaria o saldo de quem já usava
// o app.
const MES_INICIO_SALDO_ACUMULADO = '2026-10';

function saldoAnteriorCentavos(usuarioId, mes) {
  const primeiroOrcamento = db.prepare(`
    SELECT MIN(mes) AS mes FROM orcamento_mensal
    WHERE usuario_id = ? AND COALESCE(valor_centavos, ROUND(valor * 100)) > 0
  `).get(usuarioId).mes;
  if (!primeiroOrcamento) return 0;
  const inicio = primeiroOrcamento > MES_INICIO_SALDO_ACUMULADO ? primeiroOrcamento : MES_INICIO_SALDO_ACUMULADO;
  if (inicio >= mes) return 0;

  const entradas = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(valor_centavos, ROUND(valor * 100))), 0) AS total
    FROM orcamento_mensal
    WHERE usuario_id = ? AND mes >= ? AND mes < ?
  `).get(usuarioId, inicio, mes).total;
  const gastos = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(valor_centavos, ROUND(valor * 100))), 0) AS total
    FROM despesas
    WHERE usuario_id = ? AND data >= ? AND data < ?
  `).get(usuarioId, `${inicio}-01`, `${mes}-01`).total;
  return entradas - gastos;
}

// Garante que existe uma linha de orçamento pro usuário no mês. O mês novo
// começa com 0 entrado — o total dele já vem com o saldo anterior, e o
// usuário só soma o que receber (+). A antiga opção "repetir todo mês"
// (usuarios.orcamento_recorrente) e o "copiar mês anterior" não existem mais.
function garantirOrcamentoDoMes(usuarioId, mes) {
  db.prepare(`
    INSERT OR IGNORE INTO orcamento_mensal (usuario_id, mes, valor, valor_centavos)
    VALUES (?, ?, 0, 0)
  `).run(usuarioId, mes);
}

// valor = orçamento total do mês (saldo anterior + o que entrou no mês).
function obterOrcamentoDoMes(usuarioId, mes) {
  garantirOrcamentoDoMes(usuarioId, mes);
  const orcamento = db.prepare(
    'SELECT valor, valor_centavos FROM orcamento_mensal WHERE usuario_id = ? AND mes = ?'
  ).get(usuarioId, mes);
  const doMesCentavos = paraCentavos(comValorEmReais(orcamento).valor);
  const saldoCentavos = saldoAnteriorCentavos(usuarioId, mes);

  return {
    valor: (doMesCentavos + saldoCentavos) / 100,
    mes,
    valorDoMes: doMesCentavos / 100,
    saldoAnterior: saldoCentavos / 100,
  };
}

const ERRO_MES = 'parâmetro mes inválido, use o formato YYYY-MM';

// GET /api/orcamento?mes=YYYY-MM — o mês pedido (padrão: o corrente)
router.get('/', (req, res) => {
  const mes = mesDaRequisicao(req);
  if (!mes) return res.status(400).json({ erro: ERRO_MES });
  res.json(obterOrcamentoDoMes(req.usuarioId, mes));
});

// PUT /api/orcamento?mes=YYYY-MM — define (substitui) o orçamento total do
// mês pedido (padrão: o corrente). O saldo anterior é calculado, então o que
// fica guardado é a diferença: total desejado − saldo anterior (pode ser
// negativo, ex: para corrigir um saldo que não bate com o banco).
router.put('/', (req, res) => {
  const { valor } = req.body;
  const mes = mesDaRequisicao(req);
  if (!mes) return res.status(400).json({ erro: ERRO_MES });

  if (!numeroMonetarioValido(valor, true)) {
    return res.status(400).json({ erro: 'valor inválido' });
  }

  db.transaction(() => {
    garantirOrcamentoDoMes(req.usuarioId, mes);
    const doMesCentavos = paraCentavos(valor) - saldoAnteriorCentavos(req.usuarioId, mes);
    db.prepare(`
      UPDATE orcamento_mensal SET valor = ?, valor_centavos = ?, atualizado_em = datetime('now')
      WHERE usuario_id = ? AND mes = ?
    `).run(doMesCentavos / 100, doMesCentavos, req.usuarioId, mes);
  })();

  res.json(obterOrcamentoDoMes(req.usuarioId, mes));
});

// PUT /api/orcamento/cartao — define ou limpa o dia de fechamento da fatura
// do cartão de crédito (1 a 31, ou null para usar o mês-calendário).
router.put('/cartao', (req, res) => {
  const { dia_fechamento } = req.body;

  if (
    dia_fechamento !== null &&
    (!Number.isInteger(dia_fechamento) || dia_fechamento < 1 || dia_fechamento > 31)
  ) {
    return res.status(400).json({ erro: 'dia_fechamento deve ser um número inteiro entre 1 e 31' });
  }

  db.prepare('UPDATE usuarios SET dia_fechamento_cartao = ? WHERE id = ?').run(
    dia_fechamento,
    req.usuarioId
  );

  res.json({ diaFechamento: dia_fechamento });
});

module.exports = router;
module.exports.garantirOrcamentoDoMes = garantirOrcamentoDoMes;
module.exports.obterOrcamentoDoMes = obterOrcamentoDoMes;
module.exports.MES_INICIO_SALDO_ACUMULADO = MES_INICIO_SALDO_ACUMULADO;
