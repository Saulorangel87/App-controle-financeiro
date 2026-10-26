#!/bin/sh
set -e

# O backend roda como o usuário "node" (sem privilégios), mas o volume
# ./Backend/data vem do host e, nas instalações anteriores, foi criado com o
# container rodando como root. Por isso o container ainda sobe como root só
# para acertar o dono da pasta de dados — poucos arquivos, então é barato
# fazer a cada subida — e em seguida troca de vez para o "node".
#
# "docker compose exec backend npm run ..." (backup, jobs) continua rodando
# como root: os arquivos que ele criar voltam para o "node" na próxima subida,
# e o SQLite rodando como root já cria -wal/-shm com o dono do banco.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data
  chown -R node:node /app/data
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
