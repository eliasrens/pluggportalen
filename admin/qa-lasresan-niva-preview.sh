#!/usr/bin/env bash
# ============================================================================
# Läsresans nivåstyrning – klickbar preview mot EMULATORN (#506, epic #482).
# ----------------------------------------------------------------------------
# Startar Firestore + Auth-emulatorn (minnesdata, grenens firestore.rules),
# seedar Läsresan-klassen (qa-lasresan-seed + qa-lasresan-niva-seed) och startar
# admin/qa-emulator-proxy.mjs så appen nås på http://127.0.0.1:$PROXY/.
# Klickguide: docs/preview-lasresan-niva.md. Skriver aldrig till produktion.
#
#   bash admin/qa-lasresan-niva-preview.sh          # FS 8506, Auth 9506, proxy 8507
#   FS=8600 AUTH=9600 PROXY=8601 bash admin/qa-lasresan-niva-preview.sh
#
# Stoppa: döda PID:erna som skrivs ut sist (inte via `pkill -f` på namnet – det
# träffar andra previews och det egna skalet).
# Kräver firebase-tools + Java 11+ i PATH (JAVA_BIN/FIREBASE_BIN kan peka ut dem).
# ============================================================================
set -euo pipefail
FS=${FS:-8506}
AUTH=${AUTH:-9506}
PROXY=${PROXY:-8507}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/lr-niva-preview-$FS
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx384m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026

mkdir -p "$DIR"
cat > "$DIR/firebase.json" <<JSON
{ "firestore": { "rules": "$REPO/firestore.rules", "indexes": "$REPO/firestore.indexes.json" },
  "emulators": { "auth": { "port": $AUTH }, "firestore": { "port": $FS, "websocketPort": $((FS + 640)) },
    "hub": { "port": $((FS - 4000)) }, "logging": { "port": $((FS - 3999)) }, "eventarc": { "port": $((FS - 3998)) },
    "ui": { "enabled": false }, "singleProjectMode": true } }
JSON

echo "▶ emulator (Firestore $FS, Auth $AUTH)…"
(cd "$DIR" && setsid -f firebase emulators:start --config "$DIR/firebase.json" \
  --project pluggportalen-so-2026 --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null)
for _ in $(seq 1 60); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; exit 1; }

cd "$REPO"
echo "▶ seed…"
node admin/qa-lasresan-seed.mjs | tail -1
node admin/qa-lasresan-niva-seed.mjs | tail -1

echo "▶ proxy på $PROXY…"
(cd "$DIR" && PORT=$PROXY setsid -f node "$REPO/admin/qa-emulator-proxy.mjs" > "$DIR/proxy.log" 2>&1 < /dev/null)
sleep 2
curl -s -o /dev/null -w "proxy svarar %{http_code}\n" "http://127.0.0.1:$PROXY/"
echo "Klar: http://127.0.0.1:$PROXY/  (lärare qalarare / lilla123, endast emulator, guide docs/preview-lasresan-niva.md, loggar i $DIR)"
ss -ltnp 2>/dev/null | grep -E ":($FS|$AUTH|$PROXY) " || true   # ← PID:er att döda
