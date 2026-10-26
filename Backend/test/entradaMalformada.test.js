const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-malformada-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';

const app = require('../src/server');
const db = require('../src/db');

// Cada requisição sai de um IP diferente (último salto do X-Forwarded-For,
// ver trust proxy em server.js): as respostas 400 contam como tentativa
// errada no limiteAuth, e o 429 esconderia o status que o teste verifica.
let ultimoOcteto = 0;

async function requisitar(baseUrl, rota, { corpoBruto, ...opcoes } = {}) {
  ultimoOcteto += 1;
  const resposta = await fetch(`${baseUrl}${rota}`, {
    ...opcoes,
    body: corpoBruto ?? (opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `203.0.113.${ultimoOcteto}`,
      ...(opcoes.headers || {}),
    },
  });
  const texto = await resposta.text();
  return { status: resposta.status, tipo: resposta.headers.get('content-type') || '', corpo: texto ? JSON.parse(texto) : null };
}

// Antes da correção, um email numérico no login fazia email.toLowerCase()
// lançar dentro de uma rota async e encerrava o processo inteiro — neste
// teste, isso derrubaria o próprio processo de teste em vez de só falhar.
test('payloads com tipos errados recebem 400 e não derrubam a API', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  const casosPublicos = [
    ['/api/auth/login', { email: 123, senha: 'x' }],
    ['/api/auth/login', { email: 'a@b.com', senha: { $ne: '' } }],
    ['/api/auth/registrar', { nome: 'Ana', email: ['a@b.com'], senha: 'senha123' }],
    ['/api/auth/registrar', { nome: 42, email: 'a@b.com', senha: 'senha123' }],
    ['/api/auth/registrar', { nome: 'Ana', email: 'sem-arroba', senha: 'senha123' }],
    ['/api/auth/verificar-email', { token: 999 }],
    ['/api/auth/redefinir-senha', { token: 'abc', novaSenha: 123456 }],
  ];
  for (const [rota, corpo] of casosPublicos) {
    const resultado = await requisitar(baseUrl, rota, { method: 'POST', body: corpo });
    assert.equal(resultado.status, 400, `${rota} ${JSON.stringify(corpo)}`);
    assert.ok(resultado.corpo.erro);
  }

  const jsonInvalido = await requisitar(baseUrl, '/api/auth/login', { method: 'POST', corpoBruto: '{"email":' });
  assert.equal(jsonInvalido.status, 400);
  assert.match(jsonInvalido.tipo, /application\/json/);

  const saude = await requisitar(baseUrl, '/api/health');
  assert.equal(saude.status, 200, 'a API precisa continuar respondendo depois dos payloads inválidos');

  const email = 'malformada@example.com';
  await requisitar(baseUrl, '/api/auth/registrar', { method: 'POST', body: { nome: 'Teste', email, senha: 'senha123' } });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);
  const login = await requisitar(baseUrl, '/api/auth/login', { method: 'POST', body: { email, senha: 'senha123' } });
  assert.equal(login.status, 200);
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };

  const casosAutenticados = [
    ['POST', '/api/categorias', { nome: 1, limite: 100 }],
    ['POST', '/api/categorias', { nome: 'Pets', limite: 'muito' }],
    ['POST', '/api/categorias', { nome: 'Pets', limite: 10, cor: 'azul' }],
    ['POST', '/api/recorrentes', { descricao: 5 }],
    ['POST', '/api/recorrentes', { descricao: 'Luz', valor: 'abc' }],
    ['POST', '/api/despesas', { descricao: 7, valor: 10, categoria_id: 1, data: '2026-01-01' }],
    ['DELETE', '/api/auth/conta', { senha: 123 }],
  ];
  for (const [metodo, rota, corpo] of casosAutenticados) {
    const resultado = await requisitar(baseUrl, rota, { method: metodo, headers: autenticado, body: corpo });
    assert.equal(resultado.status, 400, `${metodo} ${rota} ${JSON.stringify(corpo)}`);
  }

  const filtroInvalido = await requisitar(baseUrl, '/api/despesas?forma_pagamento=cheque', { headers: autenticado });
  assert.equal(filtroInvalido.status, 400);
  const sugestaoRepetida = await requisitar(baseUrl, '/api/despesas/sugestao-categoria?descricao=a&descricao=b', { headers: autenticado });
  assert.equal(sugestaoRepetida.status, 200);
  assert.deepEqual(sugestaoRepetida.corpo, { categoria_id: null });
});
