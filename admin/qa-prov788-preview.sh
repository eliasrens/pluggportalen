#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning: Prov Etapp 3 (#766) mot EMULATORERNA (auth + firestore,
# inga functions) – inga skrivningar mot live. Som admin/qa-prov2-preview.sh
# (#749) men egna portar, i FÖRGRUNDEN (barista_serve) och med två appar mot
# SAMMA emulator:
#   bash admin/qa-prov788-preview.sh   # FS 8988, Auth 9988
#   origin/main = Etapp 2) – för att skapa/köra/rätta ett prov "före Etapp 3" och
#   sedan öppna det i den nya appen. Samtidiga inloggningar: en isolatedContext
#   per person i webbläsaren (samma origin räcker). QA_RAKNA=1: GET /__qa/rakna.
# Konton (lösenord lilla123, bara emulator): qaadmin (admin), qaarskurs4 (4A, 4B),
# qaarskurs5 (5A); elever 4a01–4a04 (Alva, Bilal, Cleo, Dante), 4b01–4b03, 5a01–5a02.
# Kräver: firebase-CLI + Java 21 (JAVA_BIN/FIREBASE_BIN läggs först på PATH om
# satta) och firebase-admin (node_modules/ i repo-roten).
# ============================================================================
set -euo pipefail
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx1200m}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/qa-prov788-preview
CFG="$REPO/.qa-prov788.firebase.json"   # gitignorad (.qa-*)
mkdir -p "$DIR"
cd "$REPO"
node -e '
const d = require("./firebase.json"); delete d.hosting; delete d.functions;
d.emulators = { auth: { port: 9988 }, firestore: { port: 8988, websocketPort: 9388 },
  hub: { port: 4988 }, logging: { port: 4989 }, ui: { enabled: false }, singleProjectMode: true };
require("fs").writeFileSync(process.argv[1], JSON.stringify(d, null, 1));' "$CFG"
PIDS=()
trap 'kill "${PIDS[@]}" 2>/dev/null; wait' EXIT INT TERM
firebase emulators:start --config "$CFG" --project pluggportalen-so-2026 \
  --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null &
PIDS+=($!)
for _ in $(seq 1 80); do grep -q "All emulators ready" "$DIR/emu.log" && break; sleep 1.5; done
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8988 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9988 \
  GCLOUD_PROJECT=pluggportalen-so-2026
node admin/qa-larkonton-seed.mjs
node admin/qa-larkonton-roller-seed.mjs
QA_RAKNA=1 PORT=8788 node admin/qa-emulator-proxy.mjs > "$DIR/proxy-8788.log" 2>&1 < /dev/null &
PIDS+=($!)
PIDS+=($!)
sleep 1
curl -s -o /dev/null -w "nya appen %{http_code} på http://127.0.0.1:8788/#/larare\n" http://127.0.0.1:8788/
wait
