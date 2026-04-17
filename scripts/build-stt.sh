#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/../src/stt/transcribe.swift"
OUT="$SCRIPT_DIR/../src/stt/transcribe"

swiftc "$SRC" -o "$OUT" -framework Speech -framework Foundation
echo "Built: $OUT"
