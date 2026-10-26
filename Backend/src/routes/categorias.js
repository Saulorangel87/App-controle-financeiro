const express = require('express');
const db = require('../db');
const { paraCentavos, comValorEmReais, somaEmReaisSQL } = require('../utils/dinheiro');
const { numeroMonetarioValido, textoValido } = require('../utils/validacao');
const { mesAtualISO, intervaloDosMeses } = require('../utils/datas');

const router = express.Router();

const LIMITE_NOME = 40;
const LIMITE_ICONE = 40;

function corValida(cor) {
  return typeof cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(cor);
}

// Valida os campos enviados (todos opcionais no PUT). Retorna a mensagem de
// erro ou null — tipos errados viravam erro 500 em paraCentavos/.trim().
function erroDosCampos({ nome, icone, cor, limite }) {
  if (nome !== undefined && !textoValido(nome, LIMITE_NOME)) return `nome inválido (máximo ${LIMITE_NOME} caracteres)`;
  if (icone !== undefined && !textoValido(icone, LIMITE_ICONE)) return 'ícone inválido';
  if (cor !== undefined && !corValida(cor)) return 'cor inválida (use o formato #RRGGBB)';
  if (limite !== undefined && !numeroMonetarioValido(limite, true)) return 'limite inválido';
  return null;
}

// GET /api/categorias
// Lista todas as categorias do usuário, já com total gasto, disponível e status.
// O "gasto" considera apenas despesas do mês corrente (o filtro vai dentro do
// ON do LEFT JOIN, não no WHERE, pra categoria sem despesa no mês continuar
// aparecendo com gasto = 0 em vez de sumir da lista).
router.get('/', (req, res) => {
  const categorias = db.prepare(`
    SELECT
      c.id,
      c.nome,
      c.icone,
      c.cor,
      c.limite,
      c.limite_centavos,
      ${somaEmReaisSQL('d')} AS gasto
    FROM categorias c
    LEFT JOIN despesas d
      ON d.categoria_id = c.id
      AND d.data >= ? AND d.data < ?
    WHERE c.usuario_id = ?
    GROUP BY c.id
    ORDER BY c.id
  `).all(...intervaloDosMeses(mesAtualISO()), req.usuarioId);

  const resultado = categorias.map((linha) => {
    const c = comValorEmReais(linha, 'limite');
    const disponivel = c.limite - c.gasto;
    const percentual = c.limite > 0 ? (c.gasto / c.limite) * 100 : 0;
    return {
      ...c,
      disponivel,
      percentual: Number(percentual.toFixed(1)),
      status: c.gasto > c.limite ? 'EXCEDIDO' : 'OK',
    };
  });

  res.json(resultado);
});

// POST /api/categorias
// Cria uma nova categoria.
router.post('/', (req, res) => {
  const { nome, icone, cor, limite } = req.body;

  if (nome === undefined || limite === undefined) {
    return res.status(400).json({ erro: 'nome e limite são obrigatórios' });
  }
  const erro = erroDosCampos(req.body);
  if (erro) return res.status(400).json({ erro });

  const info = db.prepare(`
    INSERT INTO categorias (usuario_id, nome, icone, cor, limite, limite_centavos)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.usuarioId, nome.trim(), icone || 'circle', cor || '#c8f000', limite, paraCentavos(limite));

  const nova = db.prepare('SELECT * FROM categorias WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(comValorEmReais(nova, 'limite'));
});

// PUT /api/categorias/:id
// Edita o limite (ou outros campos) de uma categoria existente.
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { nome, icone, cor, limite } = req.body;

  const categoria = db.prepare(
    'SELECT * FROM categorias WHERE id = ? AND usuario_id = ?'
  ).get(id, req.usuarioId);

  if (!categoria) {
    return res.status(404).json({ erro: 'categoria não encontrada' });
  }
  const erro = erroDosCampos(req.body);
  if (erro) return res.status(400).json({ erro });

  const limiteFinal = limite ?? categoria.limite;
  db.prepare(`
    UPDATE categorias
    SET nome = ?, icone = ?, cor = ?, limite = ?, limite_centavos = ?
    WHERE id = ? AND usuario_id = ?
  `).run(
    nome !== undefined ? nome.trim() : categoria.nome,
    icone ?? categoria.icone,
    cor ?? categoria.cor,
    limiteFinal,
    paraCentavos(limiteFinal),
    id,
    req.usuarioId
  );

  const atualizada = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  res.json(comValorEmReais(atualizada, 'limite'));
});

module.exports = router;
