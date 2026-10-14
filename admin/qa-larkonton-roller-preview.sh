#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning: lärarsidan efter roll (#679) mot EMULATORERNA (auth +
# firestore, inga functions) – inga skrivningar mot live.
#   bash admin/qa-larkonton-roller-preview.sh    # FS 8689, Auth 9689, app 8679
# Logga in på http://127.0.0.1:8679/#/larare som qaadmin (admin) eller
# qaarskurs4 (Årskurs 4: 4A, 4B) – lösenord lilla123 (endast emulator).
# Stoppa: döda PID:erna (inte andra items proxyer).
# Kräver: firebase-CLI + Java 21 på PATH (JAVA_BIN/FIREBASE_BIN läggs till om satta)
# och firebase-admin för seed-skripten (node_modules/ i repo-roten).
# ============================================================================
set -euo pipefail
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/qa-larkonton-roller-preview
CFG="$REPO/.qa-larkonton-roller.firebase.json"   # gitignorad
mkdir -p "$DIR"
cd "$REPO"
node -e '
const d = require("./firebase.json"); delete d.hosting; delete d.functions;
d.emulators = { auth: { port: 9689 }, firestore: { port: 8689, websocketPort: 9189 },
  hub: { port: 4689 }, logging: { port: 4690 }, ui: { enabled: false }, singleProjectMode: true };
require("fs").writeFileSync(process.argv[1], JSON.stringify(d, null, 1));' "$CFG"
setsid -f firebase emulators:start --config "$CFG" --project pluggportalen-so-2026 \
  --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null
for _ in $(seq 1 60); do grep -q "All emulators ready" "$DIR/emu.log" && break; sleep 1.5; done
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8689 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9689 \
  GCLOUD_PROJECT=pluggportalen-so-2026
node admin/qa-larkonton-seed.mjs
node admin/qa-larkonton-roller-seed.mjs
PORT=8679 setsid -f node admin/qa-emulator-proxy.mjs > "$DIR/proxy.log" 2>&1 < /dev/null
sleep 1
curl -s -o /dev/null -w "app svarar %{http_code} på http://127.0.0.1:8679/#/larare\n" http://127.0.0.1:8679/
ss -ltnp | grep -E ":(8679|8689|9689)\b" | sed 's/^/  /'
