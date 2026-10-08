#!/usr/bin/env bash
# ============================================================================
# Läsresan epic #482 slut-QA (#515) – klickbar preview mot EMULATORN.
# ----------------------------------------------------------------------------
# Startar emulator + proxy via admin/qa-lasresan-niva-preview.sh (som seedar
# qa-lasresan-seed + qa-lasresan-niva-seed) och lägger till slut-QA-seeden
# (QA-klass 6C för startnivån + Sen Sara utan klass). Klickguide:
# docs/preview-lasresan-482.md. Skriver aldrig till produktion.
#
#   JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-lasresan-482-preview.sh   # FS 8515, Auth 9515, proxy 8516
#   RESEED=1 bash admin/qa-lasresan-482-preview.sh   # bara seeda om en redan körande emulator
#
# Stoppa: döda PID:erna som skrivs ut sist (inte via `pkill -f` på namnet).
# ============================================================================
set -euo pipefail
export FS=${FS:-8515} AUTH=${AUTH:-9515} PROXY=${PROXY:-8516}
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
node admin/qa-lasresan-482-seed.mjs | tail -1
echo "Klar: http://127.0.0.1:$PROXY/  (lärare qalarare / lilla123, guide docs/preview-lasresan-482.md)"
