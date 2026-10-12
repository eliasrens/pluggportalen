#!/usr/bin/env bash
# ============================================================================
# Ekvationsresan – klickbar preview mot EMULATORN (#618, epic #614).
# ----------------------------------------------------------------------------
# Startar Firestore + Auth-emulatorn (minnesdata, grenens firestore.rules),
# seedar QA-klassen (qa-lasresan-seed + qa-ekvationsresan-seed) och startar
# admin/qa-emulator-proxy.mjs så appen nås på http://127.0.0.1:$PROXY/.
#   elev1 / lilla123   qa-klass, Ekvationsresan PÅ (test 22, 26, 27, nivå 1 → 2)
#   ekv-av / lilla123  qa-klass-av, Ekvationsresan AV (test 23)
#   qalarare / lilla123  läraren (Synliga moduler)
#
#   bash admin/qa-ekvationsresan-preview.sh       # FS 8618, Auth 9618, proxy 8619
#   FS=8600 AUTH=9600 PROXY=8601 bash admin/qa-ekvationsresan-preview.sh
#
# Stoppa: döda PID:erna som skrivs ut sist (inte `pkill -f` på namnet).
# Kräver firebase-tools + Java 11+ i PATH (JAVA_BIN/FIREBASE_BIN kan peka ut dem).
# ============================================================================
set -euo pipefail
FS=${FS:-8618}
AUTH=${AUTH:-9618}
PROXY=${PROXY:-8619}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/ekv-preview-$FS
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026

mkdir -p "$DIR"
cat > "$DIR/firebase.json" <<JSON
{ "firestore": { "rules": "$REPO/firestore.rules", "indexes": "$REPO/firestore.indexes.json" },
  "emulators": { "auth": { "port": $AUTH }, "firestore": { "port": $FS, "websocketPort": $((FS + 640)) },
    "hub": { "port": $((FS - 4000)) }, "logging": { "port": $((FS - 3999)) },
    "ui": { "enabled": false }, "singleProjectMode": true } }
JSON

echo "▶ emulator (Firestore $FS, Auth $AUTH)…"
(cd "$DIR" && setsid -f firebase emulators:start --config "$DIR/firebase.json" \
  --project pluggportalen-so-2026 --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null)
for _ in $(seq 1 90); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; exit 1; }

cd "$REPO"
echo "▶ seed…"
node admin/qa-lasresan-seed.mjs | tail -1
node admin/qa-ekvationsresan-seed.mjs --larare   # + lärarvyns elever (#619)

echo "▶ proxy på $PROXY…"
(cd "$DIR" && PORT=$PROXY setsid -f node "$REPO/admin/qa-emulator-proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "proxy svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
echo "Klar: http://127.0.0.1:$PROXY/  (elev1 / lilla123, endast emulator, loggar i $DIR)"
ss -ltnp 2>/dev/null | grep -E ":($FS|$AUTH|$PROXY) " || true   # ← PID:er att döda
