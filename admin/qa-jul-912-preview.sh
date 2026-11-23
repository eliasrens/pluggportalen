#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning (#912): 🎄 Jul-djuren mot EMULATORERNA
# functions,auth,firestore (butikKop via proxyn). Slumpportar, grenens regler och
# functions, EN emulator åt gången (flock /tmp/pp-emulator.lock). Proxyn i
# FÖRGRUNDEN på $PORT (default 8912).
#
#   PORT=8912 bash admin/qa-jul-912-preview.sh
#
# Elev 4a01 Alva (lilla123): 6 000 mynt, 30 äpplen, ett kläckklart julklappsägg (Renis); Jul på
# (admin/qa-jul-912-seed.mjs). Kopia av qa-jul-910-preview.sh.
# ============================================================================
set -euo pipefail
PORT=${PORT:-8912}
REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO"
port() { node -e 's=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
FS=$(port); AUTH=$(port); FN=$(port); HUB=$(port); LG=$(port)
DIR=$(mktemp -d /tmp/md-912-XXXX)
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -d "$HOME/.cache/pp-rig/jre/bin" ] && export PATH="$HOME/.cache/pp-rig/jre/bin:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx700m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH FUNCTIONS_EMULATOR_HOST=127.0.0.1:$FN GCLOUD_PROJECT=pluggportalen-so-2026
if [ -n "${FIREBASE_JS:-}" ]; then FB=(node "$FIREBASE_JS");
elif command -v firebase >/dev/null; then FB=(firebase);
else FB=(node /var/lib/barista/auth/claude/natt-pluggportalen/cli/node_modules/firebase-tools/lib/bin/firebase.js); fi

# Konfigen i repo-roten (functions.source är relativ); .qa-*.firebase.json är gitignorerad.
CFG=$(mktemp -p "$REPO" .qa-912-XXXX.firebase.json)
node -e '
const c = JSON.parse(require("fs").readFileSync("firebase.json", "utf8"));
const [fs, au, fn, hub, lg] = process.argv.slice(1).map(Number);
c.emulators = { auth: { host: "127.0.0.1", port: au }, firestore: { host: "127.0.0.1", port: fs, websocketPort: 0 },
  functions: { host: "127.0.0.1", port: fn }, hub: { host: "127.0.0.1", port: hub }, logging: { host: "127.0.0.1", port: lg },
  ui: { enabled: false }, singleProjectMode: true };
for (const f of [].concat(c.functions || [])) delete f.predeploy;
require("fs").writeFileSync(process.argv[6], JSON.stringify(c));' $FS $AUTH $FN $HUB $LG "$CFG"

exec 9>/tmp/pp-emulator.lock
flock -w 1200 9 || { echo "En annan emulator kör redan (lås /tmp/pp-emulator.lock)"; rm -f "$CFG"; exit 1; }
echo "▶ emulator (Firestore $FS, Auth $AUTH, Functions $FN), logg $DIR/emu.log …"
setsid "${FB[@]}" emulators:start --config "$CFG" \
  --project pluggportalen-so-2026 --only functions,auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null &
EMU=$!
stoppa() { echo "▪ stoppar emulatorn"; kill -- -"$EMU" 2>/dev/null || true; rm -f "$CFG"; }
trap stoppa EXIT INT TERM
for _ in $(seq 1 150); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; tail -20 "$DIR/emu.log"; exit 1; }

echo "▶ seed…"
node admin/qa-larkonton-seed.mjs
node admin/qa-larkonton-roller-seed.mjs
node admin/qa-jul-912-seed.mjs
echo "▶ proxy på http://127.0.0.1:$PORT/ (Ctrl-C stoppar allt; loggar i $DIR)"
echo "FS=$FIRESTORE_EMULATOR_HOST AUTH=$FIREBASE_AUTH_EMULATOR_HOST FN=$FUNCTIONS_EMULATOR_HOST" | tee "$DIR/portar.txt"
PORT=$PORT node admin/qa-emulator-proxy.mjs
