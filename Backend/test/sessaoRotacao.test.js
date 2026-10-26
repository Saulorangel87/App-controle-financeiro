const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-sessao-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';

const app = require('../src/server');
const db = require('../src/db');

const hashDoCookie = (cookie) => crypto.createHash('sha256').update(cookie.split('=')[1]).digest('hex');

test('refresh token: rotação revoga a sessão certa e tolera renovações simultâneas', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${servidor.address().port}/api/auth`;

  const post = (rota, corpo, cookie) => fetch(`${base}${rota}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(corpo || {}),
  });
  const cookieDe = (resposta) => resposta.headers.get('set-cookie')?.split(';')[0] || null;
  const login = async (email) => cookieDe(await post('/login', { email, senha: 'senha123' }));

  for (const email of ['ana@example.com', 'bia@example.com']) {
    await post('/registrar', { nome: 'Pessoa', email, senha: 'senha123' });
  }
  db.prepare('UPDATE usuarios SET email_verificado = 1').run();

  // Sessões 1 e 2 são da Ana (usuário 1); a 3 é da Bia (usuário 2). Antes, a
  // renovação da Bia revogava a sessão 2 (id igual ao dela) e não a própria.
  await login('ana@example.com');
  const ana = await login('ana@example.com');
  const bia = await login('bia@example.com');

  let resposta = await post('/refresh', null, bia);
  assert.equal(resposta.status, 200);
  const biaNova = cookieDe(resposta);
  assert.ok(biaNova && biaNova !== bia, 'a renovação entrega um cookie novo');

  resposta = await post('/refresh', null, ana);
  assert.equal(resposta.status, 200, 'a sessão da Ana não pode ser revogada pela renovação da Bia');

  // Reuso imediato do token antigo (outra aba/requisição): vale, mas não
  // rotaciona de novo nem mexe no cookie.
  resposta = await post('/refresh', null, bia);
  assert.equal(resposta.status, 200);
  assert.equal(cookieDe(resposta), null, 'reuso tolerado não troca nem apaga o cookie');
  assert.equal((await resposta.json()).usuario.email, 'bia@example.com');

  // Fora da tolerância, o token trocado não vale mais.
  db.prepare("UPDATE sessoes SET rotacionada_em = '2000-01-01T00:00:00.000Z' WHERE token_hash = ?").run(hashDoCookie(bia));
  resposta = await post('/refresh', null, bia);
  assert.equal(resposta.status, 401, 'token rotacionado há mais de 30s é recusado');

  // Várias requisições expiradas renovando juntas com o mesmo cookie: todas
  // passam, e só uma delas troca o cookie.
  const respostas = await Promise.all(Array.from({ length: 5 }, () => post('/refresh', null, biaNova)));
  assert.deepEqual(respostas.map((r) => r.status), [200, 200, 200, 200, 200]);
  assert.equal(respostas.filter((r) => cookieDe(r)).length, 1);

  // Logout com o cookie novo derruba também o anterior, mesmo na tolerância.
  const antes = await login('ana@example.com');
  const depois = cookieDe(await post('/refresh', null, antes));
  assert.equal((await post('/logout', null, depois)).status, 204);
  assert.equal((await post('/refresh', null, antes)).status, 401);
  assert.equal((await post('/refresh', null, depois)).status, 401);

  // Logout que chega com o cookie antigo encerra também a sessão nova.
  const velho = await login('ana@example.com');
  const novo = cookieDe(await post('/refresh', null, velho));
  await post('/logout', null, velho);
  assert.equal((await post('/refresh', null, novo)).status, 401);
});
