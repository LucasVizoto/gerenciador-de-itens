#!/bin/sh
set -e

echo "[api] Aplicando migrações do banco (prisma migrate deploy)..."
./node_modules/.bin/prisma migrate deploy

if [ "$SEED_DEMO" = "true" ]; then
  node dist/seed.js
fi

echo "[api] Iniciando servidor Fastify..."
exec node dist/server.js
