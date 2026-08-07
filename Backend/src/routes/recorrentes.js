const express = require('express');
const db = require('../db');

const router = express.Router();

function mesAtual() {
  return db.prepare(`SELECT strftime('%Y-%m', 'now') AS mes`).get().mes;
}

function comFlagPago(linha, mes) {
  const { pago_mes, pago_em, ...resto } = linha;
  return { ...resto, pago: pago_mes === mes };
}

// GET /api/recorrentes — lista todas as despesas fixas do usuário, com a
// flag "pago" calculada em cima do mês corrente (não é uma coluna fixa —
// por isso "reseta" sozinha quando o mês vira, sem nenhum job).
router.get('/', (req, res) => {
  const mes = mesAtual();
  const linhas = db.prepare(`
    SELECT id, descricao, valor, dia_vencimento, observacao, pago_mes, pago_em
    FROM despesas_recorrentes
    WHERE usuario_id = ?
    ORDER BY dia_vencimento IS NULL, dia_vencimento ASC, descricao ASC
  `).all(req.usuarioId);

  res.json(linhas.map((l) => comFlagPago(l, mes)));
});

// POST /api/recorrentes — cadastra uma nova despesa fixa (conta de luz, etc)
router.post('/', (req, res) => {
  const { descricao, valor, dia_vencimento, observacao } = req.body;

  if (!descricao || !descricao.trim()) {
    return res.status(400).json({ erro: 'descrição é obrigatória' });
  }
  if (dia_vencimento !== undefined && dia_vencimento !== null && dia_vencimento !== '') {
    const dia = Number(dia_vencimento);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      return res.status(400).json({ erro: 'dia de vencimento deve ser entre 1 e 31' });
    }
  }

  const info = db.prepare(`
    INSERT INTO despesas_recorrentes (usuario_id, descricao, valor, dia_vencimento, observacao)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    req.usuarioId,
    descricao.trim(),
    valor ? Number(valor) : null,
    dia_vencimento ? Number(dia_vencimento) : null,
    observacao ? observacao.trim() : null,
  );

  res.status(201).json(comFlagPago(
    db.prepare('SELECT * FROM despesas_recorrentes WHERE id = ?').get(info.lastInsertRowid),
    mesAtual(),
  ));
});

// PUT /api/recorrentes/:id — edita descrição/valor/vencimento/observação
router.put('/:id', (req, res) => {
  const existente = db.prepare(
    'SELECT * FROM despesas_recorrentes WHERE id = ? AND usuario_id = ?'
  ).get(req.params.id, req.usuarioId);
  if (!existente) return res.status(404).json({ erro: 'não encontrada' });

  const { descricao, valor, dia_vencimento, observacao } = req.body;
  if (!descricao || !descricao.trim()) {
    return res.status(400).json({ erro: 'descrição é obrigatória' });
  }

  db.prepare(`
    UPDATE despesas_recorrentes
    SET descricao = ?, valor = ?, dia_vencimento = ?, observacao = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    descricao.trim(),
    valor ? Number(valor) : null,
    dia_vencimento ? Number(dia_vencimento) : null,
    observacao ? observacao.trim() : null,
    req.params.id,
    req.usuarioId,
  );

  res.json(comFlagPago(
    db.prepare('SELECT * FROM despesas_recorrentes WHERE id = ?').get(req.params.id),
    mesAtual(),
  ));
});

// PATCH /api/recorrentes/:id/pago — marca/desmarca como paga NO MÊS CORRENTE
router.patch('/:id/pago', (req, res) => {
  const existente = db.prepare(
    'SELECT * FROM despesas_recorrentes WHERE id = ? AND usuario_id = ?'
  ).get(req.params.id, req.usuarioId);
  if (!existente) return res.status(404).json({ erro: 'não encontrada' });

  const mes = mesAtual();
  const pago = Boolean(req.body.pago);

  db.prepare(`
    UPDATE despesas_recorrentes
    SET pago_mes = ?, pago_em = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    pago ? mes : null,
    pago ? new Date().toISOString() : null,
    req.params.id,
    req.usuarioId,
  );

  res.json(comFlagPago(
    db.prepare('SELECT * FROM despesas_recorrentes WHERE id = ?').get(req.params.id),
    mes,
  ));
});

// DELETE /api/recorrentes/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare(
    'DELETE FROM despesas_recorrentes WHERE id = ? AND usuario_id = ?'
  ).run(req.params.id, req.usuarioId);
  if (info.changes === 0) return res.status(404).json({ erro: 'não encontrada' });
  res.status(204).send();
});

module.exports = router;
