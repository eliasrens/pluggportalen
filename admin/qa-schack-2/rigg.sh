#!/usr/bin/env bash
# ============================================================================
# Schack slut-QA Etapp 2 (#782): riktiga appen mot EN emulator (auth + firestore +
# functions) med en räknande proxy (QA_RAKNA=1) PER användare – egen origin = egen
# inloggning och egna läs-/skrivräknare (Alva, Bilal, läraren, Cleo, Ebba …).
#
#   bash admin/qa-schack-2/rigg.sh <port1> <port2> … 
#   → /tmp/qa-schack-2/env  (FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST, FUNCTIONS_EMULATOR_HOST)
#   → /tmp/qa-schack-2/klar när seeds och proxyer är uppe;  touch /tmp/qa-schack-2/stopp avslutar.
# Seeds: qa-larkonton(-roller) + qa-schack-kompis-seed (4A/4B schack på; 4a01–4a04, 4b01–4b03,
# qaarskurs4 = lärare för 4A+4B, lösenord lilla123). Under flock /tmp/schack-773-emulator.lock.
# Kräver JAVA_BIN/FIREBASE_BIN (eller på PATH), node_modules/ och functions/node_modules/.
# ============================================================================
set -euo pipefail
[ $# -ge 1 ] || { echo "ange minst en proxyport"; exit 2; }
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx1200m}
REPO=$(cd "$(dirname "$0")/../.." && pwd)
DIR=/tmp/qa-schack-2
CFG="$REPO/.qa-schack-2.firebase.json"   # gitignorad (.qa-*.firebase.json); functions.source är relativ → repo-roten
mkdir -p "$DIR"; rm -f "$DIR/stopp" "$DIR/klar"
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
printf 'export FIRESTORE_EMULATOR_HOST=127.0.0.1:%s\nexport FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:%s\nexport FUNCTIONS_EMULATOR_HOST=127.0.0.1:%s\n' "$FS" "$AU" "$FN" > "$DIR/env"
cat > "$DIR/inne.sh" <<INNE
set -e
cd "$REPO"
export FUNCTIONS_EMULATOR_HOST=127.0.0.1:$FN
node admin/qa-larkonton-seed.mjs && node admin/qa-larkonton-roller-seed.mjs && node admin/qa-schack-kompis-seed.mjs
for P in $*; do QA_RAKNA=1 PORT=\$P node admin/qa-emulator-proxy.mjs > "$DIR/proxy-\$P.log" 2>&1 & done
sleep 1
touch "$DIR/klar"
echo "✓ Klart: proxyer på $* (4a01–4a04, 4b01–4b03, qaarskurs4 / lilla123)"
trap 'kill \$(jobs -p) 2>/dev/null' EXIT
while [ ! -f "$DIR/stopp" ]; do sleep 1; done
INNE
trap 'rm -f "$CFG"' EXIT
flock /tmp/schack-773-emulator.lock firebase emulators:exec --config "$CFG" --project pluggportalen-so-2026 \
  --only auth,firestore,functions "bash $DIR/inne.sh"
