#!/usr/bin/env bash
# Прогон тестов RLS и бизнес-функций против одноразовой тестовой БД.
# Использование: supabase/tests/run.sh [postgres-connection-args...]
# По умолчанию использует локальный кластер postgres (не Docker) с БД ai_lawyer_test,
# создавая её заново при каждом запуске.
set -euo pipefail

cd "$(dirname "$0")/../.."

DB_NAME="${TEST_DB_NAME:-ai_lawyer_test}"
PSQL="psql"
if [ "$(id -u)" -eq 0 ] && command -v su >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then
  PSQL_RUN() { su postgres -c "psql $*"; }
else
  PSQL_RUN() { psql "$@"; }
fi

echo "== Пересоздаём тестовую БД $DB_NAME =="
su postgres -c "psql -c \"drop database if exists $DB_NAME;\" -c \"create database $DB_NAME;\""
su postgres -c "psql -d $DB_NAME -c 'create extension if not exists pgtap;'"

echo "== Применяем шим Supabase (auth.uid(), роли) =="
su postgres -c "psql -d $DB_NAME -v ON_ERROR_STOP=1 -f supabase/tests/00_shim.sql"

echo "== Применяем миграции =="
for f in supabase/migrations/*.sql; do
  echo "-- $f"
  su postgres -c "psql -d $DB_NAME -v ON_ERROR_STOP=1 -f $f"
done

FAIL=0
for t in supabase/tests/10_rls.sql supabase/tests/20_credits.sql; do
  echo "== Запуск $t =="
  OUT="$(su postgres -c "psql -d $DB_NAME -f $t" 2>&1)"
  echo "$OUT"
  if echo "$OUT" | grep -q "not ok"; then
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo "ПРОВАЛЕНЫ ТЕСТЫ"
  exit 1
fi
echo "ВСЕ ТЕСТЫ ЗЕЛЁНЫЕ"
