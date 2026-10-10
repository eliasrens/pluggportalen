#!/usr/bin/env bash
# ============================================================================
# Guldrushen (#563, epic #562) – QA-preview mot EMULATORERNA (functions +
# auth + firestore) med grenens egna regler och Cloud Functions. Seed:
# qa-mm-live-seed.mjs (lärare elias/rasmus, 4B b01–b20 …, lösen lilla123,
# endast emulator) + seed/seed.mjs (Plugga-quiz) + qa-guldrush-seed.mjs (en
# hel Guldrush-match i 4B spelad genom serverkärnan → Live-historiken).
# Läraren kan skapa en Guldrush-session (speltid, stöld & byte, namn,
# Pluggmynt); elev- och projektorvyerna byggs i epicens senare issues.
#
#   JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-guldrush-preview.sh
#   → http://127.0.0.1:8569/#/larare/live  (elias / lilla123)
# ============================================================================
set -euo pipefail
FS=${FS:-8568}
AUTH=${AUTH:-9568}
FN=${FN:-5568}
PROXY=${PROXY:-8569}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/guldrush-preview-$FS
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026
mkdir -p "$DIR"
ln -sfn "$REPO/functions" "$DIR/functions"
node "$REPO/admin/sync-guldrush-functions.mjs"
cat > "$DIR/firebase.json" <<EOT
{ "firestore": { "rules": "$REPO/firestore.rules", "indexes": "$REPO/firestore.indexes.json" },
  "functions": [{ "source": "functions", "codebase": "default", "runtime": "nodejs22" }],
  "emulators": { "auth": { "port": $AUTH }, "firestore": { "port": $FS, "websocketPort": $((FS + 640)) },
    "functions": { "port": $FN }, "hub": { "port": $((FS - 4000)) }, "logging": { "port": $((FS - 3999)) },
    "eventarc": { "port": $((FS - 3998)) }, "ui": { "enabled": false }, "singleProjectMode": true } }
EOT
(cd "$DIR" && setsid -f firebase emulators:start --config "$DIR/firebase.json" --project pluggportalen-so-2026 --only functions,auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null)
for _ in $(seq 1 90); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorerna startade inte – se $DIR/emu.log"; exit 1; }
cd "$REPO"
node admin/qa-mm-live-seed.mjs | tail -1
node seed/seed.mjs | tail -1
node admin/qa-guldrush-seed.mjs
(cd "$DIR" && PORT=$PROXY FUNCTIONS_EMULATOR_HOST=127.0.0.1:$FN setsid -f node "$REPO/admin/qa-emulator-proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "proxy svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
echo "Klar: http://127.0.0.1:$PROXY/#/larare/live  (elias / lilla123; loggar i $DIR)"
