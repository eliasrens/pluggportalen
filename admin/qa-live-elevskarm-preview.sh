#!/usr/bin/env bash
# ============================================================================
# Live-elevskärmen (#533) – klickbar preview mot EMULATORN.
# ----------------------------------------------------------------------------
# Firestore + Auth-emulatorn (minnesdata, grenens firestore.rules), Live-seeden
# (lärare rasmus/elias, lösen lilla123, klasser 4B/5E) + en lobby-match
# "elevskarm-demo" på 1 minut, och admin/qa-emulator-proxy.mjs på $PROXY.
# Logga in som lärare → #/larare/live?id=elevskarm-demo → "📺 Öppna elevskärm".
# Simulera elever: node admin/qa-live-seed.mjs --sim elevskarm-demo --redo 15,18 [--svar 30]
#
#   bash admin/qa-live-elevskarm-preview.sh          # FS 8533, Auth 9533, proxy 8534
# Kräver firebase-tools + Java 11+ i PATH (JAVA_BIN/FIREBASE_BIN kan peka ut dem).
# ============================================================================
set -euo pipefail
FS=${FS:-8533}
AUTH=${AUTH:-9533}
PROXY=${PROXY:-8534}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/live-es-preview-$FS
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
node admin/qa-live-seed.mjs | tail -1
node --input-type=module -e '
import admin from "firebase-admin";
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
await admin.firestore().doc("liveSessions/elevskarm-demo").set({
  name: "4B mot 5E", gameMode: "multiplication_0_10", participatingClassIds: ["4b", "5e"],
  classNames: { "4b": "4B", "5e": "5E" }, classDivisors: { "4b": 17, "5e": 22 },
  durationSeconds: 60, countdownSeconds: 4, counterShards: 10, status: "lobby",
  createdBy: "elias", createdByName: "elias", createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
console.log("✓ lobby-match elevskarm-demo (1 min)");
process.exit(0);'

echo "▶ proxy på $PROXY…"
(cd "$DIR" && PORT=$PROXY setsid -f node "$REPO/admin/qa-emulator-proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "proxy svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
echo "Klar: http://127.0.0.1:$PROXY/#/larare/live?id=elevskarm-demo  (loggar i $DIR)"
