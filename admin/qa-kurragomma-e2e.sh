#!/bin/bash
# ============================================================================
# Kurragömma (#839, TESTAREN): hela formatet mot EMULATORERNA – functions, auth,
# firestore och database (RTDB) på slumpade portar, seed qa-mm-live-seed.mjs
# (lärare elias, 3A c01–c05, lösen lilla123 – bara emulator) + seed/seed.mjs, och
# två QA-proxys (qa-emulator-proxy.mjs, QA_RAKNA) med kg*-callables vitlistade och
# globalThis.__PP_RTDB_EMULATOR insatt i firebase-config (kurragomma-data.js kanal()).
# Webbläsaren måste nå 127.0.0.1:$DB direkt (RTDB går inte via proxyn).
#   P1 = lärare/projektor (räkna projektorns Firestore-läsningar: curl $P1/__qa/rakna)
#   P2 = elever
#   FIREBASE="node …/firebase-tools/lib/bin/firebase.js" JAVA_BIN=…/jre/bin bash admin/qa-kurragomma-e2e.sh [utkatalog]
# Skriver <utkatalog>/env (portarna) och emu.log. Städa: kill PID:arna i <utkatalog>/pids.
# Driv i en egen headless chromium (CDP): lärare #username/#p på #/larare → Live → Kurragömma,
# elev #u/#p på #/ → #/elev/live?id=<sid> → "Gå med". Ladda om flikarna mellan två matcher
# (connectDatabaseEmulator får bara anropas en gång per sida – F6 i testarens rapport).
# Dumpa en match: FIRESTORE_EMULATOR_HOST=… FIREBASE_DATABASE_EMULATOR_HOST=… node admin/qa-kurragomma-dump.mjs <sid>
# ============================================================================
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
D=${1:-$(mktemp -d)}
mkdir -p "$D"
FIREBASE=${FIREBASE:-firebase}
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx1200m}
port() { node -e 's=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
FS=$(port); AU=$(port); FN=$(port); HUB=$(port); LG=$(port); DB=$(port); P1=$(port); P2=$(port)
cd "$REPO"
CFG="$REPO/.qa-kg-e2e.firebase.json"
node -e '
const c=JSON.parse(require("fs").readFileSync("firebase.json","utf8"));
const [fs,au,fn,hub,lg,db]=process.argv.slice(1,7).map(Number);
c.emulators={auth:{host:"127.0.0.1",port:au},firestore:{host:"127.0.0.1",port:fs,websocketPort:0},functions:{host:"127.0.0.1",port:fn},database:{host:"127.0.0.1",port:db},hub:{host:"127.0.0.1",port:hub},logging:{host:"127.0.0.1",port:lg},ui:{enabled:false},singleProjectMode:true};
delete c.functions[0].predeploy;
require("fs").writeFileSync(process.argv[7],JSON.stringify(c));' $FS $AU $FN $HUB $LG $DB "$CFG"
setsid -f $FIREBASE emulators:start --config "$CFG" --project pluggportalen-so-2026 --only functions,auth,firestore,database > "$D/emu.log" 2>&1 < /dev/null
for _ in $(seq 1 120); do grep -q "All emulators ready" "$D/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$D/emu.log" || { echo "Emulatorerna startade inte (portkrock?) – se $D/emu.log"; exit 1; }
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AU GCLOUD_PROJECT=pluggportalen-so-2026
node admin/qa-mm-live-seed.mjs | tail -1
node seed/seed.mjs | tail -1 || true
sed 's#const FN_NAMES = new Set(\[#const FN_NAMES = new Set(["/kgStarta", "/kgAnslut", "/kgLas", "/kgSvara", "/kgLeta", "/kgTick", "/kgAvsluta", "/kgLarareVissla", #' admin/qa-emulator-proxy.mjs \
  | sed "s#globalThis.__PP_FUNCTIONS_URL = location.origin;#globalThis.__PP_FUNCTIONS_URL = location.origin; globalThis.__PP_RTDB_EMULATOR = { host: \\\"127.0.0.1\\\", port: $DB };#" > "$REPO/admin/.qa-proxy-kg.mjs"
grep -q __PP_RTDB_EMULATOR "$REPO/admin/.qa-proxy-kg.mjs" || { echo "RTDB-injektionen misslyckades"; exit 1; }
for P in $P1 $P2; do (QA_RAKNA=1 PORT=$P FUNCTIONS_EMULATOR_HOST=127.0.0.1:$FN setsid -f node "$REPO/admin/.qa-proxy-kg.mjs" > "$D/proxy-$P.log" 2>&1 < /dev/null); done
sleep 2
pgrep -f "$CFG|qa-proxy-kg" > "$D/pids" || true
printf 'FS=%s\nAU=%s\nFN=%s\nDB=%s\nP1=%s\nP2=%s\n' $FS $AU $FN $DB $P1 $P2 | tee "$D/env"
echo "Lärare/projektor: http://127.0.0.1:$P1/#/larare/live (elias / lilla123) · elever: http://127.0.0.1:$P2/#/ (c01–c05 / lilla123)"
