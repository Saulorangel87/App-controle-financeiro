const express = require('express');
const db = require('../db');
const { numeroMonetarioValido, dataISOValida } = require('../utils/validacao');
const { paraCentavos, comValorEmReais } = require('../utils/dinheiro');

const router = express.Router();

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
router.get('/', (req, res) => {
  const { mes, pagina, porPagina } = req.query;

  const filtros = ['d.usuario_id = ?'];
  const params = [req.usuarioId];
  if (mes) {
    filtros.push("strftime('%Y-%m', d.data) = ?");
    params.push(mes);
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
             c.id AS categoria_id, c.nome AS categoria_nome,
             c.icone AS categoria_icone, c.cor AS categoria_cor
      ${baseSql}
      ORDER BY d.data DESC, d.id DESC
    `).all(...params);

    return res.json(despesas.map((despesa) => comValorEmReais(despesa)));
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
           c.id AS categoria_id, c.nome AS categoria_nome,
           c.icone AS categoria_icone, c.cor AS categoria_cor
    ${baseSql}
    ORDER BY d.data DESC, d.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, itensPorPagina, offset);

  res.json({
    despesas: despesas.map((despesa) => comValorEmReais(despesa)),
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
  const { descricao, valor, categoria_id, data } = req.body;

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

  // Garante que a categoria pertence ao usuário atual
  const categoria = db.prepare(
    'SELECT id FROM categorias WHERE id = ? AND usuario_id = ?'
  ).get(categoria_id, req.usuarioId);

  if (!categoria) {
    return res.status(400).json({ erro: 'categoria inválida' });
  }

  const info = db.prepare(`
    INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, valor_centavos, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.usuarioId, categoria_id, descricao, valor, paraCentavos(valor), data);

  const nova = db.prepare('SELECT * FROM despesas WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(comValorEmReais(nova));
});

// PUT /api/despesas/:id
// Edita uma despesa existente (ex: corrigir um cadastro feito errado).
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { descricao, valor, categoria_id, data } = req.body;

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
  db.prepare(`
    UPDATE despesas
    SET descricao = ?, valor = ?, valor_centavos = ?, categoria_id = ?, data = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    descricao ?? despesa.descricao,
    valorFinal,
    paraCentavos(valorFinal),
    categoria_id ?? despesa.categoria_id,
    data ?? despesa.data,
    id,
    req.usuarioId
  );

  const atualizada = db.prepare('SELECT * FROM despesas WHERE id = ?').get(id);
  res.json(comValorEmReais(atualizada));
});

// DELETE /api/despesas/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const info = db.prepare(
    'DELETE FROM despesas WHERE id = ? AND usuario_id = ?'
  ).run(id, req.usuarioId);

  if (info.changes === 0) {
    return res.status(404).json({ erro: 'despesa não encontrada' });
  }

  res.status(204).send();
});

module.exports = router;
