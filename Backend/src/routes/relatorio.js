const express = require('express');
const db = require('../db');
const { comValorEmReais, centavosOuNulo } = require('../utils/dinheiro');

const router = express.Router();

// Desloca "YYYY-MM" por qualquer quantidade de meses (positiva ou negativa).
// mesAnterior/mesMesmoMesAnoAnterior são casos particulares deste helper.
function deslocarMes(mes, delta) {
  const [ano, m] = mes.split('-').map(Number);
  const data = new Date(ano, m - 1 + delta, 1);
  const anoResultado = data.getFullYear();
  const mesResultado = String(data.getMonth() + 1).padStart(2, '0');
  return `${anoResultado}-${mesResultado}`;
}

function mesAnterior(mes) {
  return deslocarMes(mes, -1);
}

function totalDoMes(usuarioId, mes, categoriaId, formaPagamento) {
  const filtroCategoria = categoriaId ? 'AND categoria_id = ?' : '';
  const filtroFormaPagamento = formaPagamento ? 'AND forma_pagamento = ?' : '';
  const parametros = [usuarioId, mes];
  if (categoriaId) parametros.push(categoriaId);
  if (formaPagamento) parametros.push(formaPagamento);
  const row = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(valor_centavos, ROUND(valor * 100)) / 100.0), 0) AS total
    FROM despesas
    WHERE usuario_id = ? AND strftime('%Y-%m', data) = ? ${filtroCategoria} ${filtroFormaPagamento}
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

// GET /api/relatorio/historico?meses=6&categoria_id=...
// Série mensal de gastos pros últimos N meses (padrão 6, máximo 24),
// terminando no mês corrente. Preenche com 0 os meses sem nenhuma despesa —
// é o que alimenta o gráfico de tendência do Relatório.
router.get('/historico', (req, res) => {
  const quantidadeMeses = Math.min(24, Math.max(2, parseInt(req.query.meses, 10) || 6));
  const categoriaId = req.query.categoria_id ? Number(req.query.categoria_id) : null;
  const formaPagamento = req.query.forma_pagamento || null;

  if (categoriaId !== null) {
    if (!Number.isInteger(categoriaId) || categoriaId < 1) {
      return res.status(400).json({ erro: 'parâmetro categoria_id inválido' });
    }
    const categoria = db.prepare(
      'SELECT id FROM categorias WHERE id = ? AND usuario_id = ?'
    ).get(categoriaId, req.usuarioId);
    if (!categoria) return res.status(400).json({ erro: 'categoria inválida' });
  }

  const mesAtual = new Date().toISOString().slice(0, 7);
  const meses = [];
  for (let i = quantidadeMeses - 1; i >= 0; i -= 1) {
    meses.push(deslocarMes(mesAtual, -i));
  }

  const serie = meses.map((mes) => ({
    mes,
    total: totalDoMes(req.usuarioId, mes, categoriaId, formaPagamento),
  }));

  res.json(serie);
});

// GET /api/relatorio?mes=YYYY-MM
router.get('/', (req, res) => {
  const mes = req.query.mes || new Date().toISOString().slice(0, 7);
  const categoriaId = req.query.categoria_id ? Number(req.query.categoria_id) : null;
  const formaPagamento = req.query.forma_pagamento || null;

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

  const totalAtual = totalDoMes(req.usuarioId, mes, categoriaId, formaPagamento);
  const totalAnterior = totalDoMes(req.usuarioId, mesAnterior(mes), categoriaId, formaPagamento);
  const totalMesmoMesAnoAnterior = totalDoMes(req.usuarioId, deslocarMes(mes, -12), categoriaId, formaPagamento);

  const variacaoAbsoluta = totalAtual - totalAnterior;
  const variacaoPercentual =
    totalAnterior > 0 ? Number(((variacaoAbsoluta / totalAnterior) * 100).toFixed(1)) : null;

  const variacaoAbsolutaAno = totalAtual - totalMesmoMesAnoAnterior;
  const variacaoPercentualAno =
    totalMesmoMesAnoAnterior > 0
      ? Number(((variacaoAbsolutaAno / totalMesmoMesAnoAnterior) * 100).toFixed(1))
      : null;

  const filtroCategoria = categoriaId ? 'AND d.categoria_id = ?' : '';
  const filtroFormaPagamento = formaPagamento ? 'AND d.forma_pagamento = ?' : '';
  const parametrosDespesas = [req.usuarioId, mes];
  if (categoriaId) parametrosDespesas.push(categoriaId);
  if (formaPagamento) parametrosDespesas.push(formaPagamento);
  const despesas = db.prepare(`
    SELECT
      d.id, d.descricao, d.valor, d.valor_centavos, d.data,
      d.dividida_com, d.divisao_valor_centavos, d.forma_pagamento,
      c.nome AS categoria_nome, c.icone AS categoria_icone, c.cor AS categoria_cor
    FROM despesas d
    JOIN categorias c ON c.id = d.categoria_id
    WHERE d.usuario_id = ? AND strftime('%Y-%m', d.data) = ? ${filtroCategoria} ${filtroFormaPagamento}
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
  const despesasComValores = despesas.map((despesa) => {
    const { divisao_valor_centavos, ...resto } = comValorEmReais(despesa);
    return { ...resto, divisao_valor: centavosOuNulo(divisao_valor_centavos) };
  });
  const entradasComValores = entradas.map((entrada) => comValorEmReais(entrada));
  const totalEntradas = entradasComValores.reduce((soma, e) => soma + e.valor, 0);
  const categoriasExcedidas = db.prepare(`
    SELECT c.id, c.nome, c.limite, c.limite_centavos,
           COALESCE(SUM(COALESCE(d.valor_centavos, ROUND(d.valor * 100)) / 100.0), 0) AS gasto
    FROM categorias c
    LEFT JOIN despesas d
      ON d.categoria_id = c.id
      AND d.usuario_id = c.usuario_id
      AND strftime('%Y-%m', d.data) = ?
    WHERE c.usuario_id = ? ${categoriaId ? 'AND c.id = ?' : ''}
    GROUP BY c.id
    HAVING gasto > COALESCE(c.limite_centavos / 100.0, c.limite)
    ORDER BY gasto DESC, c.nome ASC
  `).all(...(categoriaId ? [mes, req.usuarioId, categoriaId] : [mes, req.usuarioId]))
    .map((categoria) => comValorEmReais(categoria, 'limite'));

  res.json({
    mes,
    categoriaId,
    formaPagamento,
    totalAtual,
    totalAnterior,
    variacaoAbsoluta,
    variacaoPercentual,
    totalMesmoMesAnoAnterior,
    variacaoAbsolutaAno,
    variacaoPercentualAno,
    despesas: despesasComValores,
    entradas: entradasComValores,
    totalEntradas,
    categoriasExcedidas,
  });
});

module.exports = router;
