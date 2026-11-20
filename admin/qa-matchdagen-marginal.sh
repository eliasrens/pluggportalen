#!/usr/bin/env bash
# ============================================================================
# Rigg #873 (efter #867:s): kör node --test $MDTEST med emulators:exec (bara firestore)
# på SLUMPPORTAR i stället för
# firebase.json:s fasta – flera checkouts delar nätverket. EN emulator åt
# gången (flock /tmp/pp-emulator.lock, samma lås som förhandsvisningen).
#   MDTEST="test/firestore-rules-matchdagen*.test.js" bash admin/qa-matchdagen-marginal.sh   (regeltesterna)
#   MDTEST=admin/qa-matchdagen-marginal.test.js bash admin/qa-matchdagen-marginal.sh  (marginalen, #873;
#     SCEN=legend,skapa  NLIST=0,2,4,…  VAR=varianter.json  RULES_FIL=…)
# Kräver Java 21 (~/.cache/pp-rig/jre) och firebase-tools (PATH eller natt-CLI:n).
# ============================================================================
set -euo pipefail

[ -d "$HOME/.cache/pp-rig/jre/bin" ] && export PATH="$HOME/.cache/pp-rig/jre/bin:$PATH"
NATT=/var/lib/barista/auth/claude/natt-pluggportalen/cli/node_modules/firebase-tools/lib/bin/firebase.js
if command -v firebase >/dev/null; then FB=(firebase); else FB=(node "$NATT"); fi
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx1200m}
REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO"
CFG="$REPO/.qa-svit-867-$$.firebase.json"   # gitignorad (.qa-*.firebase.json)
trap 'rm -f "$CFG"' EXIT
# Kommandot ur package.json: `firebase emulators:exec --only X "kommando"`.
ONLY=firestore; KMD="node --test $MDTEST"
node -e '
const cfg = process.argv[1];
const net = require("net");
const fri = () => new Promise((r) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
(async () => {
  const d = require("./firebase.json"); delete d.hosting;
  const fs = await fri();
  d.emulators = { auth: { port: await fri() }, firestore: { port: fs, websocketPort: await fri() },
    functions: { port: await fri() }, database: { host: "127.0.0.1", port: await fri() },
    hub: { port: await fri() }, logging: { port: await fri() }, eventarc: { port: await fri() },
    ui: { enabled: false }, singleProjectMode: true };
  require("fs").writeFileSync(cfg, JSON.stringify(d, null, 1));
})();' "$CFG"
# Callable-testerna når functions via FUNCTIONS_EMULATOR_HOST (emulators:exec sätter
# den inte; utan den svarar de "internal" mot standardporten 5001).
export FUNCTIONS_EMULATOR_HOST=127.0.0.1:$(node -e 'console.log(require(process.argv[1]).emulators.functions.port)' "$CFG")
exec 9>/tmp/pp-emulator.lock
flock -w 1200 9 || { echo "En annan emulator kör redan (lås /tmp/pp-emulator.lock)"; exit 1; }
"${FB[@]}" emulators:exec --config "$CFG" --project pluggportalen-so-2026 --only "$ONLY" "$KMD"
