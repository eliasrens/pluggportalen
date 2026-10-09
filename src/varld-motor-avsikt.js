// ============================================================================
// Pluggporten – AVSIKT: färsk reserv när eleven pekar på/fokuserar något
// klickbart (#396, F6 #432)
// ----------------------------------------------------------------------------
// Vid handoff speglas lager med levande ambient om. Hinns det inte (RESERV_MAX_MS)
// spelas rörelsen på reserven – med molnen i reservens pose och hover-skalan
// som gällde då. Det synliga lagret vid START hoppar då (F5 §8): molnen så
// mycket som de drivit sedan reserven speglades (~30 px/s), huset ~1–6 px.
//
// Ett klick föregås nästan alltid av hover eller fokus på målet. Därför: när
// pekaren/fokus landar på ett klickbart element i staget (i ett lager eller i
// .varld-ui: "Gå ut", "Till gården") speglas det AKTIVA lagrets förvärmda
// roller om – efter att hover-transitionen landat – i aktuellt tillstånd och
// med aktuell ambient-pose (prio "nu"). Klicket strax efter → reservens pose
// ligger bara hover→klick-tiden efter, och tillståndet stämmer exakt (posten
// ligger under nyckeln roll + tillstånd, varld-motor-tillstand.js).
//
//  • Rollerna = lagrets neutrala (idle-förvärmda) poster. Målförvärmningens
//    egna poster rörs inte (de släpps när målet lämnas).
//  • En spegling per task. Samma element inom LUGN_MS (t.ex. focusin vid
//    musklicket på ett redan hovrat hus) → ingen ny spegling.
//  • Lämnas elementet: tillstånds-poster som inte längre gäller släpps (GPU
//    tillbaka till baslinjen) när transitionen landat. Den neutrala finns kvar.
// Ingen Firestore: allt läses ur DOM:en som redan står där.
// Laddas bara via import() (varld-motor-mal.js) – aldrig i bootgrafen.
// ============================================================================

import * as TX from "./varld-motor-textur.js";

const INTERAKTIV = 'button, a[href], [role="button"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';
const DWELL_MS = 60;
const FARSK_MS = 150; // en post yngre än så här speglas inte om
const LUGN_MS = 1000;

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stagets synliga lager (det som syns när en rörelse startar). */
export const aktivtLager = (stage) =>
  [...stage.querySelectorAll(":scope > .varld-lager")].find((l) => !l.inert && !l.classList.contains("varld-dold")) || null;

/**
 * @param {object} ctx
 * @param {() => HTMLElement|null} ctx.stage
 * @param {() => object|null} ctx.yta
 * @param {() => boolean} ctx.ledig
 * @param {(post:object) => boolean} ctx.agd  ägs posten av målförvärmningen?
 * @param {(info:object) => void} ctx.logga
 */
export function skapaAvsikt(ctx) {
  let nr = 0;
  let timer = null;
  let senaste = null; // { el, t } – senast påbörjade förnyelse
  let info = null;

  const klickbar = (target) => {
    const t = target?.nodeType === 1 ? target : target?.parentElement;
    const k = t?.closest?.(INTERAKTIV);
    return k && ctx.stage()?.contains(k) ? k : null;
  };

  function planera(ms, el) {
    const mitt = ++nr;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fornya(mitt, el).catch(() => {}); }, ms);
  }

  /** pointerover/focusin (capture på staget). */
  function nar(e) {
    if (!ctx.ledig()) return;
    const k = klickbar(e.target);
    if (!k) return;
    if (senaste?.el === k && performance.now() - senaste.t < LUGN_MS) return;
    planera(e.type === "focusin" || e.pointerType !== "mouse" ? 0 : DWELL_MS, k);
  }

  /** pointerout/focusout: lämnat elementet → släpp inaktuella tillstånds-poster. */
  function lamna(e) {
    const k = klickbar(e.target);
    if (!k || (e.relatedTarget && k.contains(e.relatedTarget))) return;
    if (senaste?.el === k) senaste = null;
    if (timer) { clearTimeout(timer); timer = null; nr++; }
    const stage = ctx.stage();
    const aktiv = stage && aktivtLager(stage);
    if (!aktiv) return;
    TX.klarAttSpegla(aktiv, 400).then(() => {
      if (ctx.ledig()) TX.rensaTillstand(aktiv, TX.tillstandNu(aktiv));
    });
  }

  async function fornya(mitt, el) {
    const stage = ctx.stage();
    if (mitt !== nr || !stage || !ctx.yta() || !ctx.ledig()) return;
    const aktiv = aktivtLager(stage);
    if (!aktiv) return;
    senaste = { el, t: performance.now() };
    await TX.klarAttSpegla(aktiv, 400); // hover-skalan ska vara framme
    if (mitt !== nr || !ctx.ledig()) return;
    const t0 = performance.now();
    const nu = TX.tillstandNu(aktiv);
    TX.rensaTillstand(aktiv, nu);
    const levande = TX.levandeBas(aktiv);
    const v = TX.version(aktiv);
    const byggda = [];
    let synkMs = 0;
    // Bara roller i lagrets AKTUELLA geometri (en äldre roll-nyckel med annan box
    // ligger kvar i LRU:n tills den trängs undan – den spelas aldrig mer). Scroll
    // ger inte längre någon sådan (F7 #433: stageRam), men en lagerbox kan ändras
    // utan att stagets mått gör det (layout-/klassbyte utan resize) → vakten kvar.
    const sr = TX.stageRam(stage);
    const { box } = TX.lagerGeo(aktiv, sr);
    const aktuell = (r) => Math.abs(r.vy.x + box.x) < 0.5 && Math.abs(r.vy.y + box.y) < 0.5 && Math.abs(r.vy.w - sr.width) < 0.5 && Math.abs(r.vy.h - sr.height) < 0.5;
    for (const n of TX.neutralaPoster(aktiv)) {
      if (mitt !== nr || !ctx.ledig() || ctx.agd(n) || !aktuell(n.roll)) continue;
      if (!levande && !nu) continue; // neutral bild utan levande ambient = redan exakt
      const finns = TX.postFor(TX.nyckelFor(n.roll));
      if (finns && finns.version === v && (!levande || performance.now() - finns.skapad < FARSK_MS)) continue;
      const post = TX.sakra(n.roll, { yta: ctx.yta(), prio: "nu", omspegla: levande, kalla: "avsikt" });
      synkMs += post.ms.speglaSynk || 0;
      byggda.push(post);
      await vanta(0); // en spegling per task
    }
    if (!byggda.length) return;
    info = { lager: aktiv.id, tillstand: nu, poster: byggda.map((p) => p.pid), synkMs: Math.round(synkMs), t: Math.round(t0) };
    Promise.all(byggda.map((p) => p.minSatt.catch(() => {}))).then(() => {
      if (info?.t === Math.round(t0)) info = { ...info, klarMs: Math.round(performance.now() - t0) };
      ctx.logga({ avsikt: info });
    });
  }

  /** Idle: står pekaren/fokus redan på något när lagret landat → förnya. */
  function efterIdle() {
    const stage = ctx.stage();
    const aktiv = stage && aktivtLager(stage);
    if (aktiv && TX.tillstandNu(aktiv)) planera(0, null);
  }

  function avbryt() {
    clearTimeout(timer);
    timer = null;
    nr++;
    senaste = null;
  }

  return { nar, lamna, efterIdle, avbryt, get senaste() { return info; } };
}
