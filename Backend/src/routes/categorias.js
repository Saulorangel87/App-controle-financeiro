const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/categorias
// Lista todas as categorias do usuário, já com total gasto, disponível e status.
router.get('/', (req, res) => {
  const categorias = db.prepare(`
    SELECT
      c.id,
      c.nome,
      c.icone,
      c.cor,
      c.limite,
      COALESCE(SUM(d.valor), 0) AS gasto
    FROM categorias c
    LEFT JOIN despesas d ON d.categoria_id = c.id
    WHERE c.usuario_id = ?
    GROUP BY c.id
    ORDER BY c.id
  `).all(req.usuarioId);

  const resultado = categorias.map((c) => {
    const disponivel = c.limite - c.gasto;
    const percentual = c.limite > 0 ? (c.gasto / c.limite) * 100 : 0;
    return {
      ...c,
      disponivel,
      percentual: Number(percentual.toFixed(1)),
      status: c.gasto > c.limite ? 'EXCEDIDO' : 'OK',
    };
  });

  res.json(resultado);
});

// POST /api/categorias
// Cria uma nova categoria.
router.post('/', (req, res) => {
  const { nome, icone, cor, limite } = req.body;

  if (!nome || limite === undefined) {
    return res.status(400).json({ erro: 'nome e limite são obrigatórios' });
  }

  const info = db.prepare(`
    INSERT INTO categorias (usuario_id, nome, icone, cor, limite)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.usuarioId, nome, icone || 'circle', cor || '#c8f000', limite);

  const nova = db.prepare('SELECT * FROM categorias WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(nova);
});

// PUT /api/categorias/:id
// Edita o limite (ou outros campos) de uma categoria existente.
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nome, icone, cor, limite } = req.body;

  const categoria = db.prepare(
    'SELECT * FROM categorias WHERE id = ? AND usuario_id = ?'
  ).get(id, req.usuarioId);

  if (!categoria) {
    return res.status(404).json({ erro: 'categoria não encontrada' });
  }

  db.prepare(`
    UPDATE categorias
    SET nome = ?, icone = ?, cor = ?, limite = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    nome ?? categoria.nome,
    icone ?? categoria.icone,
    cor ?? categoria.cor,
    limite ?? categoria.limite,
    id,
    req.usuarioId
  );

  const atualizada = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  res.json(atualizada);
});

module.exports = router;
