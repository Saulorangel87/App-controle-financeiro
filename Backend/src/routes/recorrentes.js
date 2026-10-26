const express = require('express');
const db = require('../db');
const { hojeISO, mesAtualISO } = require('../utils/datas');
const { paraCentavos, comValorEmReais } = require('../utils/dinheiro');
const {
  numeroMonetarioValido,
  dataISOValida,
  textoValido,
  textoOpcionalValido,
  FORMAS_PAGAMENTO_VALIDAS,
  formaPagamentoValida,
} = require('../utils/validacao');
const { registrar: registrarHistorico } = require('../utils/historico');

const router = express.Router();

const LIMITE_DESCRICAO = 80;
const LIMITE_OBSERVACAO = 200;

function vazio(valor) {
  return valor === undefined || valor === null || valor === '';
}

// Valida os campos comuns do cadastro e da edição. O valor é opcional (conta
// de valor variável), mas quando vem precisa ser um número positivo — antes,
// um texto virava NaN e estourava em paraCentavos com erro 500.
function erroDosCampos({ descricao, valor, dia_vencimento, observacao }) {
  if (!textoValido(descricao, LIMITE_DESCRICAO)) return `descrição é obrigatória (máximo ${LIMITE_DESCRICAO} caracteres)`;
  if (!vazio(valor) && !numeroMonetarioValido(Number(valor))) return 'valor inválido';
  if (!vazio(dia_vencimento)) {
    const dia = Number(dia_vencimento);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return 'dia de vencimento deve ser entre 1 e 31';
  }
  if (!textoOpcionalValido(observacao, LIMITE_OBSERVACAO)) return `observação muito longa (máximo ${LIMITE_OBSERVACAO} caracteres)`;
  return null;
}

// Mês corrente no fuso do app (ver utils/datas.js), não em UTC.
const mesAtual = mesAtualISO;

// Diferença em meses entre dois "YYYY-MM" (ex: 2026-08 - 2026-05 = 3)
function diferencaMeses(mesInicio, mesFim) {
  const [anoI, mesI] = mesInicio.split('-').map(Number);
  const [anoF, mesF] = mesFim.split('-').map(Number);
  return (anoF - anoI) * 12 + (mesF - mesI);
}

// "Hoje" vem no fuso do app: em UTC, às 21h de Brasília a conta que vence
// amanhã já aparecia como "Vence hoje". Vencimento no dia 31 (ou 29/30 em
// fevereiro) cai no último dia do mês, igual ao job de push — antes virava
// o dia 1º do mês seguinte e o alerta chegava atrasado.
function alertaVencimento(dia, pago, concluida, agora = new Date()) {
  if (!dia || pago || concluida) return null;
  const [ano, mes, diaHoje] = hojeISO(agora).split('-').map(Number);
  const ultimoDiaDoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dias = Math.min(Number(dia), ultimoDiaDoMes) - diaHoje;
  if (dias < 0) return { nivel: 'vencida', dias, texto: 'Vencida' };
  if (dias === 0) return { nivel: 'urgente', dias, texto: 'Vence hoje' };
  if (dias === 1) return { nivel: 'urgente', dias, texto: 'Vence amanhã' };
  if (dias <= 3) return { nivel: 'atencao', dias, texto: `Vence em ${dias} dias` };
  return null;
}

// Calcula os campos derivados de uma linha crua do banco: a flag "pago"
// (comparando pago_mes com o mês corrente) e, se for parcelada, a parcela
// atual (calculada a partir de parcela_mes_inicio, não armazenada — por
// isso avança sozinha quando o mês vira, sem job nenhum).
function comCamposCalculados(linha, mes) {
  const { pago_mes, pago_em, parcela_total, parcela_mes_inicio, despesa_paga_id, ...resto } = linha;

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
    // Só a despesa lançada no mês corrente interessa: a do mês passado já
    // é um gasto fechado e não deve sumir ao desmarcar a conta deste mês.
    despesa_paga_id: pago_mes === mes ? (despesa_paga_id ?? null) : null,
    parcela_total: parcela_total || null,
    parcela_atual: parcelaAtual,
    parcela_concluida: parcelaConcluida,
    alerta_vencimento: alertaVencimento(resto.dia_vencimento, pago_mes === mes, parcelaConcluida),
  };
}

// GET /api/recorrentes — lista todas as despesas fixas do usuário, com a
// flag "pago" e a parcela atual calculadas em cima do mês corrente, mais o
// total dos valores lançados. "total" representa o saldo restante do mês:
// parcelas concluídas e contas marcadas como pagas no mês corrente não pesam
// mais nessa soma. "totalCheio" e "totalPago" permitem ao frontend explicar
// de onde veio o saldo exibido.
router.get('/', (req, res) => {
  const mes = mesAtual();
  const linhas = db.prepare(`
    SELECT id, descricao, valor, dia_vencimento, observacao,
           pago_mes, pago_em, parcela_total, parcela_mes_inicio, valor_centavos,
           categoria_id, forma_pagamento, despesa_paga_id
    FROM despesas_recorrentes
    WHERE usuario_id = ?
    ORDER BY dia_vencimento IS NULL, dia_vencimento ASC, descricao ASC
  `).all(req.usuarioId);

  const itens = linhas.map((l) => comCamposCalculados(comValorEmReais(l), mes));
  const ativos = itens.filter((i) => !i.parcela_concluida);
  const totalCheio = ativos.reduce((soma, i) => soma + (i.valor || 0), 0);
  const totalPago = ativos.reduce((soma, i) => soma + (i.pago ? (i.valor || 0) : 0), 0);
  const total = totalCheio - totalPago;

  res.json({ itens, total, totalCheio, totalPago });
});

// POST /api/recorrentes — cadastra uma nova despesa fixa (conta de luz, etc)
// ou uma prestação parcelada (ex: geladeira em 12x) quando parcela_total é
// informado — nesse caso, "valor" é o valor de cada parcela.
router.post('/', (req, res) => {
  const { descricao, valor, dia_vencimento, observacao, parcela_total } = req.body;

  const erro = erroDosCampos(req.body);
  if (erro) return res.status(400).json({ erro });
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
      (usuario_id, descricao, valor, valor_centavos, dia_vencimento, observacao, parcela_total, parcela_mes_inicio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.usuarioId,
    descricao.trim(),
    valor ? Number(valor) : null,
    valor ? paraCentavos(Number(valor)) : null,
    dia_vencimento ? Number(dia_vencimento) : null,
    observacao ? observacao.trim() : null,
    parcelaTotalNum,
    parcelaTotalNum ? mesAtual() : null,
  );

  res.status(201).json(comCamposCalculados(
    comValorEmReais(db.prepare('SELECT * FROM despesas_recorrentes WHERE id = ?').get(info.lastInsertRowid)),
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
  const erro = erroDosCampos(req.body);
  if (erro) return res.status(400).json({ erro });

  const valorFinal = valor ?? existente.valor;
  db.prepare(`
    UPDATE despesas_recorrentes
    SET descricao = ?, valor = ?, valor_centavos = ?, dia_vencimento = ?, observacao = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    descricao.trim(),
    valorFinal ? Number(valorFinal) : null,
    valorFinal ? paraCentavos(Number(valorFinal)) : null,
    dia_vencimento ? Number(dia_vencimento) : null,
    observacao ? observacao.trim() : null,
    req.params.id,
    req.usuarioId,
  );

  res.json(comCamposCalculados(
    comValorEmReais(db.prepare('SELECT * FROM despesas_recorrentes WHERE id = ?').get(req.params.id)),
    mesAtual(),
  ));
});

// Descrição da despesa gerada: "Geladeira (3/12)" para prestações, para a
// lista de despesas mostrar qual parcela foi paga. Corta o nome se preciso
// para caber no limite de descrição das despesas (o mesmo daqui).
function descricaoDaDespesa(recorrente, mes) {
  const { parcela_total: total, parcela_atual: atual } = comCamposCalculados(recorrente, mes);
  const sufixo = total ? ` (${atual}/${total})` : '';
  return recorrente.descricao.slice(0, LIMITE_DESCRICAO - sufixo.length) + sufixo;
}

// Valida os dados da despesa que o pagamento vai lançar. Retorna a mensagem
// de erro ou null.
function erroDaDespesa(usuarioId, { valor, categoria_id, data, forma_pagamento }) {
  if (!numeroMonetarioValido(valor)) return 'informe o valor pago';
  if (!dataISOValida(data)) return 'data do pagamento inválida';
  if (data > hojeISO()) return 'não é possível lançar um pagamento com data futura';
  if (!formaPagamentoValida(forma_pagamento)) {
    return `forma_pagamento inválida (use: ${FORMAS_PAGAMENTO_VALIDAS.join(', ')})`;
  }
  const categoria = db.prepare(
    'SELECT id FROM categorias WHERE id = ? AND usuario_id = ?'
  ).get(categoria_id, usuarioId);
  return categoria ? null : 'categoria inválida';
}

// PATCH /api/recorrentes/:id/pago — marca/desmarca como paga NO MÊS CORRENTE.
//
// Com { pago: true, despesa: { valor, categoria_id, data, forma_pagamento } }
// o pagamento também vira uma despesa de verdade (entra no total do mês, no
// relatório e nos limites de categoria). A categoria e a forma de pagamento
// ficam salvas na conta para virem preenchidas no mês seguinte.
//
// Desmarcar apaga a despesa que foi lançada por esse pagamento — é o
// caminho de volta de um clique errado. Marcar de novo uma conta já paga não
// lança uma segunda despesa.
router.patch('/:id/pago', (req, res) => {
  const existente = db.prepare(
    'SELECT * FROM despesas_recorrentes WHERE id = ? AND usuario_id = ?'
  ).get(req.params.id, req.usuarioId);
  if (!existente) return res.status(404).json({ erro: 'não encontrada' });

  const mes = mesAtual();
  const pago = Boolean(req.body.pago);
  const { despesa } = req.body;
  const jaPagaEsteMes = existente.pago_mes === mes;

  if (despesa !== undefined && despesa !== null) {
    if (typeof despesa !== 'object' || Array.isArray(despesa)) {
      return res.status(400).json({ erro: 'dados da despesa inválidos' });
    }
    if (pago && !jaPagaEsteMes) {
      const erro = erroDaDespesa(req.usuarioId, despesa);
      if (erro) return res.status(400).json({ erro });
    }
  }

  let despesaLancada = null;
  let despesaRemovida = false;

  db.transaction(() => {
    if (pago && jaPagaEsteMes) return;

    if (pago) {
      let despesaPagaId = null;
      if (despesa) {
        const info = db.prepare(`
          INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, valor_centavos, data, forma_pagamento)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.usuarioId, despesa.categoria_id, descricaoDaDespesa(existente, mes),
          despesa.valor, paraCentavos(despesa.valor), despesa.data, despesa.forma_pagamento || null,
        );
        despesaPagaId = info.lastInsertRowid;
        const nova = db.prepare('SELECT * FROM despesas WHERE id = ?').get(despesaPagaId);
        registrarHistorico(req.usuarioId, 'despesas', nova.id, 'criar', null, nova);
        despesaLancada = comValorEmReais(nova);
      }

      db.prepare(`
        UPDATE despesas_recorrentes
        SET pago_mes = ?, pago_em = ?, despesa_paga_id = ?,
            categoria_id = COALESCE(?, categoria_id), forma_pagamento = COALESCE(?, forma_pagamento)
        WHERE id = ? AND usuario_id = ?
      `).run(
        mes, new Date().toISOString(), despesaPagaId,
        despesa ? despesa.categoria_id : null, despesa ? (despesa.forma_pagamento || null) : null,
        req.params.id, req.usuarioId,
      );
      return;
    }

    if (jaPagaEsteMes && existente.despesa_paga_id) {
      const lancada = db.prepare(
        'SELECT * FROM despesas WHERE id = ? AND usuario_id = ?'
      ).get(existente.despesa_paga_id, req.usuarioId);
      if (lancada) {
        db.prepare('DELETE FROM despesas WHERE id = ? AND usuario_id = ?').run(lancada.id, req.usuarioId);
        registrarHistorico(req.usuarioId, 'despesas', lancada.id, 'excluir', lancada, null);
        despesaRemovida = true;
      }
    }

    db.prepare(`
      UPDATE despesas_recorrentes
      SET pago_mes = NULL, pago_em = NULL, despesa_paga_id = NULL
      WHERE id = ? AND usuario_id = ?
    `).run(req.params.id, req.usuarioId);
  })();

  res.json({
    ...comCamposCalculados(
      comValorEmReais(db.prepare('SELECT * FROM despesas_recorrentes WHERE id = ?').get(req.params.id)),
      mes,
    ),
    despesa_lancada: despesaLancada,
    despesa_removida: despesaRemovida,
  });
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
module.exports.diferencaMeses = diferencaMeses;
module.exports.comCamposCalculados = comCamposCalculados;
module.exports.alertaVencimento = alertaVencimento;
