#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning: lärarens "Redigera inloggning" + inloggningskort mot
# EMULATORERNA (functions + auth + firestore) – inga skrivningar mot live.
#   bash admin/qa-inloggning-preview.sh    # FS 8533, Auth 9533, Functions 5533, app 8531
# Logga in på http://127.0.0.1:8531/#/larare som qalarare / lilla123 (endast emulator) (klass 4B).
# Stoppa: döda PID:erna som skrivs ut sist (döda INTE andra items proxyer via namn).
# Kräver: firebase-CLI + Java 21 på PATH (JAVA_BIN/FIREBASE_BIN läggs till om satta)
# och `npm --prefix functions install`.
# ============================================================================
set -euo pipefail
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/qa-inloggning-preview
# Config-filen måste ligga i projektkatalogen (sökvägarna får inte peka utanför).
CFG="$REPO/.qa-inloggning.firebase.json"   # gitignorad
mkdir -p "$DIR"
cd "$REPO"
node -e '
const d = require("./firebase.json"); delete d.hosting;
d.emulators = { auth: { port: 9533 }, firestore: { port: 8533, websocketPort: 9153 }, functions: { port: 5533 },
  hub: { port: 4433 }, logging: { port: 4533 }, ui: { enabled: false }, singleProjectMode: true };
require("fs").writeFileSync(process.argv[1], JSON.stringify(d, null, 1));' "$CFG"
setsid -f firebase emulators:start --config "$CFG" --project pluggportalen-so-2026 \
  --only functions,auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null
for _ in $(seq 1 60); do grep -q "All emulators ready" "$DIR/emu.log" && break; sleep 1.5; done
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8533 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9533 \
  FUNCTIONS_EMULATOR_HOST=127.0.0.1:5533 GCLOUD_PROJECT=pluggportalen-so-2026
node admin/qa-inloggning-seed.mjs
PORT=8531 setsid -f node admin/qa-emulator-proxy.mjs > "$DIR/proxy.log" 2>&1 < /dev/null
sleep 1
curl -s -o /dev/null -w "app svarar %{http_code} på http://127.0.0.1:8531/#/larare\n" http://127.0.0.1:8531/
ss -ltnp | grep -E ":(8531|8533|9533|5533)\b" | sed 's/^/  /'
