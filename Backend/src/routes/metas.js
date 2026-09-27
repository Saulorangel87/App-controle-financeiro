const express = require('express');
const db = require('../db');
const { numeroMonetarioValido, mesISOValido } = require('../utils/validacao');
const { paraCentavos, comValorEmReais } = require('../utils/dinheiro');

const router = express.Router();

const LIMITE_NOME = 60;

function mesAtual() {
  return db.prepare(`SELECT strftime('%Y-%m', 'now') AS mes`).get().mes;
}

// Progresso = entradas menos despesas dos meses do período (inclusive nas
// duas pontas). É a mesma ideia de "sobrou" usada no saldo do Relatório,
// só que somada ao longo de vários meses em vez de um só.
function saldoDoPeriodo(usuarioId, mesInicio, mesFim) {
  const totalEntradas = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(valor_centavos, ROUND(valor * 100)) / 100.0), 0) AS total
    FROM entradas
    WHERE usuario_id = ? AND strftime('%Y-%m', data) BETWEEN ? AND ?
  `).get(usuarioId, mesInicio, mesFim).total;

  const totalDespesas = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(valor_centavos, ROUND(valor * 100)) / 100.0), 0) AS total
    FROM despesas
    WHERE usuario_id = ? AND strftime('%Y-%m', data) BETWEEN ? AND ?
  `).get(usuarioId, mesInicio, mesFim).total;

  return totalEntradas - totalDespesas;
}

function comProgresso(meta) {
  const progresso = saldoDoPeriodo(meta.usuario_id, meta.mes_inicio, meta.mes_fim);
  const percentual = meta.valor_alvo > 0
    ? Math.max(0, Math.min(100, Number(((progresso / meta.valor_alvo) * 100).toFixed(1))))
    : 0;

  let status;
  if (progresso >= meta.valor_alvo) status = 'CONCLUIDA';
  else if (meta.mes_fim < mesAtual()) status = 'NAO_ATINGIDA';
  else status = 'EM_ANDAMENTO';

  return { ...meta, progresso, percentual, status };
}

// GET /api/metas
router.get('/', (req, res) => {
  const metas = db.prepare(`
    SELECT * FROM metas WHERE usuario_id = ? ORDER BY mes_fim ASC, id DESC
  `).all(req.usuarioId);

  res.json(metas.map((meta) => comProgresso(comValorEmReais(meta, 'valor_alvo'))));
});

// POST /api/metas
router.post('/', (req, res) => {
  const { nome, valor_alvo, mes_inicio, mes_fim } = req.body;

  if (typeof nome !== 'string' || !nome.trim() || nome.length > LIMITE_NOME) {
    return res.status(400).json({ erro: `nome é obrigatório (máximo ${LIMITE_NOME} caracteres)` });
  }
  if (!numeroMonetarioValido(valor_alvo) || valor_alvo <= 0) {
    return res.status(400).json({ erro: 'valor_alvo inválido' });
  }
  if (!mesISOValido(mes_inicio) || !mesISOValido(mes_fim)) {
    return res.status(400).json({ erro: 'mes_inicio e mes_fim devem estar no formato YYYY-MM' });
  }
  if (mes_fim < mes_inicio) {
    return res.status(400).json({ erro: 'mes_fim não pode ser anterior a mes_inicio' });
  }

  const info = db.prepare(`
    INSERT INTO metas (usuario_id, nome, valor_alvo, valor_alvo_centavos, mes_inicio, mes_fim)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.usuarioId, nome.trim(), valor_alvo, paraCentavos(valor_alvo), mes_inicio, mes_fim);

  const nova = db.prepare('SELECT * FROM metas WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(comProgresso(comValorEmReais(nova, 'valor_alvo')));
});

// PUT /api/metas/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const meta = db.prepare('SELECT * FROM metas WHERE id = ? AND usuario_id = ?').get(id, req.usuarioId);
  if (!meta) return res.status(404).json({ erro: 'meta não encontrada' });

  const { nome, valor_alvo, mes_inicio, mes_fim } = req.body;

  if (nome !== undefined && (typeof nome !== 'string' || !nome.trim() || nome.length > LIMITE_NOME)) {
    return res.status(400).json({ erro: `nome inválido (máximo ${LIMITE_NOME} caracteres)` });
  }
  if (valor_alvo !== undefined && (!numeroMonetarioValido(valor_alvo) || valor_alvo <= 0)) {
    return res.status(400).json({ erro: 'valor_alvo inválido' });
  }
  if (mes_inicio !== undefined && !mesISOValido(mes_inicio)) {
    return res.status(400).json({ erro: 'mes_inicio inválido' });
  }
  if (mes_fim !== undefined && !mesISOValido(mes_fim)) {
    return res.status(400).json({ erro: 'mes_fim inválido' });
  }

  const mesInicioFinal = mes_inicio ?? meta.mes_inicio;
  const mesFimFinal = mes_fim ?? meta.mes_fim;
  if (mesFimFinal < mesInicioFinal) {
    return res.status(400).json({ erro: 'mes_fim não pode ser anterior a mes_inicio' });
  }

  const valorFinal = valor_alvo ?? meta.valor_alvo;
  db.prepare(`
    UPDATE metas
    SET nome = ?, valor_alvo = ?, valor_alvo_centavos = ?, mes_inicio = ?, mes_fim = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    nome !== undefined ? nome.trim() : meta.nome,
    valorFinal,
    paraCentavos(valorFinal),
    mesInicioFinal,
    mesFimFinal,
    id,
    req.usuarioId
  );

  const atualizada = db.prepare('SELECT * FROM metas WHERE id = ?').get(id);
  res.json(comProgresso(comValorEmReais(atualizada, 'valor_alvo')));
});

// DELETE /api/metas/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const info = db.prepare('DELETE FROM metas WHERE id = ? AND usuario_id = ?').run(id, req.usuarioId);
  if (info.changes === 0) return res.status(404).json({ erro: 'meta não encontrada' });

  res.status(204).send();
});

module.exports = router;
