const express = require('express');
const db = require('../db');
const { comValorEmReais, somaEmReaisSQL } = require('../utils/dinheiro');
const { hojeISO, mesAtualISO, intervaloDosMeses } = require('../utils/datas');
const { obterOrcamentoDoMes } = require('./orcamento');

const router = express.Router();

function calcularProjecaoMes(totalGasto, dataHoje = hojeISO()) {
  const [ano, mes, diaAtual] = dataHoje.split('-').map(Number);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const projecaoMes = totalGasto > 0 && diaAtual > 0
    ? Number(((totalGasto / diaAtual) * diasNoMes).toFixed(2))
    : 0;
  return { projecaoMes, diaAtual, diasNoMes };
}

function dataFechamentoDoMes(ano, mes, diaFechamento) {
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const diaReal = Math.min(Math.max(1, diaFechamento), ultimoDia);
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(diaReal).padStart(2, '0')}`;
}

function somarDiasISO(dataISO, dias) {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const dt = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return dt.toISOString().slice(0, 10);
}

function calcularCicloCartao(diaFechamento, dataHoje = hojeISO()) {
  const diaConfig = diaFechamento || 31;
  const [ano, mes] = dataHoje.split('-').map(Number);
  const fechamentoMesAtual = dataFechamentoDoMes(ano, mes, diaConfig);

  if (dataHoje <= fechamentoMesAtual) {
    const dataMesAnterior = new Date(Date.UTC(ano, mes - 2, 1));
    const fechamentoAnterior = dataFechamentoDoMes(
      dataMesAnterior.getUTCFullYear(),
      dataMesAnterior.getUTCMonth() + 1,
      diaConfig
    );
    return {
      inicioCiclo: somarDiasISO(fechamentoAnterior, 1),
      fimCiclo: fechamentoMesAtual,
    };
  }

  const dataMesSeguinte = new Date(Date.UTC(ano, mes, 1));
  const fechamentoSeguinte = dataFechamentoDoMes(
    dataMesSeguinte.getUTCFullYear(),
    dataMesSeguinte.getUTCMonth() + 1,
    diaConfig
  );
  return {
    inicioCiclo: somarDiasISO(fechamentoMesAtual, 1),
    fimCiclo: fechamentoSeguinte,
  };
}

function obterFaturaCartao(usuarioId, dataHoje = hojeISO()) {
  const usuario = db.prepare('SELECT dia_fechamento_cartao FROM usuarios WHERE id = ?').get(usuarioId);
  const diaFechamento = usuario?.dia_fechamento_cartao ?? null;
  const { inicioCiclo, fimCiclo } = calcularCicloCartao(diaFechamento, dataHoje);
  const limiteSuperiorExclusivo = somarDiasISO(fimCiclo, 1);
  const linha = db.prepare(`
    SELECT
      ${somaEmReaisSQL('d')} AS total,
      COUNT(*) AS quantidade
    FROM despesas d
    WHERE d.usuario_id = ?
      AND d.forma_pagamento = 'credito'
      AND d.data >= ? AND d.data < ?
  `).get(usuarioId, inicioCiclo, limiteSuperiorExclusivo);

  return {
    diaFechamento,
    inicioCiclo,
    fimCiclo,
    total: Number(linha?.total || 0),
    quantidade: Number(linha?.quantidade || 0),
  };
}

// GET /api/resumo
// Retorna os totais usados na tela de Visão Geral: total gasto, orçamento
// total, disponível e quantidade de categorias em alerta.
// Assim como em /categorias, o gasto considera só o mês corrente — o
// dashboard reflete o mês em andamento, não a soma histórica de tudo.
router.get('/', (req, res) => {
  const mesAtual = mesAtualISO();
  const categorias = db.prepare(`
    SELECT
      c.id,
      c.nome,
      c.limite,
      c.limite_centavos,
      ${somaEmReaisSQL('d')} AS gasto
    FROM categorias c
    LEFT JOIN despesas d
      ON d.categoria_id = c.id
      AND d.data >= ? AND d.data < ?
    WHERE c.usuario_id = ?
    GROUP BY c.id
  `).all(...intervaloDosMeses(mesAtual), req.usuarioId);

  const categoriasComValores = categorias.map((linha) => comValorEmReais(linha, 'limite'));
  const totalGasto = categoriasComValores.reduce((soma, c) => soma + c.gasto, 0);

  // Orçamento total é definido manualmente pelo usuário, por mês (tabela
  // orcamento_mensal). Quando orcamento_recorrente está ativo no usuário,
  // um mês novo herda automaticamente o valor do último mês positivo.
  const orcamento = obterOrcamentoDoMes(req.usuarioId, mesAtual);
  const orcamentoTotal = orcamento.valor;

  const disponivel = orcamentoTotal - totalGasto;
  const categoriasComAlerta = categoriasComValores.filter((c) => c.gasto > c.limite).length;
  const percentualUtilizado = orcamentoTotal > 0 ? (totalGasto / orcamentoTotal) * 100 : 0;
  const { projecaoMes, diaAtual, diasNoMes } = calcularProjecaoMes(totalGasto);
  const faturaCartao = obterFaturaCartao(req.usuarioId);

  res.json({
    mes: mesAtual,
    totalGasto,
    orcamentoTotal,
    orcamentoRecorrente: orcamento.recorrente,
    orcamentoMesAnterior: orcamento.valorMesAnterior,
    disponivel,
    categoriasComAlerta,
    percentualUtilizado: Number(percentualUtilizado.toFixed(1)),
    projecaoMes,
    diaAtual,
    diasNoMes,
    faturaCartao,
    gastoPorCategoria: categoriasComValores.map((c) => ({
      nome: c.nome,
      gasto: c.gasto,
      limite: c.limite,
    })),
  });
});

module.exports = router;
module.exports.calcularProjecaoMes = calcularProjecaoMes;
module.exports.calcularCicloCartao = calcularCicloCartao;
