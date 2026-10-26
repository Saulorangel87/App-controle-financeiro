const express = require('express');
const db = require('../db');
const { numeroMonetarioValido } = require('../utils/validacao');
const { mesAtualISO } = require('../utils/datas');
const { paraCentavos, comValorEmReais } = require('../utils/dinheiro');

const router = express.Router();

// Mês corrente no fuso do app (ver utils/datas.js), não em UTC.
const mesAtual = mesAtualISO;

// Garante que existe uma linha de orçamento pro usuário no mês atual.
// Se o usuário ativou orcamento_recorrente, o mês novo começa copiando o
// valor do último mês anterior que tinha orçamento > 0; caso contrário,
// começa em 0 como antes.
function ultimoOrcamentoAnterior(usuarioId, mes) {
  return db.prepare(`
    SELECT valor, valor_centavos
    FROM orcamento_mensal
    WHERE usuario_id = ? AND mes < ? AND COALESCE(valor_centavos, ROUND(valor * 100)) > 0
    ORDER BY mes DESC
    LIMIT 1
  `).get(usuarioId, mes);
}

function garantirOrcamentoDoMes(usuarioId, mes) {
  const existente = db.prepare(
    'SELECT 1 FROM orcamento_mensal WHERE usuario_id = ? AND mes = ?'
  ).get(usuarioId, mes);
  if (existente) return;

  const usuario = db.prepare('SELECT orcamento_recorrente FROM usuarios WHERE id = ?').get(usuarioId);
  const recorrente = Boolean(usuario?.orcamento_recorrente);
  const anterior = recorrente ? ultimoOrcamentoAnterior(usuarioId, mes) : null;
  const valorInicial = anterior ? comValorEmReais(anterior).valor : 0;

  db.prepare(`
    INSERT OR IGNORE INTO orcamento_mensal (usuario_id, mes, valor, valor_centavos)
    VALUES (?, ?, ?, ?)
  `).run(usuarioId, mes, valorInicial, paraCentavos(valorInicial));
}

function obterOrcamentoDoMes(usuarioId, mes) {
  garantirOrcamentoDoMes(usuarioId, mes);
  const orcamento = db.prepare(
    'SELECT valor, valor_centavos FROM orcamento_mensal WHERE usuario_id = ? AND mes = ?'
  ).get(usuarioId, mes);
  const usuario = db.prepare('SELECT orcamento_recorrente FROM usuarios WHERE id = ?').get(usuarioId);
  const anterior = ultimoOrcamentoAnterior(usuarioId, mes);

  return {
    ...comValorEmReais(orcamento),
    mes,
    recorrente: Boolean(usuario?.orcamento_recorrente),
    valorMesAnterior: anterior ? comValorEmReais(anterior).valor : 0,
  };
}

// GET /api/orcamento — sempre o mês corrente
router.get('/', (req, res) => {
  res.json(obterOrcamentoDoMes(req.usuarioId, mesAtual()));
});

// PUT /api/orcamento — define (substitui) o valor do orçamento do mês
// corrente e, opcionalmente, ativa/desativa a repetição mensal automática.
router.put('/', (req, res) => {
  const { valor, recorrente } = req.body;

  if (!numeroMonetarioValido(valor, true)) {
    return res.status(400).json({ erro: 'valor inválido' });
  }
  if (recorrente !== undefined && typeof recorrente !== 'boolean') {
    return res.status(400).json({ erro: 'recorrente inválido' });
  }

  const mes = mesAtual();
  db.transaction(() => {
    garantirOrcamentoDoMes(req.usuarioId, mes);
    db.prepare(`
      UPDATE orcamento_mensal SET valor = ?, valor_centavos = ?, atualizado_em = datetime('now')
      WHERE usuario_id = ? AND mes = ?
    `).run(valor, paraCentavos(valor), req.usuarioId, mes);
    if (recorrente !== undefined) {
      db.prepare('UPDATE usuarios SET orcamento_recorrente = ? WHERE id = ?').run(recorrente ? 1 : 0, req.usuarioId);
    }
  })();

  res.json(obterOrcamentoDoMes(req.usuarioId, mes));
});

module.exports = router;
module.exports.garantirOrcamentoDoMes = garantirOrcamentoDoMes;
module.exports.obterOrcamentoDoMes = obterOrcamentoDoMes;
