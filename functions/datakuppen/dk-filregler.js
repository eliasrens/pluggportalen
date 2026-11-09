// ============================================================================
// Datakuppen 💾 – FILTABELLEN och FILERNAS EFFEKT efter klassrådet (#832,
// uppdraget datakuppen-klassradet.md §3–§4). Delas med servern
// (functions/datakuppen/ = genererad kopia, se files-config.js) så att
// Cloud Functionen, demoläget och balansskriptet slumpar EXAKT samma sak.
// Värdena: DK_BALANS i files-config.js.
//
// Sannolikheter i stället för kistmotorns vikter, så att summan alltid är 1:
//   1. filernas vikter (DK_FILES) → andelar
//   2. Hackning av → Hackens andel till datafilerna i proportion till deras
//      andelar (som förut – Superservern får inget)
//   3. viruset inte möjligt (färre än efterFelIRad fel i rad) → virusets andel
//      till liten och vanlig mapp i proportion till deras andelar
//   4. Superservern får sin fasta sannolikhet (1 %), som tas från vanlig mapp
//
// API
//   fileTable({ hacking?, virus? }) → [{ chest, weight }] – weight = sannolikhet,
//                       summa 1 (hacking/virus standard true)
//   rollFile({ hacking?, virus? }, rng) → filen
//   applyFile(fil, gold, rng) → { delta, gold, protect, virusMb? } – data,
//                       Superserver (alltid exakt mb), Överklockning (×3, högst
//                       +300), virus (fast 10–20 MB, aldrig under 0), Brandvägg
//   virusAllowed(felIRad) → bool (felIRad ≥ efterFelIRad)
//   leakLimit(antalElever) → kodläckans gräns (5, eller 3 om färre än 12 elever)
//   hackFallbackId()   → filens id när ingen går att hacka (liten mapp)
// ============================================================================

import { DK_FILES, DK_BALANS, DK_RULES } from "./files-config.js";

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
const { filer, virus: VIRUS, hack: HACK, kodlacka } = DK_BALANS;

/** Andelar som flyttas från `from` till `to` i proportion till mottagarnas andelar. */
function move(rows, from, to) {
  const src = rows.filter(from);
  const amount = src.reduce((n, r) => n + r.weight, 0);
  const dst = rows.filter((r) => !from(r) && to(r));
  const sum = dst.reduce((n, r) => n + r.weight, 0);
  if (!amount || !sum) return rows;
  return rows.filter((r) => !from(r)).map((r) => (dst.includes(r) ? { ...r, weight: r.weight + amount * (r.weight / sum) } : r));
}

const fixed = (f) => Number(f.sannolikhet) > 0;

export function fileTable({ hacking = true, virus = true } = {}) {
  const base = DK_FILES.filter((f) => !fixed(f)).map((chest) => ({ chest, weight: Math.max(0, Number(chest.weight) || 0) }));
  const total = base.reduce((n, r) => n + r.weight, 0);
  let rows = base.map((r) => ({ ...r, weight: r.weight / total }));
  if (hacking === false) {
    rows = move(rows, (r) => r.chest.effect.kind === "steal", (r) => r.chest.effect.kind === "gold");
  }
  if (!virus) {
    const small = [filer.litenMapp.id, filer.vanligMapp.id];
    rows = move(rows, (r) => r.chest.effect.kind === "lose", (r) => small.includes(r.chest.id));
  }
  for (const f of DK_FILES.filter(fixed)) {
    const from = rows.find((r) => r.chest.id === filer.vanligMapp.id);
    const p = Math.min(Number(f.sannolikhet), from?.weight ?? 0);
    if (from) from.weight -= p;
    rows.push({ chest: f, weight: p });
  }
  return rows;
}

export function rollFile(opts = {}, rng = Math.random) {
  const rows = fileTable(opts).filter((r) => r.weight > 0);
  let x = Math.min(Math.max(Number(rng()) || 0, 0), 0.999999999);
  for (const r of rows) {
    if (x < r.weight) return r.chest;
    x -= r.weight;
  }
  return rows[rows.length - 1].chest;
}

/** Heltal lo–hi (båda med) ur slumpen. */
const between = (lo, hi, rng) => lo + Math.min(hi - lo, Math.floor((Number(rng()) || 0) * (hi - lo + 1)));

/** Filer utan mål: nytt saldo (aldrig under 0, aldrig över taket). */
export function applyFile(chest, gold, rng = Math.random) {
  const g = int(gold);
  const e = chest?.effect || {};
  let delta = 0;
  let virusMb;
  if (e.kind === "gold") delta = int(e.amount);
  else if (e.kind === "double") delta = Math.min(g * (int(e.factor || 2) - 1), int(e.cap));
  else if (e.kind === "lose") {
    virusMb = between(int(e.min), int(e.max), rng);
    delta = -Math.min(g, virusMb);
  }
  const next = Math.min(DK_RULES.maxGold, Math.max(0, g + delta));
  return { delta: next - g, gold: next, protect: e.kind === "shield", ...(virusMb != null ? { virusMb } : {}) };
}

export function virusAllowed(felIRad) {
  return int(felIRad) >= VIRUS.efterFelIRad;
}

export function leakLimit(antalElever) {
  return int(antalElever) < kodlacka.smaKlassUnder ? kodlacka.gransSmaKlasser : kodlacka.grans;
}

export function hackFallbackId() {
  return filer[HACK.ersattningOmIngetMal].id;
}
