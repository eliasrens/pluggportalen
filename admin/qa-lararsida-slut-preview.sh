#!/usr/bin/env bash
# ============================================================================
# Slut-QA Lärarsidan (#809, epic #802) mot EMULATORERNA (auth + firestore, inga
# functions) – inga skrivningar mot live. Proxyerna körs i FÖRGRUNDEN (barista_serve);
# emulatorn dödas när skriptet avslutas.
#   bash admin/qa-lararsida-slut-preview.sh
#     efter (den här utcheckningen)        http://127.0.0.1:$APP_PORT/#/larare   (8809)
#     före  (git archive $FORE, origin/main) http://127.0.0.1:$((APP_PORT+10))/#/larare
# Båda mot SAMMA emulator och med QA_RAKNA (GET /__qa/rakna[?nollstall] = läsningar,
# skrivningar och Listen-mål per samling – så mäts Hems läsningar).
# FS/Auth-portar slumpas (FS_PORT/AUTH_PORT kan sättas). Seed: lärarkonton + roller
# + Mina klasser (10 klasser, långa områdesnamn, moduler av/på) + provet qa810 +
# admin/qa-lararsida-slut-seed.mjs (övat-datum i 4B).
# Konton (lilla123, bara emulator): qaadmin (admin), qaarskurs4 (4A, 4B), elever
# 4a01–4a04, 4b01–4b03.
# Kräver: firebase-CLI + Java 21 (JAVA_BIN/FIREBASE_BIN först på PATH om satta) och
# firebase-admin (node_modules/ i repo-roten, t.ex. en symlänk – checka aldrig in).
# Blir Firestore-emulatorn kvar efter ^C: kill på java-PID:n med --port $FS_PORT
# (ps -eo pid,args | grep '[j]ava.*--port'), inte på bash-omslaget.
# ============================================================================
set -euo pipefail
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx1200m}
APP_PORT=${APP_PORT:-8809}
FS_PORT=${FS_PORT:-$((20000 + RANDOM % 20000))}
AUTH_PORT=${AUTH_PORT:-$((FS_PORT + 7))}
FORE=${FORE:-origin/main}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=${TMPDIR:-/tmp}/qa-lararsida-slut-$APP_PORT
CFG="$REPO/.qa-lararsida-slut-$APP_PORT.firebase.json"   # gitignorad (.qa-*.firebase.json)
mkdir -p "$DIR"
cd "$REPO"
rm -rf "$DIR/fore" && mkdir -p "$DIR/fore" && git archive "$FORE" | tar -x -C "$DIR/fore"
node -e '
const [cfg, fs, auth] = process.argv.slice(1); const f = Number(fs);
const d = require("./firebase.json"); delete d.hosting; delete d.functions;
d.emulators = { auth: { port: Number(auth) }, firestore: { port: f, websocketPort: f + 1 },
  hub: { port: f + 2 }, logging: { port: f + 3 }, ui: { enabled: false }, singleProjectMode: true };
require("fs").writeFileSync(cfg, JSON.stringify(d, null, 1));' "$CFG" "$FS_PORT" "$AUTH_PORT"
EMU= PROXY=
trap '[ -n "$PROXY" ] && kill $PROXY 2>/dev/null; [ -n "$EMU" ] && kill -- -$EMU 2>/dev/null; rm -f "$CFG"; true' EXIT INT TERM HUP
setsid firebase emulators:start --config "$CFG" --project pluggportalen-so-2026 \
  --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null &
EMU=$!
for _ in $(seq 1 200); do grep -qE "All emulators ready|Error:" "$DIR/emu.log" && break; sleep 1.5; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; exit 1; }
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS_PORT FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH_PORT \
  GCLOUD_PROJECT=pluggportalen-so-2026 QA_RAKNA=1
for _ in $(seq 1 60); do curl -s -m 10 -o /dev/null "http://127.0.0.1:$FS_PORT/" && break; sleep 2; done
node admin/qa-larkonton-seed.mjs
node admin/qa-larkonton-roller-seed.mjs
node admin/qa-mina-klasser-seed.mjs
node admin/qa-prov810-seed.mjs
node admin/qa-lararsida-slut-seed.mjs
echo "FS $FS_PORT · Auth $AUTH_PORT · emulatorlogg $DIR/emu.log"
QA_ROOT="$DIR/fore" PORT=$((APP_PORT + 10)) node admin/qa-emulator-proxy.mjs > "$DIR/proxy-fore.log" 2>&1 < /dev/null &
PROXY=$!
echo "Efter: http://127.0.0.1:$APP_PORT/#/larare · Före ($FORE): http://127.0.0.1:$((APP_PORT + 10))/#/larare (qaadmin / qaarskurs4, lilla123)"
PORT=$APP_PORT node admin/qa-emulator-proxy.mjs
