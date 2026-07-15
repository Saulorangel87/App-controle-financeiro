const express = require('express');
const db = require('../db');

const router = express.Router();

function mesAnterior(mes) {
  const [ano, m] = mes.split('-').map(Number);
  const data = new Date(ano, m - 2, 1); // m-1 é o mês atual (0-indexed), -1 pra pegar o anterior
  const anoAnterior = data.getFullYear();
  const mesAnteriorNum = String(data.getMonth() + 1).padStart(2, '0');
  return `${anoAnterior}-${mesAnteriorNum}`;
}

function totalDoMes(usuarioId, mes) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(valor), 0) AS total
    FROM despesas
    WHERE usuario_id = ? AND strftime('%Y-%m', data) = ?
  `).get(usuarioId, mes);
  return row.total;
}

// GET /api/relatorio/meses
// Lista os meses (YYYY-MM) que têm ao menos uma despesa, mais recentes primeiro.
// Sempre inclui o mês atual, mesmo que ainda esteja vazio.
router.get('/meses', (req, res) => {
  const mesAtual = new Date().toISOString().slice(0, 7);

  const meses = db.prepare(`
    SELECT DISTINCT strftime('%Y-%m', data) AS mes
    FROM despesas
    WHERE usuario_id = ?
    ORDER BY mes DESC
  `).all(req.usuarioId).map((r) => r.mes);

  if (!meses.includes(mesAtual)) {
    meses.unshift(mesAtual);
  }

  res.json(meses);
});

// GET /api/relatorio?mes=YYYY-MM
router.get('/', (req, res) => {
  const mes = req.query.mes || new Date().toISOString().slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ erro: 'parâmetro mes inválido, use o formato YYYY-MM' });
  }

  const totalAtual = totalDoMes(req.usuarioId, mes);
  const totalAnterior = totalDoMes(req.usuarioId, mesAnterior(mes));

  const variacaoAbsoluta = totalAtual - totalAnterior;
  const variacaoPercentual =
    totalAnterior > 0 ? Number(((variacaoAbsoluta / totalAnterior) * 100).toFixed(1)) : null;

  const despesas = db.prepare(`
    SELECT
      d.id, d.descricao, d.valor, d.data,
      c.nome AS categoria_nome, c.icone AS categoria_icone, c.cor AS categoria_cor
    FROM despesas d
    JOIN categorias c ON c.id = d.categoria_id
    WHERE d.usuario_id = ? AND strftime('%Y-%m', d.data) = ?
    ORDER BY d.data DESC, d.id DESC
  `).all(req.usuarioId, mes);

  res.json({
    mes,
    totalAtual,
    totalAnterior,
    variacaoAbsoluta,
    variacaoPercentual,
    despesas,
  });
});

module.exports = router;
