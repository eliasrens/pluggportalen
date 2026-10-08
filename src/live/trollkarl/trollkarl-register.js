// ============================================================================
// Trollkarlsduellen (#536): REGISTREN – attacker (del C/D), finaler och ljud
// (del E). Nya saker läggs till genom att registrera dem i en egen modul och
// importera modulen i trollkarl-innehall.js. Kontraktet: docs/trollkarlsduellen-
// arkitektur.md.
//
// API
//   registerAttack({ id, name, durationMs, run(scene, a), placeholder? })
//   listAttacks()                → riktiga attacker (platshållare bara om inga finns)
//   getAttack(id)                → definitionen | null
//   pickAttack(seed, avoidId?)   → definition; deterministiskt ur seed, aldrig
//                                  avoidId om ≥ 2 attacker finns
//   registerFinale({ id, kind: "win"|"draw", name?, run(scene, f), placeholder? })
//   listFinales(kind)            → som listAttacks
//   pickFinale(seed, kind)       → definition | null
//   registerSound(name, fn(audioCtx, out, t))  – Web Audio-noder kopplas till out
//   getSound(name)               → fn | null
// ============================================================================

const attacks = new Map();
const finales = new Map();
const sounds = new Map();

function need(def, kind) {
  if (!def || typeof def.id !== "string" || !def.id) throw new Error(`${kind}: id saknas`);
  if (typeof def.run !== "function") throw new Error(`${kind} ${def.id}: run() saknas`);
}

function preferReal(list) {
  const real = list.filter((d) => !d.placeholder);
  return real.length ? real : list;
}

export function registerAttack(def) {
  need(def, "Attack");
  attacks.set(def.id, { name: def.id, durationMs: 6000, ...def });
}

export function listAttacks() {
  return preferReal([...attacks.values()]);
}

export function getAttack(id) {
  return attacks.get(id) || null;
}

export function pickAttack(seed, avoidId = null) {
  const list = listAttacks();
  if (!list.length) return null;
  const n = list.length;
  let i = (seed >>> 0) % n;
  if (n > 1 && list[i].id === avoidId) i = (i + 1 + ((seed >>> 8) % (n - 1))) % n;
  return list[i];
}

export function registerFinale(def) {
  need(def, "Final");
  if (def.kind !== "win" && def.kind !== "draw") throw new Error(`Final ${def.id}: kind måste vara "win" eller "draw"`);
  finales.set(def.id, { name: def.id, ...def });
}

export function listFinales(kind) {
  return preferReal([...finales.values()].filter((d) => d.kind === kind));
}

export function pickFinale(seed, kind) {
  const list = listFinales(kind);
  return list.length ? list[(seed >>> 0) % list.length] : null;
}

export function registerSound(name, fn) {
  if (typeof fn === "function") sounds.set(name, fn);
}

export function getSound(name) {
  return sounds.get(name) || null;
}
