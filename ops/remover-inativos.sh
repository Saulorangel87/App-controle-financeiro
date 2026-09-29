#!/usr/bin/env bash
set -euo pipefail

PROJETO_DIR="${PROJETO_DIR:-/home/ubuntu/apps/App-controle-financeiro}"
cd "$PROJETO_DIR"

sudo docker compose exec -T backend npm run remover:inativos
