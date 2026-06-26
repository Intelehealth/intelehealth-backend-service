#!/usr/bin/env bash
set -euo pipefail

# Load env (exports variables) for local runs
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "Running migrations for EZAZI (DB_URL_EZAZI_MIGRATE)"
npx sequelize-cli db:migrate --url "$DB_URL_EZAZI_MIGRATE"

echo "Running migrations for NEZAZI (DB_URL_NEZAZI_MIGRATE)"
npx sequelize-cli db:migrate --url "$DB_URL_NEZAZI_MIGRATE"

echo "Migrations completed."
