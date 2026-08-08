const express = require('express');
const db = require('../db');

const router = express.Router();

// Soma (ou subtrai, com valor negativo) no orçamento do mês correspondente
// à data informada, criando a linha do mês se ainda não existir.
function ajustarOrcamentoDoMes(usuarioId, data, delta) {
  const mes = data.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"
  db.prepare(`
    INSERT INTO orcamento_mensal (usuario_id, mes, valor)
    VALUES (?, ?, ?)
    ON CONFLICT (usuario_id, mes) DO UPDATE SET
      valor = valor + excluded.valor,
      atualizado_em = datetime('now')
  `).run(usuarioId, mes, delta);
}

// GET /api/entradas
// Sem parâmetros: mantém o comportamento antigo (lista o mês corrente
// inteiro, mais recentes primeiro) — usado no painel da Visão Geral.
//
// Com ?pagina e/ou ?porPagina: pagina de verdade no banco (LIMIT/OFFSET),
// mesmo padrão de /despesas — usado na aba Despesas pra listar o histórico
// completo de entradas sem baixar tudo de uma vez.
//
// Com ?mes=YYYY-MM (em qualquer um dos dois modos): filtra só as entradas
// daquele mês — usado no Relatório Mensal.
router.get('/', (req, res) => {
  const { mes, pagina, porPagina } = req.query;

  const filtros = ['usuario_id = ?'];
  const params = [req.usuarioId];
  if (mes) {
    filtros.push("strftime('%Y-%m', data) = ?");
    params.push(mes);
  } else if (pagina === undefined && porPagina === undefined) {
    // Comportamento antigo, sem nenhum parâmetro: só o mês corrente.
    filtros.push("strftime('%Y-%m', data) = strftime('%Y-%m', 'now')");
  }
  const whereSql = filtros.join(' AND ');
  const baseSql = `FROM entradas WHERE ${whereSql}`;

  const paginando = pagina !== undefined || porPagina !== undefined;

  if (!paginando) {
    const entradas = db.prepare(`
      SELECT id, origem, descricao, valor, data
      ${baseSql}
      ORDER BY data DESC, id DESC
    `).all(...params);
    return res.json(entradas);
  }

  const paginaAtual = Math.max(1, parseInt(pagina, 10) || 1);
  const itensPorPagina = Math.min(100, Math.max(1, parseInt(porPagina, 10) || 20));
  const offset = (paginaAtual - 1) * itensPorPagina;

  const { total } = db.prepare(`SELECT COUNT(*) AS total ${baseSql}`).get(...params);
  const { totalGeral } = db.prepare(`
    SELECT COALESCE(SUM(valor), 0) AS totalGeral ${baseSql}
  `).get(...params);

  const entradas = db.prepare(`
    SELECT id, origem, descricao, valor, data
    ${baseSql}
    ORDER BY data DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, itensPorPagina, offset);

  res.json({
    entradas,
    pagina: paginaAtual,
    porPagina: itensPorPagina,
    total,
    totalGeral,
    totalPaginas: Math.max(1, Math.ceil(total / itensPorPagina)),
  });
});

// POST /api/entradas — registra uma entrada de dinheiro e soma no orçamento
// do mês da data informada
router.post('/', (req, res) => {
  const { origem, descricao, valor, data } = req.body;

  if (!origem || !String(origem).trim() || !valor || valor <= 0 || !data) {
    return res.status(400).json({ erro: 'origem, valor e data são obrigatórios' });
  }
  const hoje = db.prepare(`SELECT date('now') AS hoje`).get().hoje;
  if (data > hoje) {
    return res.status(400).json({ erro: 'não é possível registrar uma entrada com data futura' });
  }

  const info = db.prepare(`
    INSERT INTO entradas (usuario_id, origem, descricao, valor, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.usuarioId, String(origem).trim(), descricao ? String(descricao).trim() : null, valor, data);

  ajustarOrcamentoDoMes(req.usuarioId, data, valor);

  res.status(201).json({ id: info.lastInsertRowid, origem, descricao, valor, data });
});

// DELETE /api/entradas/:id — remove a entrada e desfaz o efeito no orçamento
// do mês em que ela tinha sido lançada
router.delete('/:id', (req, res) => {
  const entrada = db.prepare(
    'SELECT * FROM entradas WHERE id = ? AND usuario_id = ?'
  ).get(req.params.id, req.usuarioId);

  if (!entrada) {
    return res.status(404).json({ erro: 'entrada não encontrada' });
  }

  db.prepare('DELETE FROM entradas WHERE id = ? AND usuario_id = ?').run(req.params.id, req.usuarioId);
  ajustarOrcamentoDoMes(req.usuarioId, entrada.data, -entrada.valor);

  res.status(204).send();
});

module.exports = router;
