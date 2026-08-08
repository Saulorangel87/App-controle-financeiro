const express = require('express');
const db = require('../db');

const router = express.Router();

function mesAtual() {
  return db.prepare(`SELECT strftime('%Y-%m', 'now') AS mes`).get().mes;
}

// Diferença em meses entre dois "YYYY-MM" (ex: 2026-08 - 2026-05 = 3)
function diferencaMeses(mesInicio, mesFim) {
  const [anoI, mesI] = mesInicio.split('-').map(Number);
  const [anoF, mesF] = mesFim.split('-').map(Number);
  return (anoF - anoI) * 12 + (mesF - mesI);
}

// Calcula os campos derivados de uma linha crua do banco: a flag "pago"
// (comparando pago_mes com o mês corrente) e, se for parcelada, a parcela
// atual (calculada a partir de parcela_mes_inicio, não armazenada — por
// isso avança sozinha quando o mês vira, sem job nenhum).
function comCamposCalculados(linha, mes) {
  const { pago_mes, pago_em, parcela_total, parcela_mes_inicio, ...resto } = linha;

  let parcelaAtual = null;
  let parcelaConcluida = false;
  if (parcela_total && parcela_mes_inicio) {
    const decorridos = diferencaMeses(parcela_mes_inicio, mes) + 1;
    parcelaAtual = Math.min(Math.max(decorridos, 1), parcela_total);
    parcelaConcluida = decorridos > parcela_total;
  }

  return {
    ...resto,
    pago: pago_mes === mes,
    parcela_total: parcela_total || null,
    parcela_atual: parcelaAtual,
    parcela_concluida: parcelaConcluida,
  };
}

// GET /api/recorrentes — lista todas as despesas fixas do usuário, com a
// flag "pago" e a parcela atual calculadas em cima do mês corrente, mais o
// total dos valores lançados (soma de "valor", ignorando parcelamentos já
// concluídos — eles não pesam mais no mês).
router.get('/', (req, res) => {
  const mes = mesAtual();
  const linhas = db.prepare(`
    SELECT id, descricao, valor, dia_vencimento, observacao,
           pago_mes, pago_em, parcela_total, parcela_mes_inicio
    FROM despesas_recorrentes
    WHERE usuario_id = ?
    ORDER BY dia_vencimento IS NULL, dia_vencimento ASC, descricao ASC
  `).all(req.usuarioId);

  const itens = linhas.map((l) => comCamposCalculados(l, mes));
  const total = itens.reduce((soma, i) => soma + (i.parcela_concluida ? 0 : (i.valor || 0)), 0);

  res.json({ itens, total });
});

// POST /api/recorrentes — cadastra uma nova despesa fixa (conta de luz, etc)
// ou uma prestação parcelada (ex: geladeira em 12x) quando parcela_total é
// informado — nesse caso, "valor" é o valor de cada parcela.
router.post('/', (req, res) => {
  const { descricao, valor, dia_vencimento, observacao, parcela_total } = req.body;

  if (!descricao || !descricao.trim()) {
    return res.status(400).json({ erro: 'descrição é obrigatória' });
  }
  if (dia_vencimento !== undefined && dia_vencimento !== null && dia_vencimento !== '') {
    const dia = Number(dia_vencimento);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      return res.status(400).json({ erro: 'dia de vencimento deve ser entre 1 e 31' });
    }
  }
  let parcelaTotalNum = null;
  if (parcela_total !== undefined && parcela_total !== null && parcela_total !== '') {
    parcelaTotalNum = Number(parcela_total);
    if (!Number.isInteger(parcelaTotalNum) || parcelaTotalNum < 2 || parcelaTotalNum > 999) {
      return res.status(400).json({ erro: 'número de parcelas deve ser entre 2 e 999' });
    }
    if (!valor || valor <= 0) {
      return res.status(400).json({ erro: 'informe o valor de cada parcela' });
    }
  }

  const info = db.prepare(`
    INSERT INTO despesas_recorrentes
      (usuario_id, descricao, valor, dia_vencimento, observacao, parcela_total, parcela_mes_inicio)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.usuarioId,
    descricao.trim(),
    valor ? Number(valor) : null,
    dia_vencimento ? Number(dia_vencimento) : null,
    observacao ? observacao.trim() : null,
    parcelaTotalNum,
    parcelaTotalNum ? mesAtual() : null,
  );

  res.status(201).json(comCamposCalculados(
    db.prepare('SELECT * FROM despesas_recorrentes WHERE id = ?').get(info.lastInsertRowid),
    mesAtual(),
  ));
});

// PUT /api/recorrentes/:id — edita descrição/valor/vencimento/observação.
// Não reabre edição do parcelamento em si (total de parcelas e mês de
// início) — pra mudar isso, o caminho mais simples é excluir e recriar.
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

  res.json(comCamposCalculados(
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

  res.json(comCamposCalculados(
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
