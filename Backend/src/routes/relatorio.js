const express = require('express');
const db = require('../db');
const { comValorEmReais } = require('../utils/dinheiro');

const router = express.Router();

function mesAnterior(mes) {
  const [ano, m] = mes.split('-').map(Number);
  const data = new Date(ano, m - 2, 1); // m-1 é o mês atual (0-indexed), -1 pra pegar o anterior
  const anoAnterior = data.getFullYear();
  const mesAnteriorNum = String(data.getMonth() + 1).padStart(2, '0');
  return `${anoAnterior}-${mesAnteriorNum}`;
}

function totalDoMes(usuarioId, mes, categoriaId) {
  const filtroCategoria = categoriaId ? 'AND categoria_id = ?' : '';
  const parametros = categoriaId ? [usuarioId, mes, categoriaId] : [usuarioId, mes];
  const row = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(valor_centavos, ROUND(valor * 100)) / 100.0), 0) AS total
    FROM despesas
    WHERE usuario_id = ? AND strftime('%Y-%m', data) = ? ${filtroCategoria}
  `).get(...parametros);
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
  const categoriaId = req.query.categoria_id ? Number(req.query.categoria_id) : null;

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ erro: 'parâmetro mes inválido, use o formato YYYY-MM' });
  }
  if (categoriaId !== null && (!Number.isInteger(categoriaId) || categoriaId < 1)) {
    return res.status(400).json({ erro: 'parâmetro categoria_id inválido' });
  }
  if (categoriaId !== null) {
    const categoria = db.prepare(
      'SELECT id FROM categorias WHERE id = ? AND usuario_id = ?'
    ).get(categoriaId, req.usuarioId);
    if (!categoria) return res.status(400).json({ erro: 'categoria inválida' });
  }

  const totalAtual = totalDoMes(req.usuarioId, mes, categoriaId);
  const totalAnterior = totalDoMes(req.usuarioId, mesAnterior(mes), categoriaId);

  const variacaoAbsoluta = totalAtual - totalAnterior;
  const variacaoPercentual =
    totalAnterior > 0 ? Number(((variacaoAbsoluta / totalAnterior) * 100).toFixed(1)) : null;

  const filtroCategoria = categoriaId ? 'AND d.categoria_id = ?' : '';
  const parametrosDespesas = categoriaId ? [req.usuarioId, mes, categoriaId] : [req.usuarioId, mes];
  const despesas = db.prepare(`
    SELECT
      d.id, d.descricao, d.valor, d.valor_centavos, d.data,
      c.nome AS categoria_nome, c.icone AS categoria_icone, c.cor AS categoria_cor
    FROM despesas d
    JOIN categorias c ON c.id = d.categoria_id
    WHERE d.usuario_id = ? AND strftime('%Y-%m', d.data) = ? ${filtroCategoria}
    ORDER BY d.data DESC, d.id DESC
  `).all(...parametrosDespesas);

  // Entradas (adições ao orçamento) do mesmo mês — mostradas separadas das
  // despesas no relatório, não somadas junto com o total de gastos.
  const entradas = db.prepare(`
    SELECT id, origem, descricao, valor, valor_centavos, data
    FROM entradas
    WHERE usuario_id = ? AND strftime('%Y-%m', data) = ?
    ORDER BY data DESC, id DESC
  `).all(req.usuarioId, mes);
  const despesasComValores = despesas.map((despesa) => comValorEmReais(despesa));
  const entradasComValores = entradas.map((entrada) => comValorEmReais(entrada));
  const totalEntradas = entradasComValores.reduce((soma, e) => soma + e.valor, 0);

  res.json({
    mes,
    categoriaId,
    totalAtual,
    totalAnterior,
    variacaoAbsoluta,
    variacaoPercentual,
    despesas: despesasComValores,
    entradas: entradasComValores,
    totalEntradas,
  });
});

module.exports = router;
