#!/usr/bin/env bash
# Zera os dados da pilha de teste e reaplica TODAS as migrações (mesmo caminho de um deploy novo).
set -euo pipefail
cd "$(dirname "$0")"
DC="docker compose --env-file .env"
PSQL="$DC exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q"

$PSQL <<'SQL'
set storage.allow_delete_query = 'true';
delete from storage.objects;
drop schema if exists public cascade;
create schema public;
grant usage, create on schema public to postgres;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
delete from auth.users;
SQL
for f in ../../../supabase/migrations/*.sql; do $PSQL -f - < "$f" >/dev/null; done
$PSQL -c "notify pgrst, 'reload schema'" >/dev/null
$DC exec -T mail wget -qO- --method=DELETE http://localhost:8025/api/v1/messages >/dev/null 2>&1 || true
sleep 2
echo "banco de teste recriado"
