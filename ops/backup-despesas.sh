#!/usr/bin/env bash
set -euo pipefail

PROJETO_DIR="${PROJETO_DIR:-/home/ubuntu/apps/App-controle-financeiro}"
cd "$PROJETO_DIR"

sudo docker compose exec -T backend npm run backup
sudo docker compose exec -T backend npm run backup:verify

BACKUP_BUCKET="$(sed -n 's/^BACKUP_BUCKET=//p' .env 2>/dev/null | head -n 1)"
OCI_REGION="$(sed -n 's/^OCI_REGION=//p' .env 2>/dev/null | head -n 1)"
OCI_REGION="${OCI_REGION:-sa-vinhedo-1}"

if [[ -n "$BACKUP_BUCKET" ]]; then
  OCI_CLI="${OCI_CLI_PATH:-$(command -v oci || true)}"
  if [[ -z "$OCI_CLI" && -x /home/ubuntu/bin/oci ]]; then
    OCI_CLI=/home/ubuntu/bin/oci
  fi
  [[ -n "$OCI_CLI" ]] || { echo "OCI CLI não encontrado; backup externo não enviado." >&2; exit 1; }
  ARQUIVO_BACKUP="$(ls -1t Backend/data/backups/*.db.enc 2>/dev/null | head -n 1)"
  [[ -n "$ARQUIVO_BACKUP" ]] || { echo "Nenhum backup criptografado encontrado para envio." >&2; exit 1; }
  "$OCI_CLI" os object put --auth instance_principal --region "$OCI_REGION" \
    --bucket-name "$BACKUP_BUCKET" \
    --name "$(basename "$ARQUIVO_BACKUP")" \
    --file "$ARQUIVO_BACKUP" --force
  echo "Backup enviado ao bucket: $BACKUP_BUCKET"
fi

echo "Backup criado e verificado com sucesso."
