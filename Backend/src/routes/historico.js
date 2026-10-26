const express = require('express');
const db = require('../db');
const { paraCentavos, comValorEmReais, centavosOuNulo } = require('../utils/dinheiro');
const { registrar: registrarHistorico } = require('../utils/historico');
const { garantirOrcamentoDoMes } = require('./orcamento');

const router = express.Router();

function formatarLinhaHistorico(linha) {
  return {
    id: linha.id,
    tabela: linha.tabela,
    registro_id: linha.registro_id,
    acao: linha.acao,
    dados_antes: linha.dados_antes ? JSON.parse(linha.dados_antes) : null,
    dados_depois: linha.dados_depois ? JSON.parse(linha.dados_depois) : null,
    criado_em: linha.criado_em,
  };
}

function restaurarExclusao(usuarioId, linhaHistorico) {
  const antes = linhaHistorico.dados_antes ? JSON.parse(linhaHistorico.dados_antes) : null;
  if (!antes) return null;

  if (linhaHistorico.tabela === 'despesas') {
    return db.transaction(() => {
      const catExistente = db.prepare(
        'SELECT id FROM categorias WHERE id = ? AND usuario_id = ?'
      ).get(antes.categoria_id, usuarioId);
      const fallbackCat = catExistente || db.prepare(
        'SELECT id FROM categorias WHERE usuario_id = ? ORDER BY id ASC LIMIT 1'
      ).get(usuarioId);
      if (!fallbackCat) return null;

      const valor = Number.isInteger(antes.valor_centavos)
        ? antes.valor_centavos / 100
        : Number(antes.valor);
      const valorCentavos = Number.isInteger(antes.valor_centavos)
        ? antes.valor_centavos
        : paraCentavos(valor);

      const info = db.prepare(`
        INSERT INTO despesas (
          usuario_id, categoria_id, descricao, valor, valor_centavos, data,
          dividida_com, divisao_valor_centavos, forma_pagamento
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        usuarioId,
        fallbackCat.id,
        antes.descricao,
        valor,
        valorCentavos,
        antes.data,
        antes.dividida_com ?? null,
        antes.divisao_valor_centavos ?? null,
        antes.forma_pagamento ?? null
      );

      db.prepare('DELETE FROM historico_alteracoes WHERE id = ? AND usuario_id = ?').run(
        linhaHistorico.id,
        usuarioId
      );
      const restaurada = db.prepare('SELECT * FROM despesas WHERE id = ?').get(info.lastInsertRowid);
      registrarHistorico(usuarioId, 'despesas', restaurada.id, 'criar', null, restaurada);

      const { divisao_valor_centavos, ...resto } = comValorEmReais(restaurada);
      return {
        tabela: 'despesas',
        restaurado: { ...resto, divisao_valor: centavosOuNulo(divisao_valor_centavos) },
      };
    })();
  }

  if (linhaHistorico.tabela === 'entradas') {
    return db.transaction(() => {
      const valor = Number.isInteger(antes.valor_centavos)
        ? antes.valor_centavos / 100
        : Number(antes.valor);
      const valorCentavos = Number.isInteger(antes.valor_centavos)
        ? antes.valor_centavos
        : paraCentavos(valor);

      const info = db.prepare(`
        INSERT INTO entradas (usuario_id, origem, descricao, valor, valor_centavos, data)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        usuarioId,
        antes.origem,
        antes.descricao ?? null,
        valor,
        valorCentavos,
        antes.data
      );

      const mes = String(antes.data).slice(0, 7);
      garantirOrcamentoDoMes(usuarioId, mes);
      db.prepare(`
        UPDATE orcamento_mensal
        SET valor = valor + ?,
            valor_centavos = COALESCE(valor_centavos, ROUND(valor * 100)) + ?,
            atualizado_em = datetime('now')
        WHERE usuario_id = ? AND mes = ?
      `).run(valor, valorCentavos, usuarioId, mes);

      db.prepare('DELETE FROM historico_alteracoes WHERE id = ? AND usuario_id = ?').run(
        linhaHistorico.id,
        usuarioId
      );
      const restaurada = db.prepare('SELECT * FROM entradas WHERE id = ?').get(info.lastInsertRowid);
      registrarHistorico(usuarioId, 'entradas', restaurada.id, 'criar', null, restaurada);

      return {
        tabela: 'entradas',
        restaurado: comValorEmReais(restaurada),
      };
    })();
  }

  return null;
}

// GET /api/historico
router.get('/', (req, res) => {
  const limite = Math.min(100, Math.max(1, parseInt(req.query.limite, 10) || 30));
  const { acao, tabela } = req.query;

  const filtros = ['usuario_id = ?'];
  const params = [req.usuarioId];

  if (acao !== undefined) {
    if (!['criar', 'editar', 'excluir'].includes(acao)) {
      return res.status(400).json({ erro: 'parâmetro acao inválido' });
    }
    filtros.push('acao = ?');
    params.push(acao);
  }
  if (tabela !== undefined) {
    if (!['despesas', 'entradas'].includes(tabela)) {
      return res.status(400).json({ erro: 'parâmetro tabela inválido' });
    }
    filtros.push('tabela = ?');
    params.push(tabela);
  }

  const linhas = db.prepare(`
    SELECT id, tabela, registro_id, acao, dados_antes, dados_depois, criado_em
    FROM historico_alteracoes
    WHERE ${filtros.join(' AND ')}
    ORDER BY id DESC
    LIMIT ?
  `).all(...params, limite);

  res.json(linhas.map(formatarLinhaHistorico));
});

// POST /api/historico/desfazer
// Desfaz a exclusão mais recente (opcionalmente filtrada por tabela e registro_id).
router.post('/desfazer', (req, res) => {
  const { tabela, registro_id } = req.body;

  if (tabela !== undefined && !['despesas', 'entradas'].includes(tabela)) {
    return res.status(400).json({ erro: 'tabela inválida' });
  }
  if (registro_id !== undefined && (!Number.isInteger(Number(registro_id)) || Number(registro_id) < 1)) {
    return res.status(400).json({ erro: 'registro_id inválido' });
  }

  const filtros = ['usuario_id = ?', "acao = 'excluir'"];
  const params = [req.usuarioId];
  if (tabela) {
    filtros.push('tabela = ?');
    params.push(tabela);
  }
  if (registro_id !== undefined) {
    filtros.push('registro_id = ?');
    params.push(Number(registro_id));
  }

  const linha = db.prepare(`
    SELECT * FROM historico_alteracoes
    WHERE ${filtros.join(' AND ')}
    ORDER BY id DESC
    LIMIT 1
  `).get(...params);

  if (!linha) {
    return res.status(404).json({ erro: 'nenhuma exclusão encontrada para desfazer' });
  }

  const resultado = restaurarExclusao(req.usuarioId, linha);
  if (!resultado) {
    return res.status(400).json({ erro: 'não foi possível restaurar o registro' });
  }

  res.status(201).json(resultado);
});

// POST /api/historico/:id/desfazer
router.post('/:id/desfazer', (req, res) => {
  const { id } = req.params;
  const linha = db.prepare(
    'SELECT * FROM historico_alteracoes WHERE id = ? AND usuario_id = ?'
  ).get(id, req.usuarioId);

  if (!linha) {
    return res.status(404).json({ erro: 'registro de histórico não encontrado' });
  }
  if (linha.acao !== 'excluir') {
    return res.status(400).json({ erro: 'apenas exclusões podem ser desfeitas' });
  }

  const resultado = restaurarExclusao(req.usuarioId, linha);
  if (!resultado) {
    return res.status(400).json({ erro: 'não foi possível restaurar o registro' });
  }

  res.status(201).json(resultado);
});

module.exports = router;
