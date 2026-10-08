#!/usr/bin/env bash
# ============================================================================
# Läsresan 10 nivåer (#520, epic #516) – klickbar preview mot EMULATORN.
# ----------------------------------------------------------------------------
# Startar emulator + proxy via admin/qa-lasresan-niva-preview.sh (som seedar
# qa-lasresan-seed + qa-lasresan-niva-seed, båda i GAMMAL skala) och lägger
# till qa-lasresan-10-seed (QA-klass 10N: elever i gammal OCH ny skala, gammal
# startnivå). Klickguide: docs/preview-lasresan-10.md. Skriver aldrig till produktion.
#
#   JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-lasresan-10-preview.sh   # FS 8530, Auth 9530, proxy 8531
#   RESEED=1 bash admin/qa-lasresan-10-preview.sh   # bara seeda om en redan körande emulator
#
# Stoppa: döda PID:erna som skrivs ut sist (inte via `pkill -f` på namnet).
# ============================================================================
set -euo pipefail
export FS=${FS:-8530} AUTH=${AUTH:-9530} PROXY=${PROXY:-8531}
REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO"
if [ -n "${RESEED:-}" ]; then
  export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026
  node admin/qa-lasresan-seed.mjs | tail -1
  node admin/qa-lasresan-niva-seed.mjs | tail -1
else
  bash admin/qa-lasresan-niva-preview.sh
  export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026
fi
node admin/qa-lasresan-10-seed.mjs | tail -1
echo "Klar: http://127.0.0.1:$PROXY/  (lärare qalarare / lilla123, guide docs/preview-lasresan-10.md)"
