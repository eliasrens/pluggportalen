#!/usr/bin/env bash
# ============================================================================
# Klasscentret – klickbar preview mot EMULATORN (#502, epic #473).
# ----------------------------------------------------------------------------
# Startar Firestore + Auth-emulatorn (minnesdata, grenens firestore.rules),
# seedar hela Klasscentret-scenariot (docs/preview-klasscentret.md) och
# startar admin/qa-emulator-proxy.mjs så appen nås på http://127.0.0.1:$PROXY/.
# Skriver aldrig till produktion (seedskripten vägrar utan emulator-variablerna).
#
#   bash admin/qa-klasscentret-preview.sh            # FS 8520, Auth 9520, proxy 8521
#   FS=8600 AUTH=9600 PROXY=8601 bash admin/qa-klasscentret-preview.sh
#
# Stoppa: pkill -f "qa-emulator-proxy.mjs" ; pkill -f "kc-preview-$FS"
# (eller döda processerna som skrivs ut sist).
# Kräver firebase-tools + Java 11+ i PATH (JAVA_BIN/FIREBASE_BIN kan peka ut dem).
# ============================================================================
set -euo pipefail
FS=${FS:-8520}
AUTH=${AUTH:-9520}
PROXY=${PROXY:-8521}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/kc-preview-$FS
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
node admin/qa-klasscenter-by-seed.mjs | tail -1
node admin/qa-klasscenter-rum-seed.mjs | tail -1
node admin/qa-klasscenter-larare-seed.mjs | tail -1
node admin/qa-klasscentrum-shop.mjs seed | tail -1
node admin/qa-mattematchen-seed.mjs | tail -1
node admin/qa-mattematchen-larare-seed.mjs | tail -1
node admin/qa-live-seed.mjs | tail -1
# Statistiktavlans "lösta uppgifter" (classProjections.members.plays) för qa-kc: 10·i per elev.
node --input-type=module -e '
import admin from "firebase-admin";
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const m = {};
for (let i = 1; i <= 14; i++) m["kc" + String(i).padStart(2, "0")] = { plays: 10 * i };
await admin.firestore().doc("classProjections/qa-kc").set({ members: m }, { merge: true });
console.log("✓ qa-kc: lösta uppgifter 1 050 på statistiktavlan");
process.exit(0);'

echo "▶ proxy på $PROXY…"
(cd "$DIR" && PORT=$PROXY setsid -f node "$REPO/admin/qa-emulator-proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "proxy svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
echo "Klar: http://127.0.0.1:$PROXY/  (guide: docs/preview-klasscentret.md, loggar i $DIR)"
