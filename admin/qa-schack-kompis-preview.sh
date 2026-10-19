#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning: schack mot en kompis (#780) i RIKTIGA appen mot emulatorerna
# (auth + firestore + functions – de riktiga callables). Två proxyer = två origins
# = två elever inloggade samtidigt i samma webbläsare.
#
#   bash admin/qa-schack-kompis-preview.sh <port1> <port2>
#   → http://127.0.0.1:<port1>/#/  logga in 4a01 (Alva) / lilla123
#   → http://127.0.0.1:<port2>/#/  logga in 4a02 (Bilal) / lilla123   (även 4a03 Cleo, 4a04 Dante)
#   Gå till Schack → Spela mot en kompis. Ctrl-C (eller `touch /tmp/qa-schack-kompis/stopp`) avslutar.
#
# Emulatorportarna slumpas (krockar inte med andra); EN emulator åt gången i epicen:
# allt körs under `flock /tmp/schack-773-emulator.lock`. Kräver firebase-CLI + Java 21
# (JAVA_BIN/FIREBASE_BIN läggs till PATH), node_modules/ i repo-roten (firebase-admin)
# och functions/node_modules/ (firebase-admin + firebase-functions).
# ============================================================================
set -euo pipefail
P1=${1:?port 1}; P2=${2:?port 2}
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx1200m}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/qa-schack-kompis
CFG="$REPO/.qa-schack-kompis.firebase.json"   # gitignorad; måste ligga i repo-roten (functions.source är relativ)
mkdir -p "$DIR"; rm -f "$DIR/stopp"
cd "$REPO"
ledig() { node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
FS=$(ledig); AU=$(ledig); FN=$(ledig); HUB=$(ledig); LOG=$(ledig); EV=$(ledig); WS=$(ledig)
node -e '
const [cfg, fs, au, fn, hub, log, ev, ws] = process.argv.slice(1);
const d = require("./firebase.json"); delete d.hosting;
for (const f of [].concat(d.functions || [])) delete f.predeploy;
d.emulators = { auth: { port: +au, host: "127.0.0.1" }, firestore: { port: +fs, host: "127.0.0.1", websocketPort: +ws },
  functions: { port: +fn, host: "127.0.0.1" }, hub: { port: +hub, host: "127.0.0.1" }, logging: { port: +log, host: "127.0.0.1" },
  eventarc: { port: +ev, host: "127.0.0.1" }, ui: { enabled: false }, singleProjectMode: true };
require("fs").writeFileSync(cfg, JSON.stringify(d, null, 1));' "$CFG" "$FS" "$AU" "$FN" "$HUB" "$LOG" "$EV" "$WS"
npm run -s sync:schack
cat > "$DIR/inne.sh" <<INNE
set -e
cd "$REPO"
export FUNCTIONS_EMULATOR_HOST=127.0.0.1:$FN
node admin/qa-larkonton-seed.mjs && node admin/qa-larkonton-roller-seed.mjs && node admin/qa-schack-kompis-seed.mjs
for P in $P1 $P2; do PORT=\$P node admin/qa-emulator-proxy.mjs > "$DIR/proxy-\$P.log" 2>&1 & done
sleep 1
echo "✓ Klart: http://127.0.0.1:$P1/#/ och http://127.0.0.1:$P2/#/ (4a01–4a04 / lilla123)"
trap 'kill \$(jobs -p) 2>/dev/null' EXIT
while [ ! -f "$DIR/stopp" ]; do sleep 1; done
INNE
exec flock /tmp/schack-773-emulator.lock firebase emulators:exec --config "$CFG" --project pluggportalen-so-2026 \
  --only auth,firestore,functions "bash $DIR/inne.sh"
