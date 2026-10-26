const express = require('express');
const db = require('../db');
const { numeroMonetarioValido } = require('../utils/validacao');
const { mesAtualISO } = require('../utils/datas');
const { paraCentavos, comValorEmReais } = require('../utils/dinheiro');

const router = express.Router();

// Mês corrente no fuso do app (ver utils/datas.js), não em UTC.
const mesAtual = mesAtualISO;

// Garante que existe uma linha de orçamento pro usuário no mês atual (caso
// ele nunca tenha definido nada nesse mês) — é assim que o valor "reseta"
// sozinho: um mês novo simplesmente não tem linha até alguém criar uma.
function garantirOrcamentoDoMes(usuarioId, mes) {
  db.prepare(`
    INSERT OR IGNORE INTO orcamento_mensal (usuario_id, mes, valor, valor_centavos) VALUES (?, ?, 0, 0)
  `).run(usuarioId, mes);
}

// GET /api/orcamento — sempre o mês corrente
router.get('/', (req, res) => {
  const mes = mesAtual();
  garantirOrcamentoDoMes(req.usuarioId, mes);
  const orcamento = db.prepare(
    'SELECT valor, valor_centavos FROM orcamento_mensal WHERE usuario_id = ? AND mes = ?'
  ).get(req.usuarioId, mes);
  res.json({ ...comValorEmReais(orcamento), mes });
});

// PUT /api/orcamento — define (substitui) o valor do orçamento do mês
// corrente. Uso: "editar" o valor base (ex: corrigir o salário lançado).
router.put('/', (req, res) => {
  const { valor } = req.body;

  if (!numeroMonetarioValido(valor, true)) {
    return res.status(400).json({ erro: 'valor inválido' });
  }

  const mes = mesAtual();
  garantirOrcamentoDoMes(req.usuarioId, mes);
  db.prepare(`
    UPDATE orcamento_mensal SET valor = ?, valor_centavos = ?, atualizado_em = datetime('now')
    WHERE usuario_id = ? AND mes = ?
  `).run(valor, paraCentavos(valor), req.usuarioId, mes);

  res.json({ valor, mes });
});

module.exports = router;
