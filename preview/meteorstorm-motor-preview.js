// ============================================================================
// Meteorstormen (#820): motor-previewn – motorns tillstånd ritat med
// projektorns riktiga bild (msp-bild.js, #822). Tidsreglage, "Samma frö"-knapp
// (två nya motorer, samma indata → samma fingeravtryck) och skrovreglage som
// visar skadenivåerna (§4.1.1) på riktigt: skrovet styrs för alla stationer. Ingen Firebase, inget format registreras.
// ============================================================================

import { skapaMotor } from "../src/live/formats/meteorstorm/delat/ms-motor.js";
import { stormPlan } from "../src/live/formats/meteorstorm/delat/ms-agera.js";
import { skapaPrng, hashFro } from "../src/live/formats/meteorstorm/delat/ms-prng.js";
import { STEG_MS, SKOLD_TAK, LADDNING_TAK, ATTACKER, skadeniva, RENDER_FORDROJNING_MS } from "../src/live/formats/meteorstorm/delat/ms-balans.js";
import { skapaBild } from "../src/live/formats/meteorstorm/msp-bild.js";
import { skapaLoggminne } from "../src/live/formats/meteorstorm/msp-scen.js";

const START = 1_700_000_000_000;
const $ = (id) => document.getElementById(id);
const FARG = ["#ff7a3d", "#3d9bff", "#2fd07a", "#ff5fa2"];
const IKON = { solstorm: "☀️ SOLSTORM! Dubbel energi", jattemeteor: "☄️ JÄTTEMETEOR – skjut ner den!", kometsvans: "✨ Kometsvans: +1 energi", lugnet: "🌌 Lugnet – andas!" };

/**
 * Påhittad logg: varje elev svarar var ~8:e s, rätt med andelen p, och trycker
 * 🛡️ eller 🔫 slumpvis. I Klass mot klass drar klassen i dragstrålen ungefär
 * var 12:e s. (Grov – ingen återkoppling från tillståndet; balansen mäts i
 * admin/ms-balans-sim.mjs.)
 */
function paHittadLogg({ seed, klasser, varaktighetMs, drag }) {
  const ut = [];
  let id = 0;
  for (const k of klasser) {
    const rng = skapaPrng(seed, `preview-${k.classId}`);
    for (let e = 0; e < k.elever; e++) {
      for (let t = rng.mellan(500, 8000); t < varaktighetMs; t += rng.mellan(6000, 10000)) {
        if (rng.tal() >= k.p) continue;
        const typ = drag && rng.tal() < 0.03 ? "drag" : rng.tal() < 0.5 ? "skold" : "laser";
        ut.push({ id: `p${String(++id).padStart(6, "0")}`, t: START + Math.round(t), classId: k.classId, uid: `${k.classId}-elev${e + 1}`, typ });
      }
    }
  }
  return ut;
}

function indata() {
  const lage = $("lage").value;
  const klasser = [{ classId: "4B", elever: Number($("elevA").value), p: Number($("rattA").value) / 100 }];
  if (lage === "klass-mot-klass") klasser.push({ classId: "4D", elever: Number($("elevB").value), p: Number($("rattB").value) / 100 });
  const varaktighetMs = Number($("tid").value) * 60_000;
  const seed = $("seed").value || "0";
  const attacker = $("attacker").value;
  return {
    seed, startMs: START, varaktighetMs,
    stationer: klasser.map((k) => ({ classId: k.classId, aktiva: k.elever })),
    installningar: { lage, attacker },
    handlingar: paHittadLogg({ seed, klasser, varaktighetMs, drag: lage === "klass-mot-klass" && ATTACKER[attacker].drag }),
  };
}

let cfg = indata();
let motor = null;
let spelar = false;
let skrovOverride = null;
const bild = skapaBild($("rymd"));
bild.storlek(1600, 900);
let loggminne = skapaLoggminne();

function bygg() {
  cfg = indata();
  motor = skapaMotor(cfg);
  motor.satHandlingar(cfg.handlingar);
  loggminne = skapaLoggminne();
  $("t").max = String(cfg.varaktighetMs);
  const plan = stormPlan(cfg);
  $("plan").textContent = `${plan.meteorer.length} meteorer per station · händelser: ${plan.handelser.map((h) => `${h.typ} ${Math.round(h.startMs / 1000)} s`).join(", ")} · ${cfg.handlingar.length} handlingar i loggen`;
  rita();
}

/** Fingeravtryck av hela tillståndet (FNV-1a över JSON). */
const avtryck = (s) => hashFro(JSON.stringify(s)).toString(16).padStart(8, "0");

function sammaFro() {
  const tider = [60, 200, 333.3, 450, 599.9].map((s) => START + Math.min(cfg.varaktighetMs, s * 1000));
  const korning = () => {
    const m = skapaMotor(cfg);
    m.satHandlingar([...cfg.handlingar].reverse()); // annan ordning in – samma svar ut
    return tider.map((t) => avtryck(m.tillstand(t)));
  };
  const a = korning();
  const b = korning();
  const lika = a.every((x, i) => x === b[i]);
  $("samma").innerHTML = `${lika ? "✅ Identiska" : "❌ OLIKA"} – körning 1: <code>${a.join(" ")}</code><br>körning 2: <code>${b.join(" ")}</code>`;
  $("samma").dataset.lika = String(lika);
}

function rita() {
  const t = Number($("t").value);
  const s = motor.tillstand(START + t);
  $("tLabel").textContent = `${(t / 1000).toFixed(1)} s / ${cfg.varaktighetMs / 1000} s`;
  // Projektorns riktiga ritning (#822): skadenivåerna, skölden, besättningen, meteorerna.
  bild.rita({
    s, tMotor: START + t, tAnim: START + t, cfg: motor.cfg, plan: motor.plan, minne: loggminne.las(s.logg),
    farger: s.stationer.map((_, i) => FARG[i]), namn: (id) => id, seed: motor.cfg.seed, rorelse: true, slut: null,
    skrov: skrovOverride == null ? null : s.stationer.map(() => skrovOverride),
  });
  const h = s.handelser[0];
  $("banderoll").textContent = h ? `${IKON[h.typ]} (${Math.ceil((h.slutMs - START - t) / 1000)} s)` : "";
  $("logg").innerHTML = s.logg.slice(-8).reverse().map((l) => `<li>${((l.t - START) / 1000).toFixed(1)} s · ${l.typ} ${l.classId || l.handelse || ""}${l.uid ? ` (${l.uid})` : ""}${l.fran ? ` från ${l.fran}` : ""}${l.storlek ? ` ${l.storlek}` : ""}</li>`).join("");
  $("tabell").innerHTML = s.stationer.map((st) => `<tr><td>${st.classId}</td><td>${st.aktiva}</td><td>${st.skrov.toFixed(1)}</td><td>${st.skold.toFixed(1)}/${SKOLD_TAK}</td><td>${st.laddning.toFixed(2)}/${LADDNING_TAK}</td><td>${st.nedskjutna}</td><td>${st.traffar}</td><td>${st.kastade}</td></tr>`).join("");
  $("resultat").textContent = s.resultat ? JSON.stringify(s.resultat) : "(matchen pågår)";
  $("avtryck").textContent = avtryck(s);
}

let senast = 0;
function loop(now) {
  if (spelar) {
    const dt = senast ? now - senast : 0;
    const t = Math.min(cfg.varaktighetMs, Number($("t").value) + dt * Number($("fart").value));
    $("t").value = String(t);
    rita();
    if (t >= cfg.varaktighetMs) spelar = false;
  }
  senast = now;
  requestAnimationFrame(loop);
}

for (const id of ["seed", "lage", "attacker", "tid", "elevA", "elevB", "rattA", "rattB"]) $(id).addEventListener("change", bygg);
$("t").addEventListener("input", rita);
$("spela").addEventListener("click", () => { spelar = !spelar; senast = 0; });
$("samma-knapp").addEventListener("click", sammaFro);
$("skrov").addEventListener("input", () => {
  skrovOverride = $("skrovPa").checked ? Number($("skrov").value) : null;
  $("skrovLabel").textContent = `${$("skrov").value} → ${skadeniva(Number($("skrov").value)).text}`;
  rita();
});
$("skrovPa").addEventListener("change", () => $("skrov").dispatchEvent(new Event("input")));
$("fordrojning").textContent = `${RENDER_FORDROJNING_MS} ms`;
$("steg").textContent = `${STEG_MS} ms`;
bygg();
$("skrov").dispatchEvent(new Event("input"));
requestAnimationFrame(loop);
window.__msPreview = { get cfg() { return cfg; }, motor: () => motor, sammaFro, avtryck };
