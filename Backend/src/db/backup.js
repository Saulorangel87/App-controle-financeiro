require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('./index');

const pastaBackup = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'data', 'backups');
fs.mkdirSync(pastaBackup, { recursive: true });

const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
const destino = path.join(pastaBackup, `despesas-${carimbo}.db`);

db.backup(destino)
  .then(() => {
    console.log(`Backup concluído: ${destino}`);
    db.close();
  })
  .catch((erro) => {
    console.error('Falha ao criar backup:', erro);
    db.close();
    process.exitCode = 1;
  });
