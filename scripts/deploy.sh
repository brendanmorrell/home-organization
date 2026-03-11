#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Home Navigator Deploy ==="
echo ""

# 1. Load env
if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo "✓ Loaded .env"
else
  echo "✗ No .env file found"
  exit 1
fi

# 2. Sync rooms from house-3d.html → Supabase
echo ""
echo "--- Syncing rooms to Supabase ---"
npx tsx scripts/sync-rooms.ts

# 3. Build
echo ""
echo "--- Building ---"
npm run build
echo "✓ Build complete"

# 4. Deploy to Vercel
echo ""
echo "--- Deploying to Vercel ---"
npx vercel --prod \
  -e VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  -e VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY"

echo ""
echo "=== Done! ==="
