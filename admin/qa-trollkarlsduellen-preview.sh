#!/usr/bin/env bash
# ============================================================================
# Trollkarlsduellen (#541, epic #535) – klickbar preview mot EMULATORN.
# ----------------------------------------------------------------------------
# Firestore + Auth-emulatorn (minnesdata, grenens firestore.rules), seeden från
# qa-mm-live-seed.mjs (lärare rasmus/elias, klasser 4B b01–b20 / 5E e01–e22,
# lösen lilla123, endast emulator) + två lobby-matcher och admin/qa-emulator-proxy.mjs på $PROXY:
#
#   trollkarl-demo   4B mot 5E, 5 min, 4B = Elias / 5E = Rasmus, nämnare 10/22
#                    (5E kan ha FLER rätt men LÄGRE snitt → snittet avgör)
#   tre-klasser      4B, 5E, 4A – Trollkarlsduellen ska INTE vara valbar
#
# Klickguide: docs/trollkarlsduellen-qa.md. Simulera elever (riktiga klient-
# skrivningar, reglerna prövar varje svar):
#   E="FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH"
#   env $E node admin/qa-mm-live-sim.mjs join trollkarl-demo 4b:10 5e:22
#   env $E node admin/qa-mm-live-sim.mjs svar trollkarl-demo 4b=103 5e=98
#
#   bash admin/qa-trollkarlsduellen-preview.sh       # FS 8541, Auth 9541, proxy 8542
# Kräver firebase-tools + Java 11+ i PATH (JAVA_BIN/FIREBASE_BIN kan peka ut dem).
# ============================================================================
set -euo pipefail
FS=${FS:-8541}
AUTH=${AUTH:-9541}
PROXY=${PROXY:-8542}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/trollkarl-preview-$FS
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026

mkdir -p "$DIR"
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
node --input-type=module -e '
import admin from "firebase-admin";
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore();
const bas = { gameMode: "multiplication_0_10", countdownSeconds: 4, counterShards: 10, status: "lobby",
  createdBy: "elias", createdByName: "elias", createdAt: admin.firestore.FieldValue.serverTimestamp() };
await db.doc("liveSessions/trollkarl-demo").set({ ...bas,
  name: "4B mot 5E", participatingClassIds: ["4b", "5e"], classNames: { "4b": "4B", "5e": "5E" },
  classDivisors: { "4b": 10, "5e": 22 }, wizards: { "4b": "elias", "5e": "rasmus" },
  durationSeconds: 300, coinPrize: 50 });
await db.doc("liveSessions/tre-klasser").set({ ...bas,
  name: "4B, 5E och 4A", participatingClassIds: ["4b", "5e", "4a"],
  classNames: { "4b": "4B", "5e": "5E", "4a": "4A" }, classDivisors: { "4b": 20, "5e": 22, "4a": 25 },
  durationSeconds: 300 });
console.log("✓ lobby-matcher trollkarl-demo (5 min) + tre-klasser");
process.exit(0);'

echo "▶ proxy på $PROXY…"
(cd "$DIR" && PORT=$PROXY setsid -f node "$REPO/admin/qa-emulator-proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "proxy svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
echo "Klar: http://127.0.0.1:$PROXY/#/larare/live?id=trollkarl-demo  (lärare elias / lilla123, loggar i $DIR)"
echo "Demoläge (ingen emulator behövs): http://127.0.0.1:$PROXY/preview/preview-trollkarlsduellen.html"
