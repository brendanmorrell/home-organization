#!/usr/bin/env bash
# download-whisper-model.sh
#
# Downloads the OpenAI Whisper "base" model to .whisper-models/ in this project.
# Run this ONCE on your Mac (outside the Cowork sandbox) so the model is
# available for video transcription in future Cowork sessions.
#
# Usage:
#   bash scripts/download-whisper-model.sh [model]
#
# Models (smallest → largest):
#   tiny    (~75 MB)  — fastest, OK for clear speech
#   base    (~142 MB) — good default            ← default
#   small   (~466 MB) — better accuracy
#   medium  (~1.5 GB) — high accuracy
#   large   (~2.9 GB) — best, needs GPU

set -eo pipefail
cd "$(dirname "$0")/.."

MODEL="${1:-base}"
CACHE_DIR=".whisper-models"
mkdir -p "$CACHE_DIR"

# Map model name to download URL
case "$MODEL" in
  tiny)   URL="https://openaipublic.azureedge.net/main/whisper/models/65147644a518d12f04e32d6f3b26facc3f8dd46e5390956a9424a650c0ce22b9/tiny.pt" ;;
  base)   URL="https://openaipublic.azureedge.net/main/whisper/models/ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205f891f668f8b0e6c6326e34e/base.pt" ;;
  small)  URL="https://openaipublic.azureedge.net/main/whisper/models/9ecf779972d90ba49c06d968637d720dd632c55bbf19d441fb42bf17a411e794/small.pt" ;;
  medium) URL="https://openaipublic.azureedge.net/main/whisper/models/345ae4da62f9b3d59415adc60127b97c714f32e89e936602e85993674d08dcb1/medium.pt" ;;
  large)  URL="https://openaipublic.azureedge.net/main/whisper/models/e5b1a55b89c1367dacf97e3e19bfd829a01529dbfdeefa8caeb59b3f1b81dadb/large-v3.pt" ;;
  *)
    echo "Unknown model: $MODEL"
    echo "Available: tiny, base, small, medium, large"
    exit 1
    ;;
esac

DEST="$CACHE_DIR/$MODEL.pt"

if [ -f "$DEST" ]; then
  echo "✓ Model already downloaded: $DEST ($(du -h "$DEST" | cut -f1))"
  exit 0
fi

echo "Downloading Whisper '$MODEL' model..."
echo "  URL: $URL"
echo "  Destination: $DEST"
echo ""

curl -L --progress-bar "$URL" -o "$DEST.tmp"
mv "$DEST.tmp" "$DEST"

echo ""
echo "✓ Downloaded: $DEST ($(du -h "$DEST" | cut -f1))"
echo ""
echo "The model is now cached in your project. Cowork sessions will find it automatically."
