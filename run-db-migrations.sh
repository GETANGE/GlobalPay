#!/bin/bash
set -e

echo "🚀 Starting host-based SQL migrations..."

# -------------------------------
# Database connection info
# -------------------------------
declare -A DB_MAP_HOST
declare -A DB_MAP_PORT
declare -A DB_MAP_USER
declare -A DB_MAP_PASS
declare -A DB_MAP_NAME

# Authentication service DB
DB_MAP_HOST["Authentication-service"]="localhost"
DB_MAP_PORT["Authentication-service"]="5434"
DB_MAP_USER["Authentication-service"]="auth_user"
DB_MAP_PASS["Authentication-service"]="auth_pass"
DB_MAP_NAME["Authentication-service"]="auth_db"

# Account service DB
DB_MAP_HOST["Account-service"]="localhost"
DB_MAP_PORT["Account-service"]="5435"
DB_MAP_USER["Account-service"]="account_user"
DB_MAP_PASS["Account-service"]="account_pass"
DB_MAP_NAME["Account-service"]="account_db"

# -------------------------------
# Wait for Postgres to be ready
# -------------------------------
wait_for_postgres() {
  local host=$1
  local port=$2
  local user=$3
  local db=$4
  local pass=$5

  echo "⏳ Waiting for Postgres at $host:$port ($db) to be ready..."

  local retries=0
  local max_retries=120  # wait up to 2 minutes

  until PGPASSWORD="$pass" psql -h "$host" -p "$port" -U "$user" -d "$db" -c '\q' >/dev/null 2>&1; do
    retries=$((retries+1))
    if [ $retries -ge $max_retries ]; then
      echo "❌ Timeout waiting for Postgres at $host:$port ($db)"
      exit 1
    fi
    sleep 1
  done

  echo "✅ Postgres at $host:$port ($db) is ready."
}

# -------------------------------
# Run all SQL files in models/
# -------------------------------
run_sql_files() {
  local host=$1
  local port=$2
  local user=$3
  local db=$4
  local pass=$5
  local dir=$6

  echo "📂 Running SQL files in $dir ..."

  for sql in "$dir"/*.sql; do
    if [[ -f "$sql" ]]; then
      echo "📄 Executing: $sql"
      PGPASSWORD="$pass" psql -h "$host" -p "$port" -U "$user" -d "$db" -f "$sql"
      echo "✔ Completed: $sql"
    fi
  done
}

# -------------------------------
# Main loop: detect services with models/
# -------------------------------
for service in */; do
  service=${service%/}  # remove trailing slash

  if [[ -d "$service/models" ]]; then
    echo ""
    echo "========================================"
    echo "   📦 Service detected: $service"
    echo "========================================"

    # Skip if no DB mapping
    if [[ -z "${DB_MAP_HOST[$service]}" ]]; then
      echo "⚠️  No database mapping for $service — skipping..."
      continue
    fi

    host=${DB_MAP_HOST[$service]}
    port=${DB_MAP_PORT[$service]}
    user=${DB_MAP_USER[$service]}
    pass=${DB_MAP_PASS[$service]}
    db=${DB_MAP_NAME[$service]}
    model_dir="$service/models"

    wait_for_postgres "$host" "$port" "$user" "$db" "$pass"
    run_sql_files "$host" "$port" "$user" "$db" "$pass" "$model_dir"
  fi
done

echo ""
echo "🎉 ALL DATABASE MIGRATIONS COMPLETED SUCCESSFULLY 🎉"
echo ""
