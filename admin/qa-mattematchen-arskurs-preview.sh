#!/usr/bin/env bash
# ============================================================================
# Mattematchen årskursfilter (#845) – klickbar preview mot EMULATORN.
# ----------------------------------------------------------------------------
# Startar Firestore + Auth-emulatorn på SLUMPPORTAR (grenens firestore.rules +
# index), seedar admin/qa-mattematchen-arskurs-seed.mjs och kör sedan
# admin/qa-emulator-proxy.mjs i FÖRGRUNDEN på $PORT (default 8845) – passar
# `barista_serve {command: "bash admin/qa-mattematchen-arskurs-preview.sh", port: 8845}`.
# Ctrl-C/avslut stoppar emulatorn också (trap). Skriver aldrig till produktion.
#
#   bash admin/qa-mattematchen-arskurs-preview.sh          # http://127.0.0.1:8845/
#   PORT=8900 bash admin/qa-mattematchen-arskurs-preview.sh
#
# Konton (lösenord lilla123): elev3a (3A), elev4b (4B), elevfri (Fritids),
# lärare qalarare. Elev: Hem → 🧮 Mattematchen → 🏆. Lärare: #/larare/mattematchen.
# EN emulator åt gången (flock /tmp/pp-emulator.lock) – maskinen har 11,6 GB.
# Kräver Java 11+ (JAVA_BIN) och firebase-tools (FIREBASE_JS = sökväg till
# lib/bin/firebase.js, annars `firebase` i PATH).
# ============================================================================
set -euo pipefail
PORT=${PORT:-8845}
REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO"
port() { node -e 's=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
FS=$(port); AUTH=$(port); HUB=$(port); LG=$(port)
DIR=$(mktemp -d /tmp/mm-arskurs-XXXX)
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
# setsid → egen processgrupp (firebase + java) med pgid = $! så trap dödar hela gruppen.
cd "$DIR"
setsid "${FB[@]}" emulators:start --config "$DIR/firebase.json" \
  --project pluggportalen-so-2026 --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null &
EMU=$!
cd "$REPO"
stoppa() { echo "▪ stoppar emulatorn"; kill -- -"$EMU" 2>/dev/null || true; pkill -f "firebase.json.*--only auth,firestore" 2>/dev/null || true; }
trap stoppa EXIT INT TERM
for _ in $(seq 1 90); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; tail -20 "$DIR/emu.log"; exit 1; }

echo "▶ seed…"
node admin/qa-mattematchen-arskurs-seed.mjs
echo "▶ proxy på http://127.0.0.1:$PORT/ (Ctrl-C stoppar allt; loggar i $DIR)"
PORT=$PORT node admin/qa-emulator-proxy.mjs
