#!/usr/bin/env bash
# ============================================================================
# QA-förhandsvisning: Prov Etapp 1 (#743) mot EMULATORERNA (auth + firestore,
# inga functions) – inga skrivningar mot live.
#   bash admin/qa-prov-preview.sh   # FS 8843, Auth 9843, appen på 8743–8746
# Fyra portar = fyra origins = fyra samtidiga inloggningar i samma webbläsare
# (läraren på 8743, eleverna på 8744–8746).
# Konton (lösenord lilla123, bara emulator): qaadmin (admin), qaarskurs4 (4A, 4B),
# qaarskurs5 (5A); elever 4a01–4a04 (Alva, Bilal, Cleo, Dante), 4b01–4b03, 5a01–5a02.
# Kräver: firebase-CLI + Java 21 på PATH (JAVA_BIN/FIREBASE_BIN läggs till om satta)
# och firebase-admin (node_modules/ i repo-roten).
# ============================================================================
set -euo pipefail
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -n "${FIREBASE_BIN:-}" ] && export PATH="$FIREBASE_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx1200m}
REPO=$(cd "$(dirname "$0")/.." && pwd)
DIR=/tmp/qa-prov-preview
CFG="$REPO/.qa-prov.firebase.json"   # gitignorad
mkdir -p "$DIR"
cd "$REPO"
node -e '
const d = require("./firebase.json"); delete d.hosting; delete d.functions;
d.emulators = { auth: { port: 9843 }, firestore: { port: 8843, websocketPort: 9343 },
  hub: { port: 4843 }, logging: { port: 4844 }, ui: { enabled: false }, singleProjectMode: true };
require("fs").writeFileSync(process.argv[1], JSON.stringify(d, null, 1));' "$CFG"
setsid -f firebase emulators:start --config "$CFG" --project pluggportalen-so-2026 \
  --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null
for _ in $(seq 1 60); do grep -q "All emulators ready" "$DIR/emu.log" && break; sleep 1.5; done
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8843 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9843 \
  GCLOUD_PROJECT=pluggportalen-so-2026
node admin/qa-larkonton-seed.mjs
node admin/qa-larkonton-roller-seed.mjs
for P in 8743 8744 8745 8746; do
  QA_RAKNA=1 PORT=$P setsid -f node admin/qa-emulator-proxy.mjs > "$DIR/proxy-$P.log" 2>&1 < /dev/null
done
sleep 1
curl -s -o /dev/null -w "app svarar %{http_code} på http://127.0.0.1:8743/#/larare\n" http://127.0.0.1:8743/
ss -ltnp | grep -E ":(874[3-6]|8843|9843)\b" | sed 's/^/  /'
