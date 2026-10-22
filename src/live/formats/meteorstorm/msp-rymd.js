// ============================================================================
// Meteorstormen – projektorns huvudvy "☄️ Rymden" (#822, spec §4). Vyn är
// också slutet (finale): stationerna, slutrutan och fyrverkerierna.
//
// RENDERINGSBUFFERTEN (Elias 2026-10-21, #822 F1): vyn ritar motorns tillstånd
// för t = nu − buffert (nu = server-korrigerad klocka, deps.now()). Bufferten
// börjar på RENDER_FORDROJNING_MS (3 s) och växer – aldrig krymper – med de
// uppmätta leveranstiderna (msp-buffert.js, tak 8 s). t följer målet mjukt
// (saktar in till ≥ 0,8 när bufferten växer) och går aldrig bakåt (stegaKlocka).
// Allt som ritas är en funktion av (sessionen, händelseloggen, fröet, t) – två
// lärare som öppnar projektorn för samma session får samma bild (§4.4) så länge
// händelserna når båda inom bufferten. Slutet: t stannar vid
// stormens slut (lärarens avslut eller 00:00); animationerna fortsätter.
//
// DATA (kvoten, docs/METEORSTORMEN.md §9): EN lyssnare på msEvents (watchEvents),
// ingen omläsning. Händelser med typ "fel" (bara felbufferten) hoppas över.
// msStationer (aktiva per station) läses ur sessionen – saknas det har ingen
// handlat än (aktiva 1). Projektorn SKRIVER INGET i formatets samlingar
// (msPublic/status är serverns). Avsluta = skalets knapp (kärnans flöde:
// status finished → format.resultInputs → msAvsluta); slutrutan visar
// serverns result.
// Datalagret: deps.meteorstorm (demot) eller meteorstorm-data.js (latt).
//
// API: createRymden(host, { st, colors, sound, actions, screen, deps }) → { update, destroy }
//   globalThis.__mspProjektor (felsökning/QA): { t(), frys(t|null), avtryck(),
//   avtryckVid(t), fps(), nollstall(), stat() } – två projektorer jämförs med
//   avtryckVid(t) (samma t → samma pixlar); stat(): sena handlingar, bakåt-steg,
//   leverans { buffertMs, n, median, p95, max }.
// ============================================================================

import { skapaMotor } from "./delat/ms-motor.js";
import { hashFro } from "./delat/ms-prng.js";
import { cfgNyckel, normCfg } from "./delat/ms-indata.js";
import { phaseAt, formatClock } from "../../live-core.js";
import { prefersReducedMotion } from "../../design/live-reactions.js";
import {
  W, H, FORDROJNING_MS, platser, motorIndata, slutVid, handlingarUr, stegaKlocka, skapaLoggminne, flodeVid, banderollVid,
} from "./msp-scen.js";
import { skapaBild } from "./msp-bild.js";
import { skapaBuffert } from "./msp-buffert.js";
import { createHud } from "./msp-hud.js";
import { slutModell, slutHtml } from "./msp-slut.js";
import { createMsLjud } from "./msp-ljud.js";

const CSS = new URL("./meteorstorm-projektor.css", import.meta.url).href;
const MAX_PX = 2048;

function pixelHash(g, w, h) {
  const c = g.getImageData(0, 0, w, h).data;
  let x = 0x811c9dc5;
  for (let i = 0; i < c.length; i++) x = Math.imul(x ^ c[i], 0x01000193) >>> 0;
  return x.toString(16);
}

export function ensureMspCss() {
  if (document.querySelector("link[data-msp-css]")) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = CSS;
  l.dataset.mspCss = "1";
  document.head.appendChild(l);
}

export function createRymden(host, { st, colors = {}, sound = null, screen = false, deps = null, say = () => {} }) {
  ensureMspCss();
  let s = st.session;
  const sid = st.sessionId || s.id;
  const root = document.createElement("div");
  root.className = "msp";
  root.innerHTML = `<div class="msp-ram"><canvas class="msp-canvas" aria-label="Rymdstationerna och meteorstormen"></canvas>
    <div class="msp-slut" hidden></div>
    <div class="msp-vanta" hidden></div></div>`;
  host.replaceChildren(root);
  const ram = root.querySelector(".msp-ram");
  const canvas = root.querySelector("canvas");
  const slutEl = root.querySelector(".msp-slut");
  const vantaEl = root.querySelector(".msp-vanta");
  const bild = skapaBild(canvas);
  const ljud = createMsLjud(sound);
  const now = () => (deps?.now ? deps.now() : Date.now());

  let cfg = null;
  let nyckel = "";
  let motor = null;
  let handlingar = [];
  const namn = new Map();
  const klassNamn = (id) => s?.classNames?.[id] || id;
  let minne = skapaLoggminne({ namn, klass: klassNamn, visaNamn: s.showNames !== false });
  let hud = null;
  let farger = [];
  let tAnim = null;
  let frys = null;
  let senastRam = 0;
  let raf = 0;
  let dod = false;
  let rorelse = !prefersReducedMotion();
  let sedd = 0; // loggposter som redan gett ljud
  let slutVisad = "";
  const ramtider = [];
  const rittider = []; // JS-tid per bildruta (motorn + ritningen)
  let bakat = 0; // bildrutor där t gick bakåt (ska alltid vara 0)
  let ryck = 0; // största avvikelsen (ms) mellan t:s steg och verklig tid

  function byggMotor() {
    const c = motorIndata(s);
    const k = cfgNyckel(normCfg(c));
    if (k === nyckel && motor) return;
    nyckel = k;
    cfg = normCfg(c);
    motor = skapaMotor(c);
    motor.satHandlingar(handlingar);
    farger = cfg.stationer.map((x, i) => colors[x.classId] || ["#ff7a3d", "#3d9bff", "#2fd07a", "#ff5fa2"][i % 4]);
    minne = skapaLoggminne({ namn, klass: klassNamn, visaNamn: s.showNames !== false });
    hud?.destroy();
    hud = createHud(ram, { namn: klassNamn, farger, pl: platser(cfg.stationer.length) });
    sedd = Infinity; // ljud bara för det som händer efter att vyn monterats
  }

  // --- händelseloggen: EN lyssnare ------------------------------------------------
  let unsub = () => {};
  const buffert = skapaBuffert();
  const kanda = new Set();
  let forsta = true; // första ögonblicksbilden = historiken: varken leveranstid eller sen
  let sena = 0; // handlingar som kom efter att deras tid redan ritats (QA: renderingsbufferten)
  const onEvents = (events) => {
    const ankom = now();
    for (const e of events) {
      if (!e?.id || kanda.has(e.id)) continue;
      kanda.add(e.id);
      if (e.uid && e.namn) namn.set(e.uid, String(e.namn));
      if (forsta || !Number.isFinite(e.t)) continue;
      buffert.matt(ankom - e.t);
      if (e.typ !== "fel" && tAnim != null && e.t < tAnim - 100) sena++;
    }
    forsta = false;
    handlingar = handlingarUr(events);
    motor?.satHandlingar(handlingar);
  };
  const onErr = (e) => say(`Händelserna: ${e?.message || e}`);
  const data = deps?.meteorstorm ? Promise.resolve(deps.meteorstorm) : import("./meteorstorm-data.js");
  data.then((d) => { if (!dod) unsub = d.watchEvents(sid, onEvents, onErr); }).catch(onErr);

  // --- storlek: 16:9-ram i scenen ---------------------------------------------------
  function anpassa() {
    const r = root.getBoundingClientRect();
    const w = Math.max(160, Math.min(r.width, (r.height * 16) / 9));
    const h = (w * 9) / 16;
    ram.style.width = `${w}px`;
    ram.style.height = `${h}px`;
    ram.style.setProperty("--msp-u", `${w / W}px`);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pxW = Math.min(MAX_PX, Math.round(w * dpr));
    bild.storlek(pxW, Math.round((pxW * H) / W));
  }
  const ro = new ResizeObserver(anpassa);
  ro.observe(root);
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const onMq = () => { rorelse = !prefersReducedMotion(); };
  mq?.addEventListener?.("change", onMq);

  // --- en bildruta ------------------------------------------------------------------
  function ritaVid(tA, b = bild) {
    const slut = slutVid(s);
    const tM = slut == null ? Math.min(tA, cfg.startMs) : Math.min(tA, slut);
    const tillstand = motor.tillstand(tM);
    const m = minne.las(tillstand.logg);
    const fas = phaseAt(s, now()).phase;
    const klar = fas === "finished" && s.result;
    const firar = !klar ? [] : s.result.lage === "en-klass"
      ? (s.result.overlevde ? [0] : [])
      : tillstand.stationer.map((x, i) => (x.classId === s.result.winner ? i : -1)).filter((i) => i >= 0);
    b.rita({
      s: tillstand, tMotor: tM, tAnim: tA, cfg, plan: motor.plan, minne: m, farger, namn: klassNamn,
      seed: cfg.seed, rorelse, slut: klar ? { sedan: slut ?? tA, firar } : null,
    });
    return { tillstand, m, tM, klar, fas };
  }

  function ram1(nu) {
    raf = requestAnimationFrame(ram1);
    if (!motor || !cfg) return;
    const dt = senastRam ? nu - senastRam : 16;
    senastRam = nu;
    ramtider.push(dt);
    if (ramtider.length > 300) ramtider.shift();
    const fore = tAnim;
    tAnim = frys ?? stegaKlocka(tAnim, now() - buffert.varde(), dt);
    if (fore != null && frys == null) {
      if (tAnim < fore) bakat++;
      if (dt <= 100) ryck = Math.max(ryck, Math.abs(tAnim - fore - dt)); // en hängd sida räknas inte som ryck
    }
    const t0 = performance.now();
    const { tillstand, m, tM, klar, fas } = ritaVid(tAnim);
    rittider.push(performance.now() - t0);
    if (rittider.length > 300) rittider.shift();
    // ljud för NYA loggposter (inte vid montering eller efter en tillbakaspolning)
    const logg = tillstand.logg;
    if (sedd === Infinity) sedd = logg.length;
    if (logg.length < sedd) sedd = logg.length;
    for (; sedd < logg.length; sedd++) if (tM - logg[sedd].t < 1500) ljud.post(logg[sedd]);
    // textlagret
    const ph = phaseAt(s, now());
    hud.el.hidden = !!klar;
    if (!klar) {
      hud.klocka(fas === "lobby" ? "--:--" : formatClock(ph.msLeft), ph.msLeft <= 60_000 && fas === "live");
      hud.banderoll(fas === "finished" || fas === "ended" ? null : banderollVid(tillstand.handelser[0], tM));
      hud.stationer(tillstand.stationer, tM);
      hud.flode(flodeVid(m.poster, tM));
    }
    visaSlut(klar, fas);
  }

  function visaSlut(klar, fas) {
    const k = klar ? `r|${s.result.computedAt?.seconds ?? 1}` : fas === "finished" || fas === "ended" ? "vanta" : "";
    if (k === slutVisad) return;
    slutVisad = k;
    if (klar) {
      slutEl.innerHTML = slutHtml(slutModell(s.result, s), Object.fromEntries(cfg.stationer.map((x, i) => [x.classId, farger[i]])));
      slutEl.hidden = false;
      vantaEl.hidden = true;
      ljud.slut();
    } else {
      slutEl.hidden = true;
      vantaEl.hidden = k !== "vanta";
      vantaEl.textContent = "☄️ Stormen är över! Räknar ihop stationerna …";
    }
  }

  function update(next) {
    st = next;
    if (next.session) s = next.session;
    byggMotor();
  }
  update(st);
  anpassa();
  raf = requestAnimationFrame(ram1);

  const api = {
    t: () => tAnim,
    frys(t) { frys = t == null ? null : Number(t); if (frys != null) tAnim = frys; },
    avtryck() {
      return { t: tAnim, px: [canvas.width, canvas.height], hash: pixelHash(bild.g, canvas.width, canvas.height) };
    },
    /** Rita bildrutan för t i en egen 960×540-canvas (rör inte projektorns t) → fingeravtryck. */
    avtryckVid(t) {
      const c = document.createElement("canvas");
      const b = skapaBild(c);
      b.storlek(960, 540);
      const { tillstand } = ritaVid(Number(t), b);
      return { t: Number(t), hash: pixelHash(b.g, 960, 540), tillstand: hashFro(JSON.stringify(tillstand.stationer)).toString(16), handlingar: handlingar.length };
    },
    fps() {
      const stat = (lista) => {
        const l = [...lista].sort((a, b) => a - b);
        return { medel: l.reduce((a, b) => a + b, 0) / (l.length || 1), p95: l[Math.floor(l.length * 0.95)] || 0, max: l[l.length - 1] || 0 };
      };
      const r = stat(ramtider);
      const j = stat(rittider);
      return {
        fps: Math.round(1000 / r.medel), medelMs: +r.medel.toFixed(2), p95Ms: +r.p95.toFixed(2), ramar: ramtider.length,
        ritaMedelMs: +j.medel.toFixed(2), ritaP95Ms: +j.p95.toFixed(2), ritaMaxMs: +j.max.toFixed(2), px: [canvas.width, canvas.height],
      };
    },
    nollstall() { ramtider.length = 0; rittider.length = 0; ryck = 0; },
    stat: () => ({ handlingar: handlingar.length, sena, bakat, ryckMs: +ryck.toFixed(1), fordrojning: FORDROJNING_MS, leverans: buffert.stat() }),
  };
  globalThis.__mspProjektor = api;

  return {
    update,
    destroy() {
      dod = true;
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      mq?.removeEventListener?.("change", onMq);
      ljud.destroy();
      hud?.destroy();
      if (globalThis.__mspProjektor === api) delete globalThis.__mspProjektor;
      root.remove();
    },
  };
}
