const express = require('express');
const db = require('../db');
const { comValorEmReais, somaEmReaisSQL } = require('../utils/dinheiro');
const { hojeISO, mesAtualISO, intervaloDosMeses } = require('../utils/datas');
const { obterOrcamentoDoMes } = require('./orcamento');

const router = express.Router();

function calcularProjecaoMes(totalGasto, dataHoje = hojeISO()) {
  const [ano, mes, diaAtual] = dataHoje.split('-').map(Number);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const projecaoMes = totalGasto > 0 && diaAtual > 0
    ? Number(((totalGasto / diaAtual) * diasNoMes).toFixed(2))
    : 0;
  return { projecaoMes, diaAtual, diasNoMes };
}

// GET /api/resumo
// Retorna os totais usados na tela de Visão Geral: total gasto, orçamento
// total, disponível e quantidade de categorias em alerta.
// Assim como em /categorias, o gasto considera só o mês corrente — o
// dashboard reflete o mês em andamento, não a soma histórica de tudo.
router.get('/', (req, res) => {
  const mesAtual = mesAtualISO();
  const categorias = db.prepare(`
    SELECT
      c.id,
      c.nome,
      c.limite,
      c.limite_centavos,
      ${somaEmReaisSQL('d')} AS gasto
    FROM categorias c
    LEFT JOIN despesas d
      ON d.categoria_id = c.id
      AND d.data >= ? AND d.data < ?
    WHERE c.usuario_id = ?
    GROUP BY c.id
  `).all(...intervaloDosMeses(mesAtual), req.usuarioId);

  const categoriasComValores = categorias.map((linha) => comValorEmReais(linha, 'limite'));
  const totalGasto = categoriasComValores.reduce((soma, c) => soma + c.gasto, 0);

  // Orçamento total é definido manualmente pelo usuário, por mês (tabela
  // orcamento_mensal). Quando orcamento_recorrente está ativo no usuário,
  // um mês novo herda automaticamente o valor do último mês positivo.
  const orcamento = obterOrcamentoDoMes(req.usuarioId, mesAtual);
  const orcamentoTotal = orcamento.valor;

  const disponivel = orcamentoTotal - totalGasto;
  const categoriasComAlerta = categoriasComValores.filter((c) => c.gasto > c.limite).length;
  const percentualUtilizado = orcamentoTotal > 0 ? (totalGasto / orcamentoTotal) * 100 : 0;
  const { projecaoMes, diaAtual, diasNoMes } = calcularProjecaoMes(totalGasto);

  res.json({
    mes: mesAtual,
    totalGasto,
    orcamentoTotal,
    orcamentoRecorrente: orcamento.recorrente,
    orcamentoMesAnterior: orcamento.valorMesAnterior,
    disponivel,
    categoriasComAlerta,
    percentualUtilizado: Number(percentualUtilizado.toFixed(1)),
    projecaoMes,
    diaAtual,
    diasNoMes,
    gastoPorCategoria: categoriasComValores.map((c) => ({
      nome: c.nome,
      gasto: c.gasto,
      limite: c.limite,
    })),
  });
});

module.exports = router;
module.exports.calcularProjecaoMes = calcularProjecaoMes;
