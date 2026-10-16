#!/usr/bin/env bash
# ============================================================================
# Bråkresan – klickbar preview mot EMULATORN (#709, epic #705).
# ----------------------------------------------------------------------------
# Startar Auth + Firestore + FUNCTIONS (grenens firestore.rules och
# functions/ med brakresa*-callables), seedar QA-klassen (qa-lasresan-seed:
# elev1 m.fl.) och startar admin/qa-emulator-proxy.mjs, så den RIKTIGA kedjan
# generering → svar → hjälp → bedömning → stjärna/mynt körs i servern:
#   http://127.0.0.1:$PROXY/#/elev/brakresan?u=03   (elev1 / lilla123)
#   …?u=03&lage=test                               testomgång utan server
#
#   bash admin/qa-brakresan-preview.sh               # FS 8719, Auth 9719, Fn 5719, proxy 8711
# Kräver firebase-tools + Java 11+ i PATH och functions/node_modules
# (npm --prefix functions install). Stoppa: döda PID:erna som skrivs ut sist.
# ============================================================================
set -euo pipefail
FS=${FS:-8719}
AUTH=${AUTH:-9719}
FN=${FN:-5719}
PROXY=${PROXY:-8711}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/brak-preview-$FS
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH FUNCTIONS_EMULATOR_HOST=127.0.0.1:$FN
export GCLOUD_PROJECT=pluggportalen-so-2026

node "$REPO/admin/sync-brakresan-functions.mjs"
mkdir -p "$DIR"
# Functions-källan måste vara RELATIV till config-filen → configen ligger i repot (.gitignore: .qa-*.firebase.json).
CONF="$REPO/.qa-brakresan-$FS.firebase.json"
cat > "$CONF" <<JSON
{ "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "functions": [{ "source": "functions", "codebase": "default", "runtime": "nodejs22" }],
  "emulators": { "auth": { "port": $AUTH }, "firestore": { "port": $FS, "websocketPort": $((FS + 640)) },
    "functions": { "port": $FN }, "hub": { "port": $((FS - 4000)) }, "logging": { "port": $((FS - 3999)) },
    "eventarc": { "port": $((FN + 1)) }, "tasks": { "port": $((FN + 2)) },
    "ui": { "enabled": false }, "singleProjectMode": true } }
JSON

echo "▶ emulator (Firestore $FS, Auth $AUTH, Functions $FN)…"
(cd "$REPO" && setsid -f firebase emulators:start --config "$CONF" \
  --project pluggportalen-so-2026 --only auth,firestore,functions > "$DIR/emu.log" 2>&1 < /dev/null)
for _ in $(seq 1 120); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; exit 1; }

cd "$REPO"
echo "▶ seed…"
node admin/qa-lasresan-seed.mjs | tail -1

echo "▶ proxy på $PROXY…"
(cd "$DIR" && PORT=$PROXY setsid -f node "$REPO/admin/qa-emulator-proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "proxy svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
echo "Klar: http://127.0.0.1:$PROXY/#/elev/brakresan  (elev1 / lilla123, endast emulator, loggar i $DIR)"
ss -ltnp 2>/dev/null | grep -E ":($FS|$AUTH|$FN|$PROXY) " || true   # ← PID:er att döda
