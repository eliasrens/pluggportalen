#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning: Mina klasser (#804) mot EMULATORERNA (auth + firestore,
# inga functions) – inga skrivningar mot live. Proxyn körs i FÖRGRUNDEN (för
# barista_serve); emulatorn startas i bakgrunden och dödas när proxyn avslutas.
#   bash admin/qa-mina-klasser-preview.sh     # app 8804, FS 8824, Auth 9824
# Portar kan ändras: APP_PORT, FS_PORT, AUTH_PORT (ws/hub/logg = FS_PORT+1/+2/+3).
# Logga in på http://127.0.0.1:8804/#/larare som
#   qaadmin    (admin, 10 klasser → sökbar rullgardin)
#   qaarskurs4 (årskurslärare, 4A + 4B → klassknappar)
# lösenord lilla123 (endast emulator).
# Kräver: firebase-CLI + Java 21 (JAVA_BIN/FIREBASE_BIN läggs först på PATH om
# satta) och firebase-admin (node_modules/ i repo-roten, t.ex. en symlänk –
# checka aldrig in den).
# ============================================================================
set -euo pipefail
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
APP_PORT=${APP_PORT:-8804}
FS_PORT=${FS_PORT:-8824}
AUTH_PORT=${AUTH_PORT:-9824}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=${TMPDIR:-/tmp}/qa-mina-klasser-$APP_PORT
CFG="$REPO/.qa-mina-klasser-$APP_PORT.firebase.json"   # gitignorad (.qa-*.firebase.json)
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
EMU=
trap '[ -n "$EMU" ] && kill -- -$EMU 2>/dev/null || true' EXIT
for forsok in 1 2 3; do
  setsid firebase emulators:start --config "$CFG" --project pluggportalen-so-2026 \
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
node admin/qa-larkonton-seed.mjs
node admin/qa-larkonton-roller-seed.mjs
node admin/qa-mina-klasser-seed.mjs
echo "Mina klasser: http://127.0.0.1:$APP_PORT/#/larare/mina-klasser  (qaadmin / qaarskurs4, lilla123)"
PORT=$APP_PORT node admin/qa-emulator-proxy.mjs
