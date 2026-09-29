const express = require('express');
const db = require('../db');
const { numeroMonetarioValido, dataISOValida } = require('../utils/validacao');
const { paraCentavos, comValorEmReais, centavosOuNulo } = require('../utils/dinheiro');
const { registrar: registrarHistorico } = require('../utils/historico');

const router = express.Router();

const LIMITE_DIVIDIDA_COM = 40;
const FORMAS_PAGAMENTO_VALIDAS = ['dinheiro', 'debito', 'credito', 'pix', 'boleto', 'outro'];

// forma_pagamento é opcional: undefined/null/'' significa "não informado".
function formaPagamentoValida(valor) {
  return valor === undefined || valor === null || valor === '' || FORMAS_PAGAMENTO_VALIDAS.includes(valor);
}

// Converte a despesa completa (valor + divisão) pro formato de resposta da
// API: valor_centavos vira valor (comValorEmReais), divisao_valor_centavos
// vira divisao_valor (null quando a despesa não foi dividida com ninguém).
function comDivisao(despesa) {
  const { divisao_valor_centavos, ...resto } = despesa;
  return { ...resto, divisao_valor: centavosOuNulo(divisao_valor_centavos) };
}

function paraResposta(despesa) {
  return comDivisao(comValorEmReais(despesa));
}

// Valida os campos de divisão (dividida_com + divisao_valor) a partir do
// corpo da requisição. Retorna { alterar: false } quando dividida_com nem
// veio no corpo (PUT parcial não mexe na divisão existente), ou os valores
// prontos pra salvar — dividida_com vazio/null limpa uma divisão existente.
function validarDivisao(body, valorReferencia) {
  const { dividida_com, divisao_valor } = body;

  if (dividida_com === undefined) return { alterar: false };

  if (dividida_com === null || dividida_com === '') {
    return { alterar: true, dividida_com: null, divisaoValorCentavos: null };
  }

  if (typeof dividida_com !== 'string' || !dividida_com.trim() || dividida_com.length > LIMITE_DIVIDIDA_COM) {
    return { erro: `dividida_com inválida (máximo ${LIMITE_DIVIDIDA_COM} caracteres)` };
  }
  if (!numeroMonetarioValido(divisao_valor) || divisao_valor > valorReferencia) {
    return { erro: 'divisao_valor deve ser positivo e não pode ultrapassar o valor total da despesa' };
  }

  return { alterar: true, dividida_com: dividida_com.trim(), divisaoValorCentavos: paraCentavos(divisao_valor) };
}

// Data de hoje no formato YYYY-MM-DD (mesmo formato salvo no banco), usada
// pra bloquear datas futuras. Comparação é feita por string porque o campo
// "data" é sempre YYYY-MM-DD (comparação lexicográfica funciona igual a
// comparação cronológica nesse formato).
function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/despesas
// Sem parâmetros: mantém o comportamento antigo (lista tudo, mais recentes
// primeiro) — usado onde a lista precisa ser filtrada/consumida por inteiro.
//
// Com ?pagina e/ou ?porPagina: pagina de verdade no banco (LIMIT/OFFSET),
// pra telas com muitos registros não precisarem baixar a tabela inteira.
// Retorna um objeto com metadados de paginação em vez do array puro.
//
// Com ?mes=YYYY-MM (em qualquer um dos dois modos): filtra só as despesas
// daquele mês.
router.get('/meses', (req, res) => {
  const meses = db.prepare(`
    SELECT DISTINCT strftime('%Y-%m', data) AS mes
    FROM despesas
    WHERE usuario_id = ?
    ORDER BY mes DESC
  `).all(req.usuarioId).map((linha) => linha.mes);
  res.json(meses);
});

// GET /api/despesas/sugestao-categoria?descricao=...
// Sugere uma categoria com base no histórico do próprio usuário: primeiro
// tenta descrição idêntica (ex: sempre cadastrou "Uber" em Transporte),
// depois cai pra um match parcial pela primeira palavra significativa.
// Sempre a categoria mais usada entre as que combinam, nunca a mais recente
// isoladamente — evita que um cadastro avulso desvie a sugestão.
router.get('/sugestao-categoria', (req, res) => {
  const descricao = (req.query.descricao || '').trim();
  if (!descricao) return res.json({ categoria_id: null });

  const normalizada = descricao.toLowerCase();

  const exata = db.prepare(`
    SELECT categoria_id, COUNT(*) AS total
    FROM despesas
    WHERE usuario_id = ? AND LOWER(TRIM(descricao)) = ?
    GROUP BY categoria_id
    ORDER BY total DESC
    LIMIT 1
  `).get(req.usuarioId, normalizada);

  if (exata) return res.json({ categoria_id: exata.categoria_id });

  const primeiraPalavra = normalizada.split(/\s+/)[0];
  if (primeiraPalavra && primeiraPalavra.length >= 3) {
    const parcial = db.prepare(`
      SELECT categoria_id, COUNT(*) AS total
      FROM despesas
      WHERE usuario_id = ? AND LOWER(descricao) LIKE ?
      GROUP BY categoria_id
      ORDER BY total DESC
      LIMIT 1
    `).get(req.usuarioId, `%${primeiraPalavra}%`);
    if (parcial) return res.json({ categoria_id: parcial.categoria_id });
  }

  res.json({ categoria_id: null });
});

router.get('/', (req, res) => {
  const { mes, pagina, porPagina, forma_pagamento } = req.query;

  const filtros = ['d.usuario_id = ?'];
  const params = [req.usuarioId];
  if (mes) {
    filtros.push("strftime('%Y-%m', d.data) = ?");
    params.push(mes);
  }
  if (forma_pagamento) {
    filtros.push('d.forma_pagamento = ?');
    params.push(forma_pagamento);
  }
  const whereSql = filtros.join(' AND ');

  const baseSql = `
    FROM despesas d
    JOIN categorias c ON c.id = d.categoria_id
    WHERE ${whereSql}
  `;

  const paginando = pagina !== undefined || porPagina !== undefined;

  if (!paginando) {
    const despesas = db.prepare(`
      SELECT d.id, d.descricao, d.valor, d.valor_centavos, d.data,
             d.dividida_com, d.divisao_valor_centavos, d.forma_pagamento,
             c.id AS categoria_id, c.nome AS categoria_nome,
             c.icone AS categoria_icone, c.cor AS categoria_cor
      ${baseSql}
      ORDER BY d.data DESC, d.id DESC
    `).all(...params);

    return res.json(despesas.map((despesa) => paraResposta(despesa)));
  }

  const paginaAtual = Math.max(1, parseInt(pagina, 10) || 1);
  const itensPorPagina = Math.min(100, Math.max(1, parseInt(porPagina, 10) || 20));
  const offset = (paginaAtual - 1) * itensPorPagina;

  const { total } = db.prepare(`SELECT COUNT(*) AS total ${baseSql}`).get(...params);
  const { totalGeral } = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(d.valor_centavos, ROUND(d.valor * 100)) / 100.0), 0) AS totalGeral ${baseSql}
  `).get(...params);

  const despesas = db.prepare(`
    SELECT d.id, d.descricao, d.valor, d.valor_centavos, d.data,
           d.dividida_com, d.divisao_valor_centavos, d.forma_pagamento,
           c.id AS categoria_id, c.nome AS categoria_nome,
           c.icone AS categoria_icone, c.cor AS categoria_cor
    ${baseSql}
    ORDER BY d.data DESC, d.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, itensPorPagina, offset);

  res.json({
    despesas: despesas.map((despesa) => paraResposta(despesa)),
    pagina: paginaAtual,
    porPagina: itensPorPagina,
    total,
    totalGeral,
    totalPaginas: Math.max(1, Math.ceil(total / itensPorPagina)),
  });
});

// POST /api/despesas
// Cria uma nova despesa.
router.post('/', (req, res) => {
  const { descricao, valor, categoria_id, data, forma_pagamento } = req.body;

  if (!descricao || !numeroMonetarioValido(valor) || !categoria_id || !dataISOValida(data)) {
    return res.status(400).json({
      erro: 'descricao, valor, categoria_id e data são obrigatórios',
    });
  }
  if (descricao.length > 80) {
    return res.status(400).json({ erro: 'descrição muito longa (máximo 80 caracteres)' });
  }
  if (data > hojeISO()) {
    return res.status(400).json({ erro: 'não é possível cadastrar uma despesa com data futura' });
  }
  if (!formaPagamentoValida(forma_pagamento)) {
    return res.status(400).json({ erro: `forma_pagamento inválida (use: ${FORMAS_PAGAMENTO_VALIDAS.join(', ')})` });
  }

  const divisao = validarDivisao(req.body, valor);
  if (divisao.erro) {
    return res.status(400).json({ erro: divisao.erro });
  }

  // Garante que a categoria pertence ao usuário atual
  const categoria = db.prepare(
    'SELECT id FROM categorias WHERE id = ? AND usuario_id = ?'
  ).get(categoria_id, req.usuarioId);

  if (!categoria) {
    return res.status(400).json({ erro: 'categoria inválida' });
  }

  const info = db.prepare(`
    INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, valor_centavos, data, dividida_com, divisao_valor_centavos, forma_pagamento)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.usuarioId, categoria_id, descricao, valor, paraCentavos(valor), data,
    divisao.alterar ? divisao.dividida_com : null,
    divisao.alterar ? divisao.divisaoValorCentavos : null,
    forma_pagamento || null
  );

  const nova = db.prepare('SELECT * FROM despesas WHERE id = ?').get(info.lastInsertRowid);
  registrarHistorico(req.usuarioId, 'despesas', nova.id, 'criar', null, nova);
  res.status(201).json(paraResposta(nova));
});

// PUT /api/despesas/:id
// Edita uma despesa existente (ex: corrigir um cadastro feito errado).
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { descricao, valor, categoria_id, data, forma_pagamento } = req.body;

  const despesa = db.prepare(
    'SELECT * FROM despesas WHERE id = ? AND usuario_id = ?'
  ).get(id, req.usuarioId);

  if (!despesa) {
    return res.status(404).json({ erro: 'despesa não encontrada' });
  }
  if (descricao !== undefined && descricao.length > 80) {
    return res.status(400).json({ erro: 'descrição muito longa (máximo 80 caracteres)' });
  }
  if (data !== undefined && (!dataISOValida(data) || data > hojeISO())) {
    return res.status(400).json({ erro: 'não é possível cadastrar uma despesa com data futura' });
  }
  if (!formaPagamentoValida(forma_pagamento)) {
    return res.status(400).json({ erro: `forma_pagamento inválida (use: ${FORMAS_PAGAMENTO_VALIDAS.join(', ')})` });
  }

  if (categoria_id !== undefined) {
    const categoria = db.prepare(
      'SELECT id FROM categorias WHERE id = ? AND usuario_id = ?'
    ).get(categoria_id, req.usuarioId);
    if (!categoria) {
      return res.status(400).json({ erro: 'categoria inválida' });
    }
  }

  if (valor !== undefined && !numeroMonetarioValido(valor)) {
    return res.status(400).json({ erro: 'valor inválido' });
  }

  const valorFinal = valor ?? despesa.valor;

  const divisao = validarDivisao(req.body, valorFinal);
  if (divisao.erro) {
    return res.status(400).json({ erro: divisao.erro });
  }

  db.prepare(`
    UPDATE despesas
    SET descricao = ?, valor = ?, valor_centavos = ?, categoria_id = ?, data = ?, dividida_com = ?, divisao_valor_centavos = ?, forma_pagamento = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    descricao ?? despesa.descricao,
    valorFinal,
    paraCentavos(valorFinal),
    categoria_id ?? despesa.categoria_id,
    data ?? despesa.data,
    divisao.alterar ? divisao.dividida_com : despesa.dividida_com,
    divisao.alterar ? divisao.divisaoValorCentavos : despesa.divisao_valor_centavos,
    forma_pagamento !== undefined ? (forma_pagamento || null) : despesa.forma_pagamento,
    id,
    req.usuarioId
  );

  const atualizada = db.prepare('SELECT * FROM despesas WHERE id = ?').get(id);
  registrarHistorico(req.usuarioId, 'despesas', Number(id), 'editar', despesa, atualizada);
  res.json(paraResposta(atualizada));
});

// DELETE /api/despesas/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const despesa = db.prepare(
    'SELECT * FROM despesas WHERE id = ? AND usuario_id = ?'
  ).get(id, req.usuarioId);

  if (!despesa) {
    return res.status(404).json({ erro: 'despesa não encontrada' });
  }

  db.prepare('DELETE FROM despesas WHERE id = ? AND usuario_id = ?').run(id, req.usuarioId);
  registrarHistorico(req.usuarioId, 'despesas', Number(id), 'excluir', despesa, null);

  res.status(204).send();
});

module.exports = router;
