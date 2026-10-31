const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-orcamento-mensal-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';

const app = require('../src/server');
const db = require('../src/db');
const { obterOrcamentoDoMes } = require('../src/routes/orcamento');

async function jsonFetch(baseUrl, rota, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${rota}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', ...(opcoes.headers || {}) },
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

test('mês novo começa zerado e o orçamento anterior só é copiado a pedido', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  const email = 'orcamento-mensal@example.com';
  await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST', body: JSON.stringify({ nome: 'Orçamento', email, senha: 'senha123' }),
  });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);
  const login = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, senha: 'senha123' }),
  });
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };
  const usuario = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);

  db.prepare('INSERT INTO orcamento_mensal (usuario_id, mes, valor, valor_centavos) VALUES (?, ?, ?, ?)').run(
    usuario.id, '2026-08', 4500, 450000
  );

  // Nem quem tinha ligado a antiga opção "repetir todo mês" herda sozinho.
  db.prepare('UPDATE usuarios SET orcamento_recorrente = 1 WHERE id = ?').run(usuario.id);
  const setembro = obterOrcamentoDoMes(usuario.id, '2026-09');
  assert.equal(setembro.valor, 0);
  assert.equal(setembro.base, 0);
  assert.equal(setembro.valorMesAnterior, 4500, 'o valor anterior fica disponível para copiar');

  // Um bônus lançado em setembro entra no orçamento dele, mas a base continua 0.
  await jsonFetch(baseUrl, '/api/entradas', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ origem: 'Bônus', valor: 300, data: '2026-09-10' }),
  });
  let resultado = await jsonFetch(baseUrl, '/api/orcamento?mes=2026-09', { headers: autenticado });
  assert.equal(resultado.corpo.valor, 300);
  assert.equal(resultado.corpo.base, 0);

  // Copiar soma a base anterior às entradas do mês, sem perder o bônus.
  resultado = await jsonFetch(baseUrl, '/api/orcamento/copiar-anterior?mes=2026-09', {
    method: 'POST', headers: autenticado,
  });
  assert.equal(resultado.status, 200);
  assert.equal(resultado.corpo.valor, 4800);
  assert.equal(resultado.corpo.base, 4500);

  // Outubro também não herda nada sozinho; a base copiável é a de setembro
  // (sem o bônus).
  resultado = await jsonFetch(baseUrl, '/api/resumo?mes=2026-10', { headers: autenticado });
  assert.equal(resultado.corpo.orcamentoTotal, 0);
  assert.equal(resultado.corpo.orcamentoBase, 0);
  assert.equal(resultado.corpo.orcamentoMesAnterior, 4500);

  // PUT define o valor do mês pedido; "recorrente" no corpo é ignorado.
  resultado = await jsonFetch(baseUrl, '/api/orcamento?mes=2026-10', {
    method: 'PUT', headers: autenticado, body: JSON.stringify({ valor: 3200, recorrente: true }),
  });
  assert.equal(resultado.status, 200);
  assert.equal(resultado.corpo.valor, 3200);
  assert.equal(obterOrcamentoDoMes(usuario.id, '2026-11').valor, 0);

  // Sem nenhum mês anterior com orçamento, não há o que copiar.
  resultado = await jsonFetch(baseUrl, '/api/orcamento/copiar-anterior?mes=2026-01', {
    method: 'POST', headers: autenticado,
  });
  assert.equal(resultado.status, 400);
});
