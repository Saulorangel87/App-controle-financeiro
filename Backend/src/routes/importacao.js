const express = require('express');
const db = require('../db');
const { numeroMonetarioValido, dataISOValida } = require('../utils/validacao');
const { paraCentavos } = require('../utils/dinheiro');

const router = express.Router();

const LIMITE_LANCAMENTOS = 500;
const LIMITE_DESCRICAO = 80;

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

// Mesma lógica de POST /api/entradas: uma entrada importada também precisa
// somar no orçamento do mês da sua data, senão o "disponível" do dashboard
// fica errado depois da importação.
function ajustarOrcamentoDoMes(usuarioId, data, delta) {
  const mes = data.slice(0, 7);
  db.prepare(`
    INSERT INTO orcamento_mensal (usuario_id, mes, valor, valor_centavos)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (usuario_id, mes) DO UPDATE SET
      valor = valor + excluded.valor,
      valor_centavos = valor_centavos + excluded.valor_centavos,
      atualizado_em = datetime('now')
  `).run(usuarioId, mes, delta, paraCentavos(delta));
}

// POST /api/importacao/extrato
// Recebe um lote de lançamentos já revisados pelo usuário na tela de
// importação (cada um já classificado como despesa/entrada, com categoria
// escolhida no caso de despesa) e insere tudo numa única transação — ou
// entra o lote inteiro, ou nada entra, pra um CSV malformado no meio não
// deixar a importação pela metade.
router.post('/extrato', (req, res) => {
  const { lancamentos } = req.body;

  if (!Array.isArray(lancamentos) || lancamentos.length === 0) {
    return res.status(400).json({ erro: 'lancamentos deve ser uma lista não vazia' });
  }
  if (lancamentos.length > LIMITE_LANCAMENTOS) {
    return res.status(400).json({ erro: `no máximo ${LIMITE_LANCAMENTOS} lançamentos por importação` });
  }

  const hoje = hojeISO();
  const categoriasDoUsuario = new Set(
    db.prepare('SELECT id FROM categorias WHERE usuario_id = ?').all(req.usuarioId).map((c) => c.id)
  );

  for (let indice = 0; indice < lancamentos.length; indice += 1) {
    const item = lancamentos[indice];
    const posicao = indice + 1;

    if (item.tipo !== 'despesa' && item.tipo !== 'entrada') {
      return res.status(400).json({ erro: `lançamento ${posicao}: tipo deve ser "despesa" ou "entrada"` });
    }
    if (!numeroMonetarioValido(item.valor) || !dataISOValida(item.data) || item.data > hoje) {
      return res.status(400).json({ erro: `lançamento ${posicao}: valor ou data inválidos` });
    }

    if (item.tipo === 'despesa') {
      if (!item.descricao || !String(item.descricao).trim() || String(item.descricao).length > LIMITE_DESCRICAO) {
        return res.status(400).json({ erro: `lançamento ${posicao}: descrição inválida` });
      }
      if (!categoriasDoUsuario.has(Number(item.categoria_id))) {
        return res.status(400).json({ erro: `lançamento ${posicao}: categoria inválida` });
      }
    } else if (!item.origem || !String(item.origem).trim()) {
      return res.status(400).json({ erro: `lançamento ${posicao}: origem é obrigatória para entradas` });
    }
  }

  const inserirDespesa = db.prepare(`
    INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, valor_centavos, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const inserirEntrada = db.prepare(`
    INSERT INTO entradas (usuario_id, origem, descricao, valor, valor_centavos, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const importar = db.transaction((itens) => {
    let despesasCriadas = 0;
    let entradasCriadas = 0;

    for (const item of itens) {
      if (item.tipo === 'despesa') {
        inserirDespesa.run(
          req.usuarioId,
          Number(item.categoria_id),
          String(item.descricao).trim(),
          item.valor,
          paraCentavos(item.valor),
          item.data
        );
        despesasCriadas += 1;
      } else {
        inserirEntrada.run(
          req.usuarioId,
          String(item.origem).trim(),
          item.descricao ? String(item.descricao).trim() : null,
          item.valor,
          paraCentavos(item.valor),
          item.data
        );
        ajustarOrcamentoDoMes(req.usuarioId, item.data, item.valor);
        entradasCriadas += 1;
      }
    }

    return { despesasCriadas, entradasCriadas };
  });

  res.status(201).json(importar(lancamentos));
});

module.exports = router;
