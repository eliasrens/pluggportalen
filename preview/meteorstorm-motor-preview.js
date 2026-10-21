// ============================================================================
// Meteorstormen (#820): motor-previewn – en ENKEL debug-rendering av motorns
// tillstånd (den riktiga grafiken byggs i C). Tidsreglage, "Samma frö"-knapp
// (två nya motorer, samma indata → samma fingeravtryck) och skrovreglage som
// visar skadenivåerna (§4.1.1). Ingen Firebase, inget format registreras.
// ============================================================================

import { skapaMotor } from "../src/live/formats/meteorstorm/delat/ms-motor.js";
import { stormPlan } from "../src/live/formats/meteorstorm/delat/ms-agera.js";
import { skapaPrng, hashFro } from "../src/live/formats/meteorstorm/delat/ms-prng.js";
import { STEG_MS, SKOLD_TAK, LADDNING_TAK, ATTACKER, skadeniva, RENDER_FORDROJNING_MS } from "../src/live/formats/meteorstorm/delat/ms-balans.js";

const START = 1_700_000_000_000;
const $ = (id) => document.getElementById(id);
const FARG = ["#ffb347", "#7ad3ff", "#b48cff", "#8ee59b"];
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

function bygg() {
  cfg = indata();
  motor = skapaMotor(cfg);
  motor.satHandlingar(cfg.handlingar);
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

function stationPos(i, n, W, H) {
  if (n === 1) return [W / 2, H * 0.55];
  return [W * (0.25 + (0.5 * i) / (n - 1)), H * 0.55];
}

function rita() {
  const t = Number($("t").value);
  const s = motor.tillstand(START + t);
  $("tLabel").textContent = `${(t / 1000).toFixed(1)} s / ${cfg.varaktighetMs / 1000} s`;
  const cv = $("rymd");
  const g = cv.getContext("2d");
  const W = cv.width;
  const H = cv.height;
  g.fillStyle = "#0d1640";
  g.fillRect(0, 0, W, H);
  const rng = skapaPrng("stjarnor");
  g.fillStyle = "#fff";
  for (let i = 0; i < 90; i++) g.fillRect(rng.tal() * W, rng.tal() * H, 1.5, 1.5);
  const idx = new Map(s.stationer.map((st, i) => [st.classId, i]));
  s.stationer.forEach((st, i) => {
    const [x, y] = stationPos(i, s.stationer.length, W, H);
    const skrov = skrovOverride ?? st.skrov;
    const niva = skadeniva(skrov);
    g.globalAlpha = 0.15 + (0.6 * st.skold) / SKOLD_TAK;
    g.strokeStyle = "#8fd8ff";
    g.lineWidth = 6;
    g.beginPath(); g.arc(x, y, 62, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = niva.id === "flyter" ? 0.45 : 1;
    g.fillStyle = FARG[i];
    g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = "#fff";
    g.font = "bold 16px system-ui";
    g.textAlign = "center";
    g.fillText(st.classId, x, y + 5);
    g.font = "12px system-ui";
    g.fillText(`skrov ${skrov.toFixed(1)} · sköld ${st.skold.toFixed(1)} · laser ${st.laddning.toFixed(2)}`, x, y + 88);
    g.fillText(`${niva.id}${st.hjalp ? " · 🚀 extra kraft" : ""}${st.drag.tillaten ? ` · 🌀 ${st.drag.armerad ? "väntar" : t + START >= st.drag.redoMs ? "redo" : `${Math.ceil((st.drag.redoMs - START - t) / 1000)} s`} (${st.drag.kostnad})` : ""}`, x, y + 104);
  });
  for (const m of s.meteorer) {
    const i = idx.get(m.mal);
    const [x, y] = stationPos(i, s.stationer.length, W, H);
    let fx;
    let fy;
    if (m.kastadAv) [fx, fy] = stationPos(idx.get(m.kastadAv), s.stationer.length, W, H);
    else {
      const vinkel = Math.PI * (0.15 + 0.7 * m.bana) * (i % 2 ? -1 : 1) - Math.PI / 2;
      fx = x + Math.cos(vinkel) * 260;
      fy = y + Math.sin(vinkel) * 260;
    }
    const px = fx + (x - fx) * m.pos;
    const py = fy + (y - fy) * m.pos;
    const r = { liten: 5, mellan: 8, stor: 12, jatte: 20 }[m.storlek];
    if (m.kastadAv) {
      g.strokeStyle = FARG[idx.get(m.kastadAv)];
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(fx, fy); g.lineTo(px, py); g.stroke();
    }
    g.fillStyle = m.jatte ? "#ff6b6b" : "#c9a27a";
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
  }
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
