#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning: adminsidan "Lärarkonton" (#677) mot EMULATORERNA
# (functions + auth + firestore) – inga skrivningar mot live.
#   bash admin/qa-larkonton-preview.sh    # FS 8677, Auth 9677, Functions 5677, app 8676
# Logga in på http://127.0.0.1:8676/#/larare som qaadmin / lilla123 (endast emulator)
# och öppna fliken Lärarkonton. Stoppa: döda PID:erna (inte andra items proxyer).
# Kräver: firebase-CLI + Java 21 på PATH (JAVA_BIN/FIREBASE_BIN läggs till om satta)
# och `npm --prefix functions install`.
# ============================================================================
set -euo pipefail
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/qa-larkonton-preview
CFG="$REPO/.qa-larkonton.firebase.json"   # gitignorad
mkdir -p "$DIR"
cd "$REPO"
node -e '
const d = require("./firebase.json"); delete d.hosting; delete d.functions[0].predeploy;
d.emulators = { auth: { port: 9677 }, firestore: { port: 8677, websocketPort: 9177 }, functions: { port: 5677 },
  hub: { port: 4677 }, logging: { port: 4678 }, eventarc: { port: 9678 }, ui: { enabled: false }, singleProjectMode: true };
require("fs").writeFileSync(process.argv[1], JSON.stringify(d, null, 1));' "$CFG"
setsid -f firebase emulators:start --config "$CFG" --project pluggportalen-so-2026 \
  --only functions,auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null
for _ in $(seq 1 60); do grep -q "All emulators ready" "$DIR/emu.log" && break; sleep 1.5; done
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8677 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9677 \
  FUNCTIONS_EMULATOR_HOST=127.0.0.1:5677 GCLOUD_PROJECT=pluggportalen-so-2026
node admin/qa-larkonton-seed.mjs
PORT=8676 setsid -f node admin/qa-emulator-proxy.mjs > "$DIR/proxy.log" 2>&1 < /dev/null
sleep 1
curl -s -o /dev/null -w "app svarar %{http_code} på http://127.0.0.1:8676/#/larare\n" http://127.0.0.1:8676/
ss -ltnp | grep -E ":(8676|8677|9677|5677)\b" | sed 's/^/  /'
