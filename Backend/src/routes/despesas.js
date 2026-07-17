const express = require('express');
const db = require('../db');

const router = express.Router();

// Data de hoje no formato YYYY-MM-DD (mesmo formato salvo no banco), usada
// pra bloquear datas futuras. Comparação é feita por string porque o campo
// "data" é sempre YYYY-MM-DD (comparação lexicográfica funciona igual a
// comparação cronológica nesse formato).
function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/despesas
// Lista todas as despesas do usuário, mais recentes primeiro, com dados da categoria.
router.get('/', (req, res) => {
  const despesas = db.prepare(`
    SELECT
      d.id,
      d.descricao,
      d.valor,
      d.data,
      c.id AS categoria_id,
      c.nome AS categoria_nome,
      c.icone AS categoria_icone,
      c.cor AS categoria_cor
    FROM despesas d
    JOIN categorias c ON c.id = d.categoria_id
    WHERE d.usuario_id = ?
    ORDER BY d.data DESC, d.id DESC
  `).all(req.usuarioId);

  res.json(despesas);
});

// POST /api/despesas
// Cria uma nova despesa.
router.post('/', (req, res) => {
  const { descricao, valor, categoria_id, data } = req.body;

  if (!descricao || valor === undefined || !categoria_id || !data) {
    return res.status(400).json({
      erro: 'descricao, valor, categoria_id e data são obrigatórios',
    });
  }
  if (descricao.length > 80) {
    return res.status(400).json({ erro: 'descrição muito longa (máximo 80 caracteres)' });
  }
  if (data > hojeISO()) {
    return res.status(400).json({ erro: 'não é possível cadastrar uma despesa com data futura' });
  }

  // Garante que a categoria pertence ao usuário atual
  const categoria = db.prepare(
    'SELECT id FROM categorias WHERE id = ? AND usuario_id = ?'
  ).get(categoria_id, req.usuarioId);

  if (!categoria) {
    return res.status(400).json({ erro: 'categoria inválida' });
  }

  const info = db.prepare(`
    INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.usuarioId, categoria_id, descricao, valor, data);

  const nova = db.prepare('SELECT * FROM despesas WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(nova);
});

// PUT /api/despesas/:id
// Edita uma despesa existente (ex: corrigir um cadastro feito errado).
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { descricao, valor, categoria_id, data } = req.body;

  const despesa = db.prepare(
    'SELECT * FROM despesas WHERE id = ? AND usuario_id = ?'
  ).get(id, req.usuarioId);

  if (!despesa) {
    return res.status(404).json({ erro: 'despesa não encontrada' });
  }
  if (descricao !== undefined && descricao.length > 80) {
    return res.status(400).json({ erro: 'descrição muito longa (máximo 80 caracteres)' });
  }
  if (data !== undefined && data > hojeISO()) {
    return res.status(400).json({ erro: 'não é possível cadastrar uma despesa com data futura' });
  }

  if (categoria_id !== undefined) {
    const categoria = db.prepare(
      'SELECT id FROM categorias WHERE id = ? AND usuario_id = ?'
    ).get(categoria_id, req.usuarioId);
    if (!categoria) {
      return res.status(400).json({ erro: 'categoria inválida' });
    }
  }

  db.prepare(`
    UPDATE despesas
    SET descricao = ?, valor = ?, categoria_id = ?, data = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    descricao ?? despesa.descricao,
    valor ?? despesa.valor,
    categoria_id ?? despesa.categoria_id,
    data ?? despesa.data,
    id,
    req.usuarioId
  );

  const atualizada = db.prepare('SELECT * FROM despesas WHERE id = ?').get(id);
  res.json(atualizada);
});

// DELETE /api/despesas/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const info = db.prepare(
    'DELETE FROM despesas WHERE id = ? AND usuario_id = ?'
  ).run(id, req.usuarioId);

  if (info.changes === 0) {
    return res.status(404).json({ erro: 'despesa não encontrada' });
  }

  res.status(204).send();
});

module.exports = router;
