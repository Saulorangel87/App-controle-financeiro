const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/resumo
// Retorna os totais usados na tela de Visão Geral: total gasto, orçamento
// total, disponível e quantidade de categorias em alerta.
// Assim como em /categorias, o gasto considera só o mês corrente — o
// dashboard reflete o mês em andamento, não a soma histórica de tudo.
router.get('/', (req, res) => {
  const categorias = db.prepare(`
    SELECT
      c.id,
      c.nome,
      c.limite,
      COALESCE(SUM(d.valor), 0) AS gasto
    FROM categorias c
    LEFT JOIN despesas d
      ON d.categoria_id = c.id
      AND strftime('%Y-%m', d.data) = strftime('%Y-%m', 'now')
    WHERE c.usuario_id = ?
    GROUP BY c.id
  `).all(req.usuarioId);

  const totalGasto = categorias.reduce((soma, c) => soma + c.gasto, 0);

  // Orçamento total é definido manualmente pelo usuário, por mês (tabela
  // orcamento_mensal) — não é mais calculado como soma dos limites das
  // categorias, e não carrega o valor do mês anterior pro mês novo.
  const mesAtual = db.prepare(`SELECT strftime('%Y-%m', 'now') AS mes`).get().mes;
  db.prepare(`
    INSERT OR IGNORE INTO orcamento_mensal (usuario_id, mes, valor) VALUES (?, ?, 0)
  `).run(req.usuarioId, mesAtual);
  const { valor: orcamentoTotal } = db.prepare(
    'SELECT valor FROM orcamento_mensal WHERE usuario_id = ? AND mes = ?'
  ).get(req.usuarioId, mesAtual);

  const disponivel = orcamentoTotal - totalGasto;
  const categoriasComAlerta = categorias.filter((c) => c.gasto > c.limite).length;
  const percentualUtilizado = orcamentoTotal > 0 ? (totalGasto / orcamentoTotal) * 100 : 0;

  res.json({
    mes: mesAtual,
    totalGasto,
    orcamentoTotal,
    disponivel,
    categoriasComAlerta,
    percentualUtilizado: Number(percentualUtilizado.toFixed(1)),
    gastoPorCategoria: categorias.map((c) => ({
      nome: c.nome,
      gasto: c.gasto,
      limite: c.limite,
    })),
  });
});

module.exports = router;
