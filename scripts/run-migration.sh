#!/bin/bash
# Run a SQL migration against Supabase using the Management API.
# Usage: ./scripts/run-migration.sh migrations/my-migration.sql
#
# Requires SUPABASE_ACCESS_TOKEN in .env (personal access token from supabase.com/dashboard/account/tokens)
# Project ref is extracted from VITE_SUPABASE_URL in .env.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN not set in .env"
  echo "Get one at: supabase.com/dashboard/account/tokens"
  exit 1
fi

# Extract project ref from URL (e.g., https://XXXXX.supabase.co -> XXXXX)
PROJECT_REF=$(echo "$VITE_SUPABASE_URL" | sed 's|https://||' | sed 's|\.supabase\.co||')

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <sql-file>"
  echo "Example: $0 migrations/add-references-table.sql"
  exit 1
fi

SQL_FILE="$1"
if [ ! -f "$SQL_FILE" ]; then
  # Try relative to project dir
  SQL_FILE="$PROJECT_DIR/$1"
fi

if [ ! -f "$SQL_FILE" ]; then
  echo "ERROR: SQL file not found: $1"
  exit 1
fi

SQL=$(cat "$SQL_FILE")
echo "Running migration: $1"
echo "Project: $PROJECT_REF"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d "$(jq -n --arg q "$SQL" '{query: $q}')")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "Migration succeeded ($HTTP_CODE)"
else
  echo "Migration FAILED ($HTTP_CODE):"
  echo "$BODY"
  exit 1
fi
