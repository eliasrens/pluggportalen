#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning: adminfliken "Säsong" (#690) mot EMULATORERNA
# (auth + firestore) – inga skrivningar mot live.
#   bash admin/qa-sasong-preview.sh    # FS 8690, Auth 9690, app 8691
# Logga in på http://127.0.0.1:8691/#/larare som qaadmin / lilla123 (endast
# emulator) → Admin → Säsong. Årskurskontot qaarskurs5 ser inte fliken.
# Stoppa: döda PID:erna (inte andra items proxyer).
# Kräver: firebase-CLI + Java 21 på PATH (JAVA_BIN/FIREBASE_BIN läggs till om satta).
# ============================================================================
set -euo pipefail
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/qa-sasong-preview
CFG="$REPO/.qa-sasong.firebase.json"   # gitignorad (.qa-*.firebase.json)
mkdir -p "$DIR"
cd "$REPO"
node -e '
const d = require("./firebase.json"); delete d.hosting; delete d.functions;
d.emulators = { auth: { port: 9690 }, firestore: { port: 8690, websocketPort: 9190 },
  hub: { port: 4690 }, logging: { port: 4691 }, ui: { enabled: false }, singleProjectMode: true };
require("fs").writeFileSync(process.argv[1], JSON.stringify(d, null, 1));' "$CFG"
setsid -f firebase emulators:start --config "$CFG" --project pluggportalen-so-2026 \
  --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null
for _ in $(seq 1 60); do grep -q "All emulators ready" "$DIR/emu.log" && break; sleep 1.5; done
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8690 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9690 \
  GCLOUD_PROJECT=pluggportalen-so-2026
node admin/qa-larkonton-seed.mjs
PORT=8691 setsid -f node admin/qa-emulator-proxy.mjs > "$DIR/proxy.log" 2>&1 < /dev/null
sleep 1
curl -s -o /dev/null -w "app svarar %{http_code} på http://127.0.0.1:8691/#/larare\n" http://127.0.0.1:8691/
ss -ltnp | grep -E ":(8690|8691|9690)\b" | sed 's/^/  /'
