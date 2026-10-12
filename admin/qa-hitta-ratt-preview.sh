#!/usr/bin/env bash
# ============================================================================
# Hitta rätt! – klickbar preview mot EMULATORN (#605, epic #603).
# ----------------------------------------------------------------------------
# Startar Firestore + Auth-emulatorn (minnesdata, grenens firestore.rules),
# seedar QA-klassen (qa-lasresan-seed: lärare qalarare, elev elev1 m.fl.) och startar
# admin/qa-emulator-proxy.mjs så appen nås på http://127.0.0.1:$PROXY/.
# Test 7: läraren kryssar i/ur Hitta rätt! under Synliga moduler; elev1 ser/ser inte modulen. Skriver aldrig till produktion.
# #609: även Functions-emulatorn (hittaRattSubmit) + qa-hitta-ratt-topplista-seed.mjs
# (40 elever som spelat via serverkärnan, Hitta rätt! PÅ för qa-klass) →
# elev1 / lilla123 → 🏆 Topplistor: test 3, 5, 6, 10.
# #610: + qa-hitta-ratt-pokal-seed.mjs → elev1:s rum (#/elev/rum) har en utställd
# Kartmästare-pokal, en i Möbler-lådan och en tappad (ska vara borta); Sagas rum
# (#/elev/klasskamrat?id=hr-elev05) visar hennes. Ledarbyte live: … pokal-seed.mjs --byt
#
#   bash admin/qa-hitta-ratt-preview.sh          # FS 8605, Auth 9605, Functions 5605, proxy 8606
#   FS=8600 AUTH=9600 FN=5600 PROXY=8601 bash admin/qa-hitta-ratt-preview.sh
#
# Stoppa: döda PID:erna som skrivs ut sist (inte via `pkill -f` på namnet – det
# träffar andra previews och det egna skalet).
# Kräver firebase-tools + Java 11+ i PATH (JAVA_BIN/FIREBASE_BIN kan peka ut dem).
# ============================================================================
set -euo pipefail
FS=${FS:-8605}
AUTH=${AUTH:-9605}
FN=${FN:-5605}
PROXY=${PROXY:-8606}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/hr-preview-$FS
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026

mkdir -p "$DIR"
ln -sfn "$REPO/functions" "$DIR/functions"
node "$REPO/admin/sync-hitta-ratt-functions.mjs"
cat > "$DIR/firebase.json" <<JSON
{ "firestore": { "rules": "$REPO/firestore.rules", "indexes": "$REPO/firestore.indexes.json" },
  "functions": [{ "source": "functions", "codebase": "default", "runtime": "nodejs22" }],
  "emulators": { "auth": { "port": $AUTH }, "firestore": { "port": $FS, "websocketPort": $((FS + 640)) },
    "functions": { "port": $FN },
    "hub": { "port": $((FS - 4000)) }, "logging": { "port": $((FS - 3999)) }, "eventarc": { "port": $((FS - 3998)) },
    "ui": { "enabled": false }, "singleProjectMode": true } }
JSON

echo "▶ emulator (Firestore $FS, Auth $AUTH, Functions $FN)…"
(cd "$DIR" && setsid -f firebase emulators:start --config "$DIR/firebase.json" \
  --project pluggportalen-so-2026 --only functions,auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null)
for _ in $(seq 1 90); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; exit 1; }

cd "$REPO"
echo "▶ seed…"
node admin/qa-lasresan-seed.mjs | tail -1
node admin/qa-hitta-ratt-topplista-seed.mjs
node admin/qa-hitta-ratt-pokal-seed.mjs

echo "▶ proxy på $PROXY…"
(cd "$DIR" && PORT=$PROXY FUNCTIONS_EMULATOR_HOST=127.0.0.1:$FN setsid -f node "$REPO/admin/qa-emulator-proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "proxy svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
echo "Klar: http://127.0.0.1:$PROXY/  (lärare qalarare / lilla123, endast emulator, loggar i $DIR)"
ss -ltnp 2>/dev/null | grep -E ":($FS|$AUTH|$FN|$PROXY) " || true   # ← PID:er att döda
