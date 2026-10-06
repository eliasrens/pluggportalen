// ============================================================================
// Pluggporten – motorns RESIZE: nivåns egen höjd vs äkta resize (#396, F8 #434)
// ----------------------------------------------------------------------------
// På mobil (≤ 700 px) har rummet en egen stage-höjd (styles.css, rum-regeln:
// 580 → 452 px vid 390×700). Höjden byts när kameran LANDAR: onNiva →
// updateUi → stage[data-niva]. Rörelsen spelas alltså alltid i startnivåns
// geometri, precis som CSS-vägen (DOM-lagren fyller staget, som behåller sin
// höjd tills landningen). Två sorters resize:
//
//  • "niva"  – data-niva har bytts (sedan förra mätningen, eller inom
//              NIVA_FONSTER_MS) och viewport + dpr är oförändrade. Pyramiderna
//              behålls: rollnyckeln (varld-motor-textur.js roll()) kodar lagrets
//              box, stagets vy och dpr, så en pyramid spelas bara i exakt den
//              geometri den speglades i. Rummets 452-roller byggs i idle efter
//              landningen; husets 580-roller ligger kvar och återanvänds nästa
//              gång staget är 580 (T3 in igen). Pågående rörelse som mättes i
//              en annan storlek LANDAR (ctx.landa): DOM:en står redan i
//              slutläget → den visas i samma task som höjdbytet (MutationObserver
//              på data-niva, före paint) – ingen sträckt canvas-frame, loggen
//              behålls. En rörelse som fortfarande förbereds avbryts (som idag).
//  • "akta"  – viewport eller dpr ändrad (rotation, fönster, webbläsarzoom):
//              som idag – avbryt, invalidera ALLA pyramider (ctx.resize).
// Valet (a) i #434 utan förmätning: målnivåns höjd behöver inte mätas före
// rörelsen (det skulle kräva att data-niva växlas och lagret layoutas om i
// klicket), eftersom den förväntade resizen känns igen på nivåbytet.
// Loggen (window.__ppPixi.motor.resize): { typ, fran, till, niva, spel, rensaAllt, t }.
// Ingen Firestore. Laddas bara via varld-motor.js (import()) – aldrig i bootgrafen.
// ============================================================================

/** En stage-resize så här nära ett data-niva-byte räknas till nivån. */
export const NIVA_FONSTER_MS = 1000;
const LOGG_MAX = 12;

/** Stagets mått (dpr ≤ 2) + viewporten och nivån i samma ögonblick. */
export function mattAv(stage, win = globalThis.window) {
  return {
    w: stage.clientWidth, h: stage.clientHeight, dpr: Math.min(win?.devicePixelRatio || 1, 2),
    vw: win?.innerWidth ?? 0, vh: win?.innerHeight ?? 0, niva: stage.dataset?.niva || "",
  };
}

/** Ytans mått-nyckel (samma format som tidigare `ytMatt`). */
export const nyckelAv = (m) => `${m.w}x${m.h}@${m.dpr}`;

/**
 * Klassa en stage-resize (ren funktion, testas med node --test).
 * @param {ReturnType<typeof mattAv>|null} fore  förra mätningen (null = ny scen)
 * @param {ReturnType<typeof mattAv>} nu
 * @param {number} nivaT  performance.now() för senaste data-niva-bytet
 * @param {number} t      nu
 * @returns {"niva"|"akta"}
 */
export function klassa(fore, nu, nivaT = -Infinity, t = 0) {
  if (!fore || fore.vw !== nu.vw || fore.vh !== nu.vh || fore.dpr !== nu.dpr) return "akta";
  return fore.niva !== nu.niva || t - nivaT < NIVA_FONSTER_MS ? "niva" : "akta";
}

/**
 * @param {object} ctx
 * @param {() => HTMLElement|null} ctx.stage
 * @param {() => object|null} ctx.yta
 * @param {() => object|null} ctx.spel            pågående rörelse (eller null)
 * @param {(nyckel:string) => string|null} ctx.landa  rörelsen mättes i en annan storlek
 * @param {(m:object, akta:boolean) => void} ctx.resize  ytan till m; akta → avbryt + rensaAllt
 * @param {() => void} ctx.schemaForvarm          landning → idle-förvärmning
 * @param {(post:object) => void} [ctx.logga]
 */
export function skapaResizeVakt(ctx) {
  let ro = null;
  let mo = null;
  let senast = null; // förra mätningen (mattAv)
  let ytMatt = "";   // ytans nuvarande storlek (nyckelAv)
  let nivaT = -Infinity;
  const logg = [];
  const nu = () => performance.now();
  const matt = () => mattAv(ctx.stage());

  /** Bevaka ett nytt stage (ersätter tidigare). Nästa mätning räknas som äkta. */
  function koppla(stage) {
    slappa();
    ro = new ResizeObserver(() => kolla());
    ro.observe(stage);
    mo = new MutationObserver(nivaBytt);
    mo.observe(stage, { attributes: true, attributeFilter: ["data-niva"] });
  }

  function slappa() {
    ro?.disconnect();
    mo?.disconnect();
    ro = mo = null;
    senast = null;
  }

  /** Ytan skapades i måtten m. */
  function skapad(m) {
    senast = m;
    ytMatt = nyckelAv(m);
  }

  /**
   * Landning (updateUi satte data-niva): förvärm, och landa en pågående
   * rörelse redan NU om staget bytt storlek under den – före paint, så ingen
   * frame visar canvasen sträckt till den nya höjden.
   */
  function nivaBytt() {
    nivaT = nu();
    ctx.schemaForvarm();
    if (!ctx.spel() || !ctx.yta() || !ctx.stage()) return;
    const m = matt();
    if (m.w && m.h && nyckelAv(m) !== ytMatt && klassa(senast, m, nivaT, nu()) === "niva") ctx.landa(nyckelAv(m));
  }

  /** ResizeObserver (och kopplaCanvas): ytan till stagets storlek. */
  function kolla() {
    if (!ctx.stage() || !ctx.yta()) return;
    const m = matt();
    if (!m.w || !m.h) return;
    const typ = klassa(senast, m, nivaT, nu());
    senast = m;
    const till = nyckelAv(m);
    if (till === ytMatt) return;
    const post = { typ, fran: ytMatt, till, niva: m.niva, t: Math.round(nu()) };
    ytMatt = till;
    if (typ === "niva" && ctx.spel()) post.spel = ctx.landa(till);
    ctx.resize(m, typ === "akta");
    post.rensaAllt = typ === "akta";
    logg.push(post);
    if (logg.length > LOGG_MAX) logg.shift();
    ctx.logga?.(post);
  }

  return {
    koppla, slappa, skapad, kolla, matt,
    /** Stagets mått-nyckel nu (rörelsens geometri, jämförs vid landningen). */
    nyckelNu: () => nyckelAv(matt()),
    get logg() { return logg.slice(); },
  };
}
