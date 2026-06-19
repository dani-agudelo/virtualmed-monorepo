#!/usr/bin/env bash
# Copia NEXT_PUBLIC_* del .env raíz a VirtualMed_Frontend/.env.local (dev sin Docker)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
OUT="$ROOT/VirtualMed_Frontend/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe $ENV_FILE — copia .env.example a .env primero."
  exit 1
fi

{
  echo "# Generado por scripts/sync-frontend-env.sh — no editar a mano si usas el script"
  grep -E '^NEXT_PUBLIC_' "$ENV_FILE" || true
} > "$OUT"

echo "Escrito: $OUT"
