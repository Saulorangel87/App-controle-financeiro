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

  // Orçamento total é definido manualmente pelo usuário (tabela orcamento),
  // não é mais calculado como soma dos limites das categorias.
  db.prepare(`INSERT OR IGNORE INTO orcamento (usuario_id, valor) VALUES (?, 0)`).run(req.usuarioId);
  const { valor: orcamentoTotal } = db.prepare(
    'SELECT valor FROM orcamento WHERE usuario_id = ?'
  ).get(req.usuarioId);

  const disponivel = orcamentoTotal - totalGasto;
  const categoriasComAlerta = categorias.filter((c) => c.gasto > c.limite).length;
  const percentualUtilizado = orcamentoTotal > 0 ? (totalGasto / orcamentoTotal) * 100 : 0;

  const mesAtual = db.prepare(`SELECT strftime('%Y-%m', 'now') AS mes`).get().mes;

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
