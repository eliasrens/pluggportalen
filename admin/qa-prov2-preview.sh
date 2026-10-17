#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning: Prov Etapp 2 (#749) mot EMULATORERNA (auth + firestore,
# inga functions) – inga skrivningar mot live. Som admin/qa-prov-preview.sh
# (#743) men egna portar och i FÖRGRUNDEN (barista_serve):
#   bash admin/qa-prov2-preview.sh   # FS 8949, Auth 9949, appen på 8749–8752
# Fyra portar = fyra origins = fyra samtidiga inloggningar i samma webbläsare
# (läraren på 8749, eleverna på 8750–8752). QA_RAKNA=1: GET /__qa/rakna.
# Konton (lösenord lilla123, bara emulator): qaadmin (admin), qaarskurs4 (4A, 4B),
# qaarskurs5 (5A); elever 4a01–4a04 (Alva, Bilal, Cleo, Dante), 4b01–4b03, 5a01–5a02.
# Område "QA Prov 2 – alla sorter" (admin/qa-prov2-seed.mjs).
# Kräver: firebase-CLI + Java 21 (JAVA_BIN/FIREBASE_BIN läggs först på PATH om
# satta) och firebase-admin (node_modules/ i repo-roten).
# ============================================================================
set -euo pipefail
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx1200m}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/qa-prov2-preview
CFG="$REPO/.qa-prov2.firebase.json"   # gitignorad (.qa-*)
mkdir -p "$DIR"
cd "$REPO"
node -e '
const d = require("./firebase.json"); delete d.hosting; delete d.functions;
d.emulators = { auth: { port: 9949 }, firestore: { port: 8949, websocketPort: 9349 },
  hub: { port: 4949 }, logging: { port: 4950 }, ui: { enabled: false }, singleProjectMode: true };
require("fs").writeFileSync(process.argv[1], JSON.stringify(d, null, 1));' "$CFG"
PIDS=()
trap 'kill "${PIDS[@]}" 2>/dev/null; wait' EXIT INT TERM
firebase emulators:start --config "$CFG" --project pluggportalen-so-2026 \
  --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null &
PIDS+=($!)
for _ in $(seq 1 80); do grep -q "All emulators ready" "$DIR/emu.log" && break; sleep 1.5; done
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8949 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9949 \
  GCLOUD_PROJECT=pluggportalen-so-2026
node admin/qa-larkonton-seed.mjs
node admin/qa-larkonton-roller-seed.mjs
node admin/qa-prov2-seed.mjs
for P in 8749 8750 8751 8752; do
  QA_RAKNA=1 PORT=$P node admin/qa-emulator-proxy.mjs > "$DIR/proxy-$P.log" 2>&1 < /dev/null &
  PIDS+=($!)
done
sleep 1
curl -s -o /dev/null -w "app svarar %{http_code} på http://127.0.0.1:8749/#/larare\n" http://127.0.0.1:8749/
wait
