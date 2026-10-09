#!/usr/bin/env bash
# ============================================================================
# Live svarssätt (#554, epic #550) – QA-preview mot EMULATORN med ett
# TEST-FORMAT i registret.
# ----------------------------------------------------------------------------
# Snilleblixten/Guldrushen byggs i nästa epics, så bara Klassmatchen finns och
# den stöder bara "free". För att pröva svarssättsvalet i den RIKTIGA appen
# kör den här en kopia av grenen (git archive HEAD → $DIR/app) där
# Klassmatchen fått answerKinds ["free", "choice"] – det spec §4 kallar "kan
# slås på där senare". Repot ändras INTE. Reglerna är grenens egna (format-
# vitlistan släpper bara "klassmatch", så ett påhittat format-id går inte).
#
#   proxy $PROXY (=8555)  testformatet: Skriv själv / Flerval visas (3b), quiz
#                         från Plugga erbjuds bara som flerval (3c)
#   proxy $PROXY_MAIN (=8556)  grenen orörd – Klassmatchen som i dag (test 2)
#
# Seed: qa-mm-live-seed.mjs (lärare rasmus/elias, 4B b01–b20, 5E e01–e22,
# lösen lilla123, endast emulator) + seed/seed.mjs (Plugga-ämnen med quiz).
#
#   JAVA_BIN=… FIREBASE_BIN=… bash admin/qa-live-svarssatt-preview.sh
# ============================================================================
set -euo pipefail
FS=${FS:-8554}
AUTH=${AUTH:-9554}
PROXY=${PROXY:-8555}
PROXY_MAIN=${PROXY_MAIN:-8556}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/svarssatt-preview-$FS
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026

mkdir -p "$DIR"
rm -rf "$DIR/app" && mkdir -p "$DIR/app"
git -C "$REPO" archive HEAD | tar -x -C "$DIR/app"
ln -sfn "$REPO/node_modules" "$DIR/app/node_modules"
KM="$DIR/app/src/live/formats/klassmatch/index.js"
grep -q 'answerKinds: \["free"\],' "$KM" || { echo "Hittar inte answerKinds i $KM"; exit 1; }
sed -i 's/answerKinds: \["free"\],/answerKinds: ["free", "choice"], \/\/ QA #554: testformat/' "$KM"

cat > "$DIR/firebase.json" <<EOF
{ "firestore": { "rules": "$REPO/firestore.rules", "indexes": "$REPO/firestore.indexes.json" },
  "emulators": { "auth": { "port": $AUTH }, "firestore": { "port": $FS, "websocketPort": $((FS + 640)) },
    "hub": { "port": $((FS - 4000)) }, "logging": { "port": $((FS - 3999)) }, "eventarc": { "port": $((FS - 3998)) },
    "ui": { "enabled": false }, "singleProjectMode": true } }
EOF

echo "▶ emulator (Firestore $FS, Auth $AUTH)…"
(cd "$DIR" && setsid -f firebase emulators:start --config "$DIR/firebase.json" \
  --project pluggportalen-so-2026 --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null)
for _ in $(seq 1 60); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; exit 1; }

cd "$REPO"
echo "▶ seed…"
node admin/qa-mm-live-seed.mjs | tail -1
node seed/seed.mjs | tail -1

echo "▶ proxys på $PROXY (testformat) och $PROXY_MAIN (orörd)…"
(cd "$DIR" && PORT=$PROXY setsid -f node "$DIR/app/admin/qa-emulator-proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
(cd "$DIR" && PORT=$PROXY_MAIN setsid -f node "$REPO/admin/qa-emulator-proxy.mjs" > "$DIR/proxy-main.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "testformat svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
curl -s -o /dev/null -w "orörd svarar %{http_code}\n" "http://127.0.0.1:$PROXY_MAIN/"
echo "Klar: http://127.0.0.1:$PROXY/#/larare/live  (elias / lilla123; loggar i $DIR)"
