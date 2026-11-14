#!/usr/bin/env bash
# ============================================================================
# Mattematchen: Live räknas in (#847) – klickbar preview mot EMULATORN.
# ----------------------------------------------------------------------------
# Som admin/qa-mattematchen-mynt-preview.sh (slumpportar, grenens
# firestore.rules, EN emulator åt gången via flock): seedar
# admin/qa-mattematchen-seed.mjs (elev1 i 4A, aktiv Mattematch för 4A/4B/5E,
# elev1 = 40 rätt) och en PÅGÅENDE Klassmatch "4A mot 4B" i multiplikation
# (liveSessions/qa-live-847, 30 min). Kör sedan proxyn i FÖRGRUNDEN på $PORT
# (default 8847) – passar `barista_serve {command, port: 8847}`.
#
#   bash admin/qa-mattematchen-live-preview.sh        # http://127.0.0.1:8847/
#
# Konto: elev1 / lilla123. Live → Gå med → svara rätt några gånger → 🧮
# Mattematchen → 📊/🏆: elev1:s poäng har stigit (40 → 40 + antal rätt).
# Kräver Java 11+ (JAVA_BIN) och firebase-tools (FIREBASE_JS).
# ============================================================================
set -euo pipefail
PORT=${PORT:-8847}
REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO"
port() { node -e 's=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
FS=$(port); AUTH=$(port); HUB=$(port); LG=$(port)
DIR=$(mktemp -d /tmp/mm-live-XXXX)
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

echo "▶ seed (Mattematchen + pågående Klassmatch 4A mot 4B)…"
node admin/qa-mattematchen-seed.mjs
node --input-type=module -e '
import admin from "firebase-admin";
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(app);
const { Timestamp } = admin.firestore;
const nu = Date.now();
const sid = "qa-live-847";
for (const sub of ["players", "answers", "counters"]) {
  const s = await db.collection(`liveSessions/${sid}/${sub}`).get();
  await Promise.all(s.docs.map((d) => d.ref.delete()));
}
await db.doc(`liveSessions/${sid}`).set({
  name: "4A mot 4B", format: "klassmatch", gameMode: "multiplication_0_10", answerKind: "free",
  participatingClassIds: ["mm-4a", "mm-4b"], classNames: { "mm-4a": "4A", "mm-4b": "4B" },
  classDivisors: { "mm-4a": 60, "mm-4b": 20 }, durationSeconds: 1800, countdownSeconds: 0, counterShards: 10,
  status: "live", createdBy: "qalarare", createdAt: Timestamp.fromMillis(nu - 60_000),
  startedAt: Timestamp.fromMillis(nu - 5_000), endsAt: Timestamp.fromMillis(nu - 5_000 + 1_800_000),
});
console.log(`✓ liveSessions/${sid} pågår 30 min (4A mot 4B, multiplikation)`);
process.exit(0);
'
echo "▶ proxy på http://127.0.0.1:$PORT/ (Ctrl-C stoppar allt; loggar i $DIR)"
PORT=$PORT node admin/qa-emulator-proxy.mjs
