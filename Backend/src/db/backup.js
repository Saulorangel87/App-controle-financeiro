require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./index');

const pastaBackup = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'data', 'backups');
const retencaoDias = Number(process.env.BACKUP_RETENTION_DAYS || 30);
const MAGIC = Buffer.from('CONTROLE-DESPESAS-BACKUP-V1');

function obterChave() {
  const valor = process.env.BACKUP_ENCRYPTION_KEY;
  if (!valor) return null;
  if (!/^[a-f0-9]{64}$/i.test(valor)) throw new Error('BACKUP_ENCRYPTION_KEY precisa ter 64 caracteres hexadecimais (32 bytes)');
  return Buffer.from(valor, 'hex');
}

function criptografar(conteudo, chave) {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', chave, iv);
  const dados = Buffer.concat([cifra.update(conteudo), cifra.final()]);
  return Buffer.concat([MAGIC, iv, cifra.getAuthTag(), dados]);
}

function descriptografar(conteudo, chave) {
  const tamanhoCabecalho = MAGIC.length + 12 + 16;
  if (!conteudo.subarray(0, MAGIC.length).equals(MAGIC) || conteudo.length <= tamanhoCabecalho) throw new Error('formato de backup criptografado inválido');
  const iv = conteudo.subarray(MAGIC.length, MAGIC.length + 12);
  const authTag = conteudo.subarray(MAGIC.length + 12, tamanhoCabecalho);
  const decifra = crypto.createDecipheriv('aes-256-gcm', chave, iv);
  decifra.setAuthTag(authTag);
  return Buffer.concat([decifra.update(conteudo.subarray(tamanhoCabecalho)), decifra.final()]);
}

function removerBackupsAntigos() {
  if (!Number.isInteger(retencaoDias) || retencaoDias < 1) throw new Error('BACKUP_RETENTION_DAYS precisa ser um número inteiro maior que zero');
  const limite = Date.now() - retencaoDias * 24 * 60 * 60 * 1000;
  const removidos = [];
  for (const nome of fs.readdirSync(pastaBackup)) {
    if (!/^despesas-.*\.db(?:\.enc)?$/.test(nome)) continue;
    const arquivo = path.join(pastaBackup, nome);
    if (fs.statSync(arquivo).mtimeMs < limite) {
      fs.unlinkSync(arquivo);
      removidos.push(arquivo);
    }
  }
  return removidos;
}

async function criarBackup() {
  fs.mkdirSync(pastaBackup, { recursive: true });
  const chave = obterChave();
  if (process.env.NODE_ENV === 'production' && !chave) throw new Error('BACKUP_ENCRYPTION_KEY é obrigatória em produção');
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  const temporario = path.join(pastaBackup, `.despesas-${carimbo}.db.tmp`);
  const destino = path.join(pastaBackup, `despesas-${carimbo}.db${chave ? '.enc' : ''}`);
  try {
    await db.backup(temporario);
    if (chave) {
      fs.writeFileSync(destino, criptografar(fs.readFileSync(temporario), chave), { mode: 0o600 });
      fs.unlinkSync(temporario);
    } else {
      fs.renameSync(temporario, destino);
      fs.chmodSync(destino, 0o600);
      console.warn('Aviso: backup não criptografado; defina BACKUP_ENCRYPTION_KEY.');
    }
    return { destino, removidos: removerBackupsAntigos(), criptografado: Boolean(chave) };
  } finally {
    if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
  }
}

async function main() {
  try {
    const resultado = await criarBackup();
    console.log(`Backup concluído${resultado.criptografado ? ' e criptografado' : ''}: ${resultado.destino}`);
    if (resultado.removidos.length) console.log(`Backups antigos removidos: ${resultado.removidos.length}`);
  } catch (erro) {
    console.error('Falha ao criar backup:', erro.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

if (require.main === module) main();

module.exports = { criptografar, descriptografar, criarBackup, removerBackupsAntigos };
