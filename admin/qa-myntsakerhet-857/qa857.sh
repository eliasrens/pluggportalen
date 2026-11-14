#!/usr/bin/env bash
# Slut-QA #857 (epic #851) – EN emulator (functions+auth+firestore) genom hela
# övergången main → fas 1 → fas 2, se docs/QA-RAPPORT-myntsakerhet-851.md.
#   bash admin/qa-myntsakerhet-857/qa857.sh init        # git archive main/mynt-fas1/HEAD → .scratch/
#   PORT=8857 bash admin/qa-myntsakerhet-857/qa857.sh   # förgrund (barista_serve)
# Regler: .scratch/qa857.rules skrivs IN PLACE ur rules-{main,fas1,head}.rules
#   (… qa857.sh regler fas1) – emulatorn hot-reloadar (mv/sed -i tappar filbevakningen)
# Webb: .scratch/web -> w-{main,fas1,head} (… qa857.sh webb main), ladda om sidan efteråt.
# /qa-cov = ruleCoverage, /qa-rest = REST-räkning, /__qa/rakna = Listen/Write (QA_RAKNA).
# Kommandokö (Admin SDK i sandlådan): .scratch/cmd/NAMN.sh → NAMN.out (q.sh).
# I sidan: const h = await import('/qa857-h.js'); await h.loggaIn('q857e'); await h.ovning() …
set -euo pipefail
REPO=$(cd "$(dirname "$0")/../.." && pwd)
H=$REPO/admin/qa-myntsakerhet-857
S=$REPO/.scratch
if [ "${1:-}" = init ]; then
  mkdir -p "$S"; cd "$REPO"
  for p in "main origin/main" "fas1 mynt-fas1" "head HEAD"; do set -- $p
    rm -rf "$S/w-$1"; mkdir -p "$S/w-$1"; git archive "$2" index.html src preview design | tar -x -C "$S/w-$1"
    git show "$2:firestore.rules" > "$S/rules-$1.rules"; cp "$H/qa857-h.js" "$S/w-$1/qa857-h.js"; echo "✓ $1 = $(git rev-parse --short "$2")"; done
  exit 0
fi
if [ "${1:-}" = regler ]; then cat "$S/rules-$2.rules" > "$S/qa857.rules"; echo "$2" > "$S/aktiva-regler.txt"; echo "✓ regler $2 ($(wc -l < "$S/qa857.rules") rader)"; exit 0; fi
if [ "${1:-}" = webb ]; then ln -sfn "$S/w-$2" "$S/web"; echo "✓ webb $2"; exit 0; fi
PORT=${PORT:-8857}
cd "$REPO"
port() { node -e 's=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
FS=$(port); AUTH=$(port); FN=$(port); HUB=$(port); LG=$(port); INRE=$(port)
DIR=$(mktemp -d /tmp/qa857-XXXX)
[ -d "$HOME/.cache/pp-rig/jre/bin" ] && export PATH="$HOME/.cache/pp-rig/jre/bin:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx900m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH FUNCTIONS_EMULATOR_HOST=127.0.0.1:$FN GCLOUD_PROJECT=pluggportalen-so-2026
FB=(node /var/lib/barista/auth/claude/natt-pluggportalen/cli/node_modules/firebase-tools/lib/bin/firebase.js)
[ -s "$S/qa857.rules" ] || cat "$S/rules-${REGLER:-main}.rules" > "$S/qa857.rules"
[ -e "$S/web" ] || ln -sfn "$S/w-${WEBB:-main}" "$S/web"
CFG=$(mktemp -p "$REPO" .qa-857-XXXX.firebase.json)
node -e '
const c = JSON.parse(require("fs").readFileSync("firebase.json", "utf8"));
const [fs, au, fn, hub, lg] = process.argv.slice(1).map(Number);
c.firestore.rules = ".scratch/qa857.rules";
c.emulators = { auth: { host: "127.0.0.1", port: au }, firestore: { host: "127.0.0.1", port: fs, websocketPort: 0 },
  functions: { host: "127.0.0.1", port: fn }, hub: { host: "127.0.0.1", port: hub }, logging: { host: "127.0.0.1", port: lg },
  ui: { enabled: false }, singleProjectMode: true };
for (const f of [].concat(c.functions || [])) delete f.predeploy;
delete c.hosting;
require("fs").writeFileSync(process.argv[6], JSON.stringify(c));' $FS $AUTH $FN $HUB $LG "$CFG"

exec 9>/tmp/pp-emulator.lock
flock -w 1800 9 || { echo "lås upptaget"; rm -f "$CFG"; exit 1; }
echo "▶ emulator (FS $FS, Auth $AUTH, FN $FN), logg $DIR/emu.log"
setsid "${FB[@]}" emulators:start --config "$CFG" --project pluggportalen-so-2026 --only functions,auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null &
EMU=$!
stoppa() { echo "▪ stoppar"; kill -- -"$EMU" 2>/dev/null || true; kill ${PROXY:-0} ${KO:-0} 2>/dev/null || true; rm -f "$CFG"; }
trap stoppa EXIT INT TERM
for _ in $(seq 1 150); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "startade inte"; tail -20 "$DIR/emu.log"; exit 1; }
echo "$DIR" > "$S/emu-dir.txt"
if [ -z "${UTAN_SEED:-}" ]; then node admin/qa-mattematchen-844-seed.mjs && node "$H/qa857-seed.mjs"; fi
mkdir -p "$S/cmd"
( while true; do for f in "$S"/cmd/*.sh; do [ -e "$f" ] || continue; mv "$f" "$f.kor"; bash "$f.kor" > "${f%.sh}.out" 2>&1; echo "## rc=$?" >> "${f%.sh}.out"; rm -f "$f.kor"; done; sleep 1; done ) &
KO=$!
QA_ROOT="$S/web" QA_RAKNA=1 PORT=$INRE node admin/qa-emulator-proxy.mjs > "$DIR/proxy.log" 2>&1 &
PROXY=$!
echo "▶ http://127.0.0.1:$PORT/"
PORT=$PORT INRE=$INRE FS=$FS node "$H/qa857-yttre.mjs"
