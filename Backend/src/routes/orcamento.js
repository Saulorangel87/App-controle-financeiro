const express = require('express');
const db = require('../db');

const router = express.Router();

// Garante que existe uma linha de orçamento pro usuário (caso ele nunca tenha definido)
function garantirOrcamento(usuarioId) {
  db.prepare(`
    INSERT OR IGNORE INTO orcamento (usuario_id, valor) VALUES (?, 0)
  `).run(usuarioId);
}

// GET /api/orcamento
router.get('/', (req, res) => {
  garantirOrcamento(req.usuarioId);
  const orcamento = db.prepare(
    'SELECT valor FROM orcamento WHERE usuario_id = ?'
  ).get(req.usuarioId);
  res.json({ valor: orcamento.valor });
});

// PUT /api/orcamento
router.put('/', (req, res) => {
  const { valor } = req.body;

  if (valor === undefined || valor < 0) {
    return res.status(400).json({ erro: 'valor inválido' });
  }

  garantirOrcamento(req.usuarioId);
  db.prepare(`
    UPDATE orcamento SET valor = ?, atualizado_em = datetime('now') WHERE usuario_id = ?
  `).run(valor, req.usuarioId);

  res.json({ valor });
});

module.exports = router;
