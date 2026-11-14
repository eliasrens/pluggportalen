#!/usr/bin/env bash
# ============================================================================
# Mattematchen #849 – nekat mynt vid "fel dag" utan att vänta på midnatt.
# ----------------------------------------------------------------------------
# Som admin/qa-mattematchen-mynt-preview.sh (elev1, 4A, MYNT = dagsräknaren),
# men emulatorn kör en KOPIA av firestore.rules där mmMyntOk:s
# svenskDag(request.time) förskjuts SKEW sekunder. SKEW=-86400 = servern står
# kvar på gårdagen medan klienten redan är på idag (klienten före servern vid
# midnatt). Byt förskjutning medan sidan är öppen (emulatorn läser om filen):
#
#   bash admin/qa-mattematchen-849-preview.sh skew -86400   # servern "igår" → myntet nekas
#   bash admin/qa-mattematchen-849-preview.sh skew 0        # servern når "idag" → betalas
#   bash admin/qa-mattematchen-849-preview.sh skew -86400 lasfel  # + läsningen efter nekandet misslyckas
#
# Starta (förgrund, passar barista_serve {command, port: 8849}):
#   MYNT=10 PORT=8849 bash admin/qa-mattematchen-849-preview.sh
# Utöver qa-emulator-proxy svarar /qa-cov med emulatorns ruleCoverage (JSON),
# så läsningar av studentData/*/mmMynt kan räknas (allow read-utvärderingar).
# Konto: elev1 / lilla123. Firestore-PATCH via proxyn: Authorization: Bearer owner.
# ============================================================================
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
REGLER="$REPO/.scratch/qa-849.rules"; mkdir -p "$REPO/.scratch"
skriv_regler() { # $1 = sekunder, $2 = "lasfel" → eleven får inte läsa mmMynt (läsningen efter nekandet misslyckas)
  sed "s|dag == svenskDag(request.time) \&\& d.dag == dag|dag == svenskDag(request.time + duration.value($1, 's')) \&\& d.dag == dag|" \
    "$REPO/firestore.rules" > "$REGLER.tmp"
  grep -q "duration.value($1, 's')) && d.dag == dag" "$REGLER.tmp" || { echo "mmMyntOk hittades inte"; exit 1; }
  [ "${2:-}" = lasfel ] && sed -i '/match \/mmMynt\/{dag} {/{n;s|allow read: if .*;|allow read: if false;|}' "$REGLER.tmp"
  # Skriv I filen (inte mv): emulatorns filbevakning tappar filen efter några byten.
  cat "$REGLER.tmp" > "$REGLER"; rm -f "$REGLER.tmp"
  echo "✓ regler: svenskDag(request.time + $1 s)${2:+, $2}; $(grep -A1 'match /mmMynt/{dag} {' "$REGLER" | tail -1 | xargs)"
}
if [ "${1:-}" = skew ]; then skriv_regler "${2:?sekunder}" "${3:-}"; exit 0; fi

PORT=${PORT:-8849}
MYNT=${MYNT:-10}
cd "$REPO"
port() { node -e 's=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }
FS=$(port); AUTH=$(port); HUB=$(port); LG=$(port); INRE=$(port)
DIR=$(mktemp -d /tmp/mm-849-XXXX)
[ -n "${JAVA_BIN:-}" ] && export PATH="$JAVA_BIN:$PATH"
[ -d "$HOME/.cache/pp-rig/jre/bin" ] && export PATH="$HOME/.cache/pp-rig/jre/bin:$PATH"
export JAVA_TOOL_OPTIONS=${JAVA_TOOL_OPTIONS:--Xmx600m}
export FIRESTORE_EMULATOR_HOST=127.0.0.1:$FS FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:$AUTH GCLOUD_PROJECT=pluggportalen-so-2026
if [ -n "${FIREBASE_JS:-}" ]; then FB=(node "$FIREBASE_JS");
elif command -v firebase >/dev/null; then FB=(firebase);
else FB=(node /var/lib/barista/auth/claude/natt-pluggportalen/cli/node_modules/firebase-tools/lib/bin/firebase.js); fi
skriv_regler "${SKEW:-0}"

cat > "$DIR/firebase.json" <<EOF
{ "firestore": { "rules": "$REGLER", "indexes": "$REPO/firestore.indexes.json" },
  "emulators": { "auth": { "host": "127.0.0.1", "port": $AUTH },
    "firestore": { "host": "127.0.0.1", "port": $FS, "websocketPort": 0 },
    "hub": { "host": "127.0.0.1", "port": $HUB }, "logging": { "host": "127.0.0.1", "port": $LG },
    "ui": { "enabled": false }, "singleProjectMode": true } }
EOF

exec 9>/tmp/pp-emulator.lock
flock -w 600 9 || { echo "En annan emulator kör redan (lås /tmp/pp-emulator.lock)"; exit 1; }
echo "▶ emulator (Firestore $FS, Auth $AUTH), logg $DIR/emu.log …"
cd "$DIR"
setsid "${FB[@]}" emulators:start --config "$DIR/firebase.json" \
  --project pluggportalen-so-2026 --only auth,firestore > "$DIR/emu.log" 2>&1 < /dev/null &
EMU=$!
cd "$REPO"
stoppa() { echo "▪ stoppar emulatorn"; kill -- -"$EMU" 2>/dev/null || true; kill "${PROXY:-0}" 2>/dev/null || true; rm -f "$REGLER"; }
trap stoppa EXIT INT TERM
for _ in $(seq 1 90); do grep -q "All emulators ready" "$DIR/emu.log" 2>/dev/null && break; sleep 2; done
grep -q "All emulators ready" "$DIR/emu.log" || { echo "Emulatorn startade inte – se $DIR/emu.log"; tail -20 "$DIR/emu.log"; exit 1; }

echo "▶ seed (elev1:s dagsräknare = $MYNT)…"
node admin/qa-mattematchen-seed.mjs
MYNT=$MYNT node --input-type=module -e '
import admin from "firebase-admin";
import { myntDag } from "./src/tavling/mm-config.js";
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = admin.firestore(app);
const dag = myntDag(Date.now());
const n = Number(process.env.MYNT) || 0;
const ref = db.doc(`studentData/elev1/mmMynt/${dag}`);
if (n > 0) await ref.set({ dag, cid: "mm-qa-oktober", mynt: n, lastAttemptId: "seed", lastAt: admin.firestore.Timestamp.now() });
else await ref.delete();
console.log(`✓ studentData/elev1/mmMynt/${dag} = ${n}, coins = ${(await db.doc("studentData/elev1").get()).data().coins}`);
process.exit(0);
'
PORT=$INRE node admin/qa-emulator-proxy.mjs > "$DIR/proxy.log" 2>&1 &
PROXY=$!
echo "▶ http://127.0.0.1:$PORT/ (/qa-cov = ruleCoverage; loggar i $DIR)"
PORT=$PORT INRE=$INRE FS=$FS node --input-type=module -e '
import { createServer, request } from "node:http";
const { PORT, INRE, FS, GCLOUD_PROJECT: P } = process.env;
createServer((req, res) => {
  const cov = req.url.startsWith("/qa-cov");
  const opt = cov
    ? { host: "127.0.0.1", port: FS, path: `/emulator/v1/projects/${P}:ruleCoverage`, method: "GET" }
    : { host: "127.0.0.1", port: INRE, path: req.url, method: req.method, headers: req.headers };
  const up = request(opt, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  if (cov) up.end(); else req.pipe(up);
}).listen(Number(PORT), "0.0.0.0");
'
