#!/usr/bin/env bash
# ============================================================================
# Snilleblixten (#556, epic #555) – QA-preview mot EMULATORN med grenens
# egna regler. Läraren skapar en Snilleblixt-session i den riktiga appen
# (ögonblicksbilden skrivs i samma batch; projektor-/elevvyerna byggs i
# #558/#559). Seed: qa-mm-live-seed.mjs (lärare rasmus/elias, 4B, 5E …,
# lösen lilla123, endast emulator) + seed/seed.mjs (Plugga-ämnen med quiz).
#
#   JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-snilleblixt-preview.sh
#   → http://127.0.0.1:8565/#/larare/live  (elias / lilla123)
# ============================================================================
set -euo pipefail
FS=${FS:-8564}
AUTH=${AUTH:-9564}
PROXY=${PROXY:-8565}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/snilleblixt-preview-$FS
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026
mkdir -p "$DIR"
cat > "$DIR/firebase.json" <<EOF
{ "firestore": { "rules": "$REPO/firestore.rules", "indexes": "$REPO/firestore.indexes.json" },
  "emulators": { "auth": { "port": $AUTH }, "firestore": { "port": $FS, "websocketPort": $((FS + 640)) },
    "hub": { "port": $((FS - 4000)) }, "logging": { "port": $((FS - 3999)) }, "eventarc": { "port": $((FS - 3998)) },
    "ui": { "enabled": false }, "singleProjectMode": true } }
EOF
(cd "$DIR" && setsid -f firebase emulators:start --config "$DIR/firebase.json" --project pluggportalen-so-2026 --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null)
for _ in $(seq 1 60); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; exit 1; }
cd "$REPO"
node admin/qa-mm-live-seed.mjs | tail -1
node seed/seed.mjs | tail -1
(cd "$DIR" && PORT=$PROXY setsid -f node "$REPO/admin/qa-emulator-proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "proxy svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
echo "Klar: http://127.0.0.1:$PROXY/#/larare/live  (elias / lilla123; loggar i $DIR)"
