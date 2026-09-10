const express = require('express');
const db = require('../db');
const { paraCentavos, comValorEmReais } = require('../utils/dinheiro');

const router = express.Router();

// GET /api/categorias
// Lista todas as categorias do usuário, já com total gasto, disponível e status.
// O "gasto" considera apenas despesas do mês corrente (o filtro vai dentro do
// ON do LEFT JOIN, não no WHERE, pra categoria sem despesa no mês continuar
// aparecendo com gasto = 0 em vez de sumir da lista).
router.get('/', (req, res) => {
  const categorias = db.prepare(`
    SELECT
      c.id,
      c.nome,
      c.icone,
      c.cor,
      c.limite,
      c.limite_centavos,
      COALESCE(SUM(COALESCE(d.valor_centavos, ROUND(d.valor * 100)) / 100.0), 0) AS gasto
    FROM categorias c
    LEFT JOIN despesas d
      ON d.categoria_id = c.id
      AND strftime('%Y-%m', d.data) = strftime('%Y-%m', 'now')
    WHERE c.usuario_id = ?
    GROUP BY c.id
    ORDER BY c.id
  `).all(req.usuarioId);

  const resultado = categorias.map((linha) => {
    const c = comValorEmReais(linha, 'limite');
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
    INSERT INTO categorias (usuario_id, nome, icone, cor, limite, limite_centavos)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.usuarioId, nome, icone || 'circle', cor || '#c8f000', limite, paraCentavos(limite));

  const nova = db.prepare('SELECT * FROM categorias WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(comValorEmReais(nova, 'limite'));
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

  const limiteFinal = limite ?? categoria.limite;
  db.prepare(`
    UPDATE categorias
    SET nome = ?, icone = ?, cor = ?, limite = ?, limite_centavos = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    nome ?? categoria.nome,
    icone ?? categoria.icone,
    cor ?? categoria.cor,
    limiteFinal,
    paraCentavos(limiteFinal),
    id,
    req.usuarioId
  );

  const atualizada = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  res.json(comValorEmReais(atualizada, 'limite'));
});

module.exports = router;
