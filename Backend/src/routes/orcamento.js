const express = require('express');
const db = require('../db');
const { numeroMonetarioValido } = require('../utils/validacao');
const { mesDaRequisicao } = require('../utils/datas');
const { paraCentavos, comValorEmReais } = require('../utils/dinheiro');

const router = express.Router();

// O valor guardado em orcamento_mensal já inclui as entradas lançadas no mês
// (routes/entradas.js soma cada uma nele). A "base" é o valor menos essas
// entradas: é ela que se copia de um mês para outro, senão um bônus ou
// reembolso de um mês entraria no orçamento do mês seguinte.
function entradasDoMesCentavos(usuarioId, mes) {
  return db.prepare(`
    SELECT COALESCE(SUM(COALESCE(valor_centavos, ROUND(valor * 100))), 0) AS total
    FROM entradas
    WHERE usuario_id = ? AND data >= ? || '-01' AND data < date(? || '-01', '+1 month')
  `).get(usuarioId, mes, mes).total;
}

// Base do último mês anterior com orçamento > 0 — o valor que o botão
// "Copiar orçamento do mês anterior" oferece.
function ultimoOrcamentoAnterior(usuarioId, mes) {
  const linha = db.prepare(`
    SELECT base_centavos FROM (
      SELECT o.mes,
             COALESCE(o.valor_centavos, ROUND(o.valor * 100)) - COALESCE((
               SELECT SUM(COALESCE(e.valor_centavos, ROUND(e.valor * 100)))
               FROM entradas e
               WHERE e.usuario_id = o.usuario_id
                 AND e.data >= o.mes || '-01'
                 AND e.data < date(o.mes || '-01', '+1 month')
             ), 0) AS base_centavos
      FROM orcamento_mensal o
      WHERE o.usuario_id = ? AND o.mes < ?
    )
    WHERE base_centavos > 0
    ORDER BY mes DESC
    LIMIT 1
  `).get(usuarioId, mes);
  return linha ? { valor: linha.base_centavos / 100, valor_centavos: linha.base_centavos } : null;
}

// Garante que existe uma linha de orçamento pro usuário no mês. O mês novo
// sempre começa em 0: o orçamento de cada mês é diferente, então nada é
// repetido sozinho — copiar o mês anterior é uma ação do usuário
// (POST /api/orcamento/copiar-anterior). A antiga opção "repetir todo mês"
// (usuarios.orcamento_recorrente) não é mais lida.
function garantirOrcamentoDoMes(usuarioId, mes) {
  db.prepare(`
    INSERT OR IGNORE INTO orcamento_mensal (usuario_id, mes, valor, valor_centavos)
    VALUES (?, ?, 0, 0)
  `).run(usuarioId, mes);
}

function obterOrcamentoDoMes(usuarioId, mes) {
  garantirOrcamentoDoMes(usuarioId, mes);
  const orcamento = db.prepare(
    'SELECT valor, valor_centavos FROM orcamento_mensal WHERE usuario_id = ? AND mes = ?'
  ).get(usuarioId, mes);
  const { valor } = comValorEmReais(orcamento);
  const anterior = ultimoOrcamentoAnterior(usuarioId, mes);
  const baseCentavos = paraCentavos(valor) - entradasDoMesCentavos(usuarioId, mes);

  return {
    valor,
    mes,
    base: baseCentavos / 100,
    valorMesAnterior: anterior ? comValorEmReais(anterior).valor : 0,
  };
}

const ERRO_MES = 'parâmetro mes inválido, use o formato YYYY-MM';

// GET /api/orcamento?mes=YYYY-MM — o mês pedido (padrão: o corrente)
router.get('/', (req, res) => {
  const mes = mesDaRequisicao(req);
  if (!mes) return res.status(400).json({ erro: ERRO_MES });
  res.json(obterOrcamentoDoMes(req.usuarioId, mes));
});

// PUT /api/orcamento?mes=YYYY-MM — define (substitui) o valor do orçamento
// do mês pedido (padrão: o corrente).
router.put('/', (req, res) => {
  const { valor } = req.body;
  const mes = mesDaRequisicao(req);
  if (!mes) return res.status(400).json({ erro: ERRO_MES });

  if (!numeroMonetarioValido(valor, true)) {
    return res.status(400).json({ erro: 'valor inválido' });
  }

  db.transaction(() => {
    garantirOrcamentoDoMes(req.usuarioId, mes);
    db.prepare(`
      UPDATE orcamento_mensal SET valor = ?, valor_centavos = ?, atualizado_em = datetime('now')
      WHERE usuario_id = ? AND mes = ?
    `).run(valor, paraCentavos(valor), req.usuarioId, mes);
  })();

  res.json(obterOrcamentoDoMes(req.usuarioId, mes));
});

// POST /api/orcamento/copiar-anterior?mes=YYYY-MM — copia para o mês pedido
// a base do último mês anterior com orçamento. As entradas já lançadas no
// mês continuam somadas por cima, como sempre.
router.post('/copiar-anterior', (req, res) => {
  const mes = mesDaRequisicao(req);
  if (!mes) return res.status(400).json({ erro: ERRO_MES });

  const anterior = ultimoOrcamentoAnterior(req.usuarioId, mes);
  if (!anterior) {
    return res.status(400).json({ erro: 'nenhum mês anterior com orçamento para copiar' });
  }

  db.transaction(() => {
    garantirOrcamentoDoMes(req.usuarioId, mes);
    const totalCentavos = anterior.valor_centavos + entradasDoMesCentavos(req.usuarioId, mes);
    db.prepare(`
      UPDATE orcamento_mensal SET valor = ?, valor_centavos = ?, atualizado_em = datetime('now')
      WHERE usuario_id = ? AND mes = ?
    `).run(totalCentavos / 100, totalCentavos, req.usuarioId, mes);
  })();

  res.json(obterOrcamentoDoMes(req.usuarioId, mes));
});

// PUT /api/orcamento/cartao — define ou limpa o dia de fechamento da fatura
// do cartão de crédito (1 a 31, ou null para usar o mês-calendário).
router.put('/cartao', (req, res) => {
  const { dia_fechamento } = req.body;

  if (
    dia_fechamento !== null &&
    (!Number.isInteger(dia_fechamento) || dia_fechamento < 1 || dia_fechamento > 31)
  ) {
    return res.status(400).json({ erro: 'dia_fechamento deve ser um número inteiro entre 1 e 31' });
  }

  db.prepare('UPDATE usuarios SET dia_fechamento_cartao = ? WHERE id = ?').run(
    dia_fechamento,
    req.usuarioId
  );

  res.json({ diaFechamento: dia_fechamento });
});

module.exports = router;
module.exports.garantirOrcamentoDoMes = garantirOrcamentoDoMes;
module.exports.obterOrcamentoDoMes = obterOrcamentoDoMes;
