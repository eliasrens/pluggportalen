#!/usr/bin/env bash
# ============================================================================
# Meteorstormen (#822, TESTAREN): hela formatet mot EMULATORERNA – functions +
# auth + firestore med grenens regler och Cloud Functions (msAgera/msRatta/
# msLage/msAvsluta), seed qa-mm-live-seed.mjs (lärare elias/rasmus, 4B b01–b20,
# 5E e01–e22 …, lösen lilla123, bara emulator) + seed/seed.mjs, och
# qa-emulator-proxy.mjs (samma origin) med Meteorstormens callables i
# vitlistan (proxyns FN_NAMES saknar dem – en kopia i $DIR används).
# Slumpade portar (delad maskin); skriver $DIR/env med portarna.
#
#   JAVA_BIN=/tmp/j742/jdk-21.0.12.1+1-jre/bin FIREBASE_BIN=/tmp/j742/ft/node_modules/.bin \
#     bash admin/qa-meteorstorm-e2e-preview.sh
#   → http://127.0.0.1:$PROXY/#/larare/live (elias / lilla123), elev b01 / lilla123
#   Driv i en egen headless chromium (CDP): lärare #u/#p på #/larare → Live → Meteorstormen;
#   elev #u/#p på #/ → #/elev/live → "Gå med"; testaren #822 körde så 2026-10-22.
#   Städa: kill $(cat $DIR/pids)
# Kräver node_modules i repo-roten (firebase-admin) och functions/node_modules
# (symlänkar, gitignorerade – se docs/METEORSTORMEN.md §9-receptet).
# ============================================================================
set -euo pipefail
R=$((20000 + RANDOM % 20000))
FS=${FS:-$R}; AUTH=${AUTH:-$((R + 1))}; FN=${FN:-$((R + 2))}; PROXY=${PROXY:-$((R + 3))}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/meteorstorm-e2e-$FS
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx512m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026
mkdir -p "$DIR"
ln -sfn "$REPO/functions" "$DIR/functions"
node "$REPO/admin/sync-guldrush-functions.mjs" > /dev/null
cat > "$DIR/firebase.json" <<EOT
{ "firestore": { "rules": "$REPO/firestore.rules", "indexes": "$REPO/firestore.indexes.json" },
  "functions": [{ "source": "functions", "codebase": "default", "runtime": "nodejs22" }],
  "emulators": { "auth": { "port": $AUTH }, "firestore": { "port": $FS, "websocketPort": $((R + 4)) },
    "functions": { "port": $FN }, "hub": { "port": $((R + 5)) }, "logging": { "port": $((R + 6)) },
    "eventarc": { "port": $((R + 7)) }, "tasks": { "port": $((R + 8)) }, "ui": { "enabled": false }, "singleProjectMode": true } }
EOT
(cd "$DIR" && setsid -f firebase emulators:start --config "$DIR/firebase.json" --project pluggportalen-so-2026 --only functions,auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null)
for _ in $(seq 1 90); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorerna startade inte – se $DIR/emu.log"; exit 1; }
cd "$REPO"
node admin/qa-mm-live-seed.mjs | tail -1
node seed/seed.mjs | tail -1
sed 's#const FN_NAMES = new Set(\[#const FN_NAMES = new Set(["/msAgera", "/msRatta", "/msLage", "/msAvsluta", #' admin/qa-emulator-proxy.mjs > "$DIR/proxy.mjs"
grep -q '"/msAgera"' "$DIR/proxy.mjs" || { echo "proxyns vitlista kunde inte utökas"; exit 1; }
(cd "$DIR" && QA_ROOT="$REPO" PORT=$PROXY FUNCTIONS_EMULATOR_HOST=127.0.0.1:$FN setsid -f node "$DIR/proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "proxy svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
pgrep -f "$DIR" > "$DIR/pids" || true
printf 'FS=%s\nAUTH=%s\nFN=%s\nPROXY=%s\nDIR=%s\n' "$FS" "$AUTH" "$FN" "$PROXY" "$DIR" > "$DIR/env"
echo "Klar: http://127.0.0.1:$PROXY/#/larare/live  (elias / lilla123; env $DIR/env)"
