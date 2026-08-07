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

// GET /api/entradas — lista as entradas do mês corrente (mais recentes primeiro)
router.get('/', (req, res) => {
  const entradas = db.prepare(`
    SELECT id, origem, descricao, valor, data
    FROM entradas
    WHERE usuario_id = ? AND strftime('%Y-%m', data) = strftime('%Y-%m', 'now')
    ORDER BY data DESC, id DESC
  `).all(req.usuarioId);
  res.json(entradas);
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
