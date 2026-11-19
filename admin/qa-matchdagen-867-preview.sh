#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning: Matchdagen 1a (#867) mot EMULATORERNA (auth + firestore,
# inga functions) – inga skrivningar mot live. Proxyn körs i FÖRGRUNDEN (för
# barista_serve); emulatorn startas i bakgrunden och dödas när proxyn avslutas.
#   PORT=8867 bash admin/qa-matchdagen-867-preview.sh        # appen på 8867
#   MD_PA=1 PORT=8867 bash admin/qa-matchdagen-867-preview.sh  # Alva har Matchdagen från start
# Firestore/Auth får slumpportar (FS_PORT/AUTH_PORT kan sättas); EN emulator åt
# gången (flock /tmp/pp-emulator.lock).
# Lärare (http://127.0.0.1:$PORT/#/larare): qaadmin (admin) och qaarskurs4
# (årskurskonto 4A + 4B). Elever i 4A: 4a01 Alva, 4a02 Bilal, 4a03 Cleo, 4a04 Dante.
# Lösenord lilla123 (endast emulator).
# Kräver: Java 21 (~/.cache/pp-rig/jre eller JAVA_BIN), firebase-tools (PATH,
# FIREBASE_BIN eller natt-CLI:n) och firebase-admin (node_modules/ i repo-roten,
# t.ex. en symlänk – checka aldrig in den).
# ============================================================================
set -euo pipefail
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -d "$HOME/.cache/pp-rig/jre/bin" ] && export PATH="$HOME/.cache/pp-rig/jre/bin:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
NATT=/var/lib/barista/auth/claude/natt-pluggportalen/cli/node_modules/firebase-tools/lib/bin/firebase.js
if command -v firebase >/dev/null; then FB=(firebase); else FB=(node "$NATT"); fi
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
port() { node -e 's=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
APP_PORT=${PORT:-${APP_PORT:-8867}}
FS_PORT=${FS_PORT:-$(port)}
AUTH_PORT=${AUTH_PORT:-$(port)}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=${TMPDIR:-/tmp}/qa-matchdagen-867-$APP_PORT
CFG="$REPO/.qa-matchdagen-867-$APP_PORT.firebase.json"   # gitignorad (.qa-*.firebase.json)
mkdir -p "$DIR"
cd "$REPO"
node -e '
const [cfg, fs, auth] = process.argv.slice(1); const f = Number(fs);
const d = require("./firebase.json"); delete d.hosting; delete d.functions;
d.emulators = { auth: { port: Number(auth) }, firestore: { port: f, websocketPort: f + 1 },
  hub: { port: f + 2 }, logging: { port: f + 3 }, ui: { enabled: false }, singleProjectMode: true };
require("fs").writeFileSync(cfg, JSON.stringify(d, null, 1));' "$CFG" "$FS_PORT" "$AUTH_PORT"
# Under hög last hinner Firestore-emulatorn ibland inte öppna porten inom CLI:ts
# 60 s – då görs upp till tre försök.
exec 9>/tmp/pp-emulator.lock
flock -w 600 9 || { echo "En annan emulator kör redan (lås /tmp/pp-emulator.lock)"; exit 1; }
EMU=
trap '[ -n "$EMU" ] && kill -- -$EMU 2>/dev/null || true; rm -f "$CFG"' EXIT
for forsok in 1 2 3; do
  setsid "${FB[@]}" emulators:start --config "$CFG" --project pluggportalen-so-2026 \
    --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null &
  EMU=$!
  for _ in $(seq 1 200); do grep -qE "All emulators ready|TIMEOUT|Error:" "$DIR/emu.log" && break; sleep 1.5; done
  grep -q "All emulators ready" "$DIR/emu.log" && break
  echo "Emulatorn startade inte (försök $forsok) – se $DIR/emu.log"
  kill -- -$EMU 2>/dev/null || true; EMU=; sleep 3
done
[ -n "$EMU" ] || exit 1
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS_PORT FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH_PORT \
  GCLOUD_PROJECT=pluggportalen-so-2026
# Värm upp emulatorn (första anropet kan ta över en minut på en lastad dator).
for _ in $(seq 1 60); do curl -s -m 10 -o /dev/null "http://127.0.0.1:$FS_PORT/" && break; sleep 2; done
node admin/qa-larkonton-seed.mjs
node admin/qa-larkonton-roller-seed.mjs
node admin/qa-matchdagen-867-seed.mjs
echo "Lärare: http://127.0.0.1:$APP_PORT/#/larare/mina-klasser?flik=elever  (qaadmin / qaarskurs4, lilla123)"
echo "Elev:   http://127.0.0.1:$APP_PORT/#/  (4a01 Alva … 4a04 Dante, lilla123)"
PORT=$APP_PORT node admin/qa-emulator-proxy.mjs
