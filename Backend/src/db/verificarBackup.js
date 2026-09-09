require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { descriptografar } = require('./backup');

const pastaBackup = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'data', 'backups');

function obterChave() {
  const valor = process.env.BACKUP_ENCRYPTION_KEY;
  if (!valor || !/^[a-f0-9]{64}$/i.test(valor)) throw new Error('BACKUP_ENCRYPTION_KEY válida é necessária para verificar o backup');
  return Buffer.from(valor, 'hex');
}

function localizarMaisRecente() {
  return fs.readdirSync(pastaBackup)
    .filter((nome) => /^despesas-.*\.db(?:\.enc)?$/.test(nome))
    .map((nome) => ({ caminho: path.join(pastaBackup, nome), mtime: fs.statSync(path.join(pastaBackup, nome)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.caminho;
}

function verificar() {
  const origem = localizarMaisRecente();
  if (!origem) throw new Error(`nenhum backup encontrado em ${pastaBackup}`);
  const temporario = path.join(os.tmpdir(), `despesas-restore-${process.pid}-${Date.now()}.db`);
  const conteudo = fs.readFileSync(origem);
  const banco = origem.endsWith('.enc') ? descriptografar(conteudo, obterChave()) : conteudo;
  fs.writeFileSync(temporario, banco, { mode: 0o600 });
  try {
    const bancoTeste = new Database(temporario, { readonly: true });
    const resultado = bancoTeste.pragma('integrity_check', { simple: true });
    bancoTeste.close();
    if (resultado !== 'ok') throw new Error(`integrity_check retornou: ${resultado}`);
    return origem;
  } finally {
    fs.rmSync(temporario, { force: true });
  }
}

try {
  console.log(`Backup íntegro: ${verificar()}`);
} catch (erro) {
  console.error('Falha ao verificar backup:', erro.message);
  process.exitCode = 1;
}
