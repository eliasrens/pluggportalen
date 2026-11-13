#!/usr/bin/env bash
# ============================================================================
# Mattematchen: pluggmynt på MM-sidan (#846) – klickbar preview mot EMULATORN.
# ----------------------------------------------------------------------------
# Som admin/qa-mattematchen-arskurs-preview.sh (slumpportar, grenens
# firestore.rules, EN emulator åt gången via flock), men seedar
# admin/qa-mattematchen-seed.mjs och sätter elev1:s dagsräknare
# studentData/elev1/mmMynt/{idag} till $MYNT (default 49) så taket går att se:
# ett rätt svar → 50 mynt + "Dagens mynt är intjänade…", nästa rätt → poäng
# men inget mynt. MYNT=0 ger en ren dag. Kör sedan proxyn i FÖRGRUNDEN på
# $PORT (default 8846) – passar `barista_serve {command, port: 8846}`.
#
#   bash admin/qa-mattematchen-mynt-preview.sh            # http://127.0.0.1:8846/
#   MYNT=0 PORT=8900 bash admin/qa-mattematchen-mynt-preview.sh
#
# Konto: elev1 (4A, aktiv period), lösenord lilla123. Hem → 🧮 Mattematchen.
# Saldot: studentData/elev1.coins (250 i seeden) – syns i sidomenyn efter
# sidbyte. Kräver Java 11+ (JAVA_BIN) och firebase-tools (FIREBASE_JS).
# ============================================================================
set -euo pipefail
PORT=${PORT:-8846}
MYNT=${MYNT:-49}
REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO"
port() { node -e 's=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
FS=$(port); AUTH=$(port); HUB=$(port); LG=$(port)
DIR=$(mktemp -d /tmp/mm-mynt-XXXX)
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -d "$HOME/.cache/pp-rig/jre/bin" ] && export PATH="$HOME/.cache/pp-rig/jre/bin:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx600m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026
if [ -n "${FIREBASE_JS:-}" ]; then FB=(node "$FIREBASE_JS");
elif command -v firebase >/dev/null; then FB=(firebase);
else FB=(node /var/lib/barista/auth/claude/natt-pluggportalen/cli/node_modules/firebase-tools/lib/bin/firebase.js); fi

cat > "$DIR/firebase.json" <<EOF
{ "firestore": { "rules": "$REPO/firestore.rules", "indexes": "$REPO/firestore.indexes.json" },
  "emulators": { "auth": { "host": "127.0.0.1", "port": $AUTH },
    "firestore": { "host": "127.0.0.1", "port": $FS, "websocketPort": 0 },
    "hub": { "host": "127.0.0.1", "port": $HUB }, "logging": { "host": "127.0.0.1", "port": $LG },
    "ui": { "enabled": false }, "singleProjectMode": true } }
EOF

exec 9>/tmp/pp-emulator.lock
flock -w 600 9 || { echo "En annan emulator kör redan (lås /tmp/pp-emulator.lock)"; exit 1; }
echo "▶ emulator (Firestore $FS, Auth $AUTH), logg $DIR/emu.log …"
cd "$DIR"
setsid "${FB[@]}" emulators:start --config "$DIR/firebase.json" \
  --project pluggportalen-so-2026 --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null &
EMU=$!
cd "$REPO"
stoppa() { echo "▪ stoppar emulatorn"; kill -- -"$EMU" 2>/dev/null || true; pkill -f "firebase.json.*--only auth,firestore" 2>/dev/null || true; }
trap stoppa EXIT INT TERM
for _ in $(seq 1 90); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; tail -20 "$DIR/emu.log"; exit 1; }

echo "▶ seed (elev1:s dagsräknare = $MYNT)…"
node admin/qa-mattematchen-seed.mjs
MYNT=$MYNT node --input-type=module -e '
import admin from "firebase-admin";
import { myntDag } from "./src/tavling/mm-config.js";
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(app);
const dag = myntDag(Date.now());
const n = Number(process.env.MYNT) || 0;
const ref = db.doc(`studentData/elev1/mmMynt/${dag}`);
if (n > 0) await ref.set({ dag, cid: "mm-qa-oktober", mynt: n, lastAttemptId: "seed", lastAt: admin.firestore.Timestamp.now() });
else await ref.delete();
console.log(`✓ studentData/elev1/mmMynt/${dag} = ${n}, coins = ${(await db.doc("studentData/elev1").get()).data().coins}`);
process.exit(0);
'
echo "▶ proxy på http://127.0.0.1:$PORT/ (Ctrl-C stoppar allt; loggar i $DIR)"
PORT=$PORT node admin/qa-emulator-proxy.mjs
