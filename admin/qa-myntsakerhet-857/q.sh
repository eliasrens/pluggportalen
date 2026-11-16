# . admin/qa-myntsakerhet-857/q.sh; q NAMN 'kommando'  – kör i riggens sandlåda (emulatorns env)
q () { local n=$1; shift; rm -f .scratch/cmd/$n.out; echo "cd '"$PWD"'; $*" > .scratch/cmd/$n.sh; for i in $(seq 1 110); do grep -q "## rc" .scratch/cmd/$n.out 2>/dev/null && break; sleep 1; done; cat .scratch/cmd/$n.out; }
d () { q dump$RANDOM "node admin/qa-myntsakerhet-857/qa857-seed.mjs dump $*"; }
