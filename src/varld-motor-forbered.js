// ============================================================================
// Pluggporten – rörelse-motorns förberedelse (steg 1–2 i handoffen, #396)
// ----------------------------------------------------------------------------
// Utbruten ur varld-motor.js (F4b #428, 400-raderstaket). Säkrar båda lagrens
// pyramider för övergångsrollerna (återanvänder förvärmda – idle eller mål –
// när roll-nyckel + version stämmer), speglar om basen när lagret har levande
// ambient utanför profilens sprites, lägger sprites + hovrat objekt som
// överlägg i frusen pose och bygger animationens fran/till-tillstånd.
// Laddas bara via import() (varld-motor.js) – aldrig i bootgrafen.
// ============================================================================

import { lagerState } from "./varld-render-anim.js";
import * as TX from "./varld-motor-textur.js";
import { overlagg } from "./varld-motor-overlagg.js";
import { sattPose } from "./varld-motor-pose.js";

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
const tills = (t) => vanta(Math.max(0, t - performance.now()));

/**
 * Längsta väntan när varje lager redan HAR något spelbart (ny bild eller
 * förvärmd reserv) och bara omspeglingen saknas (I1 #426, G1 §6.6.1). Då är
 * väntan ren fördröjning för eleven – reserven har rätt innehåll, ambienten
 * står bara i förvärmningens pose. Kall övergång (inget spelbart) väntar
 * fortfarande till `deadline` (VANTA_MAX_MS 250), sedan CSS.
 */
export const RESERV_MAX_MS = 120;

/**
 * Vänta på texturerna: tills `klart` löser, eller `deadline` passeras, eller
 * – om `spelbart()` är sant vid `reservTill` – redan då.
 * @param {Promise<unknown>} klart  alla nya pyramider/överlägg klara
 * @param {() => boolean} spelbart  har båda lagren en ny bild eller reserv?
 * @param {number} deadline   performance.now()-tid för kall övergång
 * @param {number} reservTill performance.now()-tid när reserven räcker
 * @returns {Promise<"klart"|"reserv"|"deadline">}
 */
export function vantaTexturer(klart, spelbart, deadline, reservTill = deadline) {
  const reserv = tills(Math.min(reservTill, deadline))
    .then(() => (spelbart() ? "reserv" : tills(deadline).then(() => "deadline")));
  return Promise.race([klart.then(() => "klart", () => "klart"), tills(deadline).then(() => "deadline"), reserv]);
}

/**
 * 1–2 i handoffen: säkra pyramider (+ överlägg) och bygg animationens tillstånd.
 * @param {{yttre:object, inre:object, riktning:"in"|"ut"}} spec
 * @param {ReturnType<import("./varld-vila.js").vila>} slapp  vilan (pausade animationer)
 * @param {number} deadline  performance.now()-tid då vi slutar vänta på texturer
 * @param {{stage:HTMLElement, yta:object, reservTill?:number}} o  reservTill:
 *   performance.now()-tid då en färdig reserv räcker (se RESERV_MAX_MS)
 * @returns {Promise<{orsak:string} | {fran:object[], till:object[], info:object, sattPose:() => void, slappa:() => void}>}
 */
export async function forbered(spec, slapp, deadline, { stage, yta, reservTill = deadline }) {
  const t0 = performance.now();
  const sr = stage.getBoundingClientRect();
  const Y = spec.yttre, I = spec.inre;
  const gY = TX.lagerGeo(Y.el, sr), gI = TX.lagerGeo(I.el, sr);
  if (!gY.box.w || !gY.box.h || !gI.box.w || !gI.box.h) return { orsak: "ingen-box" };
  const Z = Y.zoom;
  const rY = TX.roll(Y.el, gY, Y.fokus, 1, Z, sr);
  const rI = TX.roll(I.el, gI, Y.fokus, 1 / Z, 1, sr);
  // Synkront: speglingar och överlägg medan DOM:en är frusen. Basen speglas
  // om bara vid levande ambient UTANFÖR sprites; sprites + hovrat objekt
  // (basen ritar det i vila-läge) läggs alltid som överlägg i frusen pose.
  const omY = TX.levandeBas(Y.el, slapp.pausade), omI = TX.levandeBas(I.el, slapp.pausade);
  const pY = TX.sakra(rY, { yta, prio: "nu", omspegla: omY });
  const pI = TX.sakra(rI, { yta, prio: "nu", omspegla: omI });
  const oY = overlagg(Y.el, Z, yta);
  const oI = overlagg(I.el, 1, yta);
  const ovl = [...oY.ids, ...oI.ids];
  const slappOvl = () => ovl.forEach((id) => yta.slappLager(id));
  const klart = Promise.all([pY.minSatt, pI.minSatt, oY.klart.catch(() => {}), oI.klart.catch(() => {})]);
  // Hann en omspegling inte i tid: spela på den förvärmda pyramiden (reserven)
  // – rätt innehåll, men ambienten i förvärmningens pose (S-profilerna gör
  // omspeglingen billig nog). Saknas båda → CSS-vägen.
  const ny = (p) => p.alias || p; // identisk bild → reserven återanvänd
  const valj = (p) => (ny(p).minKlar && !ny(p).slappt ? ny(p) : p.reserv?.minKlar && !p.reserv.slappt ? p.reserv : null);
  const vantan = await vantaTexturer(klart, () => !!(valj(pY) && valj(pI)), deadline, reservTill);
  const aY = valj(pY), aI = valj(pI);
  if (!aY || !aI) {
    slappOvl();
    return { orsak: "vanta" };
  }
  const lamna = [TX.lana(aY), TX.lana(aI)];
  const inaktuella = [aY !== ny(pY) && Y.id, aI !== ny(pI) && I.id].filter(Boolean);
  const geo = [
    { id: "Y", box: gY.box, fokus: Y.fokus, zoom: Z },
    { id: "I", box: gI.box, fokus: I.fokus, zoom: I.zoom },
  ];
  const inAt = spec.riktning === "in";
  const fran = inAt ? lagerState(geo, 0, 0) : lagerState(geo, 1, 1);
  const till = inAt ? lagerState(geo, 1, 0) : lagerState(geo, 0, 0);
  // Varje pyramidnivå/överlägg är en egen behållare med lagrets transform.
  const bred = (states) => states.flatMap((l, j) => [
    ...(j ? aI : aY).ids.map(({ id, z }) => ({ ...l, id, zFran: z })),
    ...(j ? oI : oY).ids.map((id) => ({ ...l, id })),
  ]);
  const info = {
    omspeglade: [omY && Y.id, omI && I.id].filter(Boolean), inaktuella, overlagg: ovl.length, sprites: oY.sprites + oI.sprites,
    // Vem byggde pyramiderna som spelades, och fanns de redan före klicket?
    kallor: [aY.kalla, aI.kalla], ateranvanda: [aY.skapad < t0 && Y.id, aI.skapad < t0 && I.id].filter(Boolean),
    pyramider: [pY.ms, pI.ms], vantan, vantaMs: Math.round(performance.now() - t0),
  };
  return {
    fran: bred(fran), till: bred(till), info,
    /**
     * F5 #431: lager som spelas på reserven får DOM-ambienten satt till
     * reservens pose. Anropas i SAMMA task som DOM:en göms (.varld-pixi-spelar)
     * – canvas och DOM visar då samma pose när de byts vid slutet. Färsk
     * spegel (eller identisk bild, alias) → inget görs. info.pose: per lager.
     */
    sattPose() {
      const pose = {};
      for (const [a, p, L] of [[aY, pY, Y], [aI, pI, I]]) {
        if (a !== ny(p)) pose[L.id] = sattPose(L.el, a.pose, slapp.pausade);
      }
      if (Object.keys(pose).length) info.pose = pose;
    },
    slappa() {
      slappOvl();
      lamna.forEach((f) => f());
    },
  };
}
