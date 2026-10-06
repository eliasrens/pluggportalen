// ============================================================================
// Pluggporten – motorns FÖRVÄRMNING: idle-grannövergångar + dynamiska mål
// (#396, F4 #418 / F4b #428)
// ----------------------------------------------------------------------------
// Två källor, EN budget (konfiguration().budget.maxPar övergångar åt gången):
//
//  1. MÅL (prio "nu", går FÖRE idle). Scenen anropar forvarmMal(el) (rekommen-
//     derat), eller pointerenter/focusin på ett element som matchar lagrets
//     profil.malSelektor (t.ex. ".by-tomt[data-fokus-x]") → läs data-fokus-x/y
//     (= kamerans fokus vid klicket) och bygg YTTERLAGRETS fokus-pyramid för
//     övergången ett klick skulle starta (lagret = målets .varld-lager). Zoom:
//     data-fokus-zoom på målet, annars en registrerad nivå för lagret (alla
//     kameror – målets egen kamera behöver INTE finnas än: kompis-/grannby-
//     kamerorna skapas lat; roll-nyckeln matchar ändå när den väl spelar),
//     annars profil.zoom. Innerlagret
//     byggs när det är känt: data-fokus-lager="<id>" på målet, eller när
//     scenen anropar forvarmLager(lagerEl) efter att ha förrenderat det
//     (kompis-/grannbyhuset i det dolda lagret). Med mus väntar vi DWELL_MS
//     (ett svep över 25 tomter värmer inget); touch/fokus startar direkt.
//     Max ett mål åt gången. Pekaren/fokus lämnar målet → jobbet avbryts och
//     målets EGNA pyramider släpps (Yta.stats() tillbaka till baslinjen) –
//     pyramider som redan fanns (t.ex. egna tomten = idle-förvärmd) rörs inte.
//     Klicket: kamerans gaTill → motorns handoff → overlat(): målets pyramider
//     blir vanliga cache-poster och sakra() i handoffen hittar dem (samma
//     roll-nyckel) → ingen ny pyramid behövs.
//  2. IDLE efter landning (stage[data-niva]): nivåns grannövergångar, max
//     maxPar minus ett pågående mål (på "svag", maxPar 1, väntar idle helt).
//     Ett tomt innerlager (grannbyn innan klicket laddat den) hindrar inte
//     ytterrollen; innerrollen byggs när lagret fylls (MutationObserver →
//     ny förvärmning) eller vid handoff.
//
// Ingen Firestore: allt läses ur DOM:en som redan står där.
// Laddas bara via import() (varld-motor.js) – aldrig i bootgrafen.
// ============================================================================

import * as TX from "./varld-motor-textur.js";
import { konfiguration } from "./varld-textur.js";

const DWELL_MS = 60;
const sel = (v) => (Array.isArray(v) ? v.join(",") : v || "");
const tal = (v) => (v != null && v !== "" && Number.isFinite(+v) ? +v : null);

/**
 * @param {object} ctx  motorns tillstånd (getters)
 * @param {() => HTMLElement|null} ctx.stage
 * @param {() => object|null} ctx.yta
 * @param {Set<object[]>} ctx.kameror  registrerade nivålistor
 * @param {() => boolean} ctx.ledig   får vi förvärma nu (ingen rörelse, renderare vid liv …)?
 * @param {(post:object) => void} ctx.logga  debug-logg för målförvärmningen
 */
export function skapaForvarmare(ctx) {
  let mal = null; // { el, lager, fokus, zoom, inre, timer, startad, poster:[{post,egen,roll}], t0, id }
  let malNr = 0;
  let senasteMal = null;
  let lyssnare = null;

  // ---- Nivåer --------------------------------------------------------------------

  /** Den registrerade nivån för ett lager (zoom är lagrets, oavsett kamera). */
  function nivaFor(lagerEl) {
    for (const nivaer of ctx.kameror) {
      const n = nivaer.find((x) => x.el === lagerEl);
      if (n && n.el.isConnected) return n;
    }
    return null;
  }

  // ---- Mål ---------------------------------------------------------------------

  const lagerFor = (el) => {
    const lager = el?.closest?.(".varld-lager");
    return lager && lager.parentElement === ctx.stage() ? lager : null;
  };

  /** Ett mål-element (bär data-fokus-x/y) → målbeskrivning, eller null. */
  function beskriv(el, lager) {
    const x = tal(el?.dataset?.fokusX), y = tal(el?.dataset?.fokusY);
    return lager && x != null && y != null ? { el, lager, fokus: { x, y } } : null;
  }

  /** Målet (malSelektor-elementet) för en händelse, eller null. */
  function malFor(target) {
    const t = target?.nodeType === 1 ? target : target?.parentElement;
    const lager = lagerFor(t);
    const ms = lager && sel(TX.profilFor(lager).malSelektor);
    if (!ms) return null;
    let el = null;
    try { el = t.closest(ms); } catch { return null; }
    return el && lager.contains(el) ? beskriv(el, lager) : null;
  }

  function borja(m, direkt) {
    if (mal?.el === m.el) {
      if (direkt && !mal.startad) starta(mal);
      return;
    }
    avbryt("bytt");
    mal = { ...m, id: ++malNr, inre: null, timer: null, startad: false, poster: [], t0: performance.now() };
    const inreId = m.el.dataset.fokusLager;
    if (inreId) mal.inre = ctx.stage().querySelector(`:scope > #${CSS.escape(inreId)}`);
    if (direkt) starta(mal);
    else mal.timer = setTimeout(() => starta(mal), DWELL_MS);
  }

  function nar(e) {
    if (!ctx.ledig()) return;
    const m = malFor(e.target);
    if (m) borja(m, e.type === "focusin" || e.pointerType !== "mouse");
  }

  /**
   * Scen-API: förvärm övergången som ett klick på `el` skulle starta (el bär
   * data-fokus-x/y, ev. data-fokus-lager/-zoom). null avbryter. Att pekaren
   * eller fokus lämnar `el` avbryter också. @returns {boolean} startad/pågår
   */
  function forvarmMal(el) {
    if (!el) { avbryt("scen"); return false; }
    const m = beskriv(el, lagerFor(el));
    if (!m || !ctx.ledig()) return false;
    borja(m, true);
    return mal?.el === el;
  }

  function lamna(e) {
    if (!mal) return;
    const till = e.relatedTarget;
    if (till && mal.el.contains(till)) return; // rör sig inom målet
    avbryt("lamnad");
  }

  function starta(m) {
    if (m !== mal || m.startad) return;
    m.timer = null;
    if (!ctx.ledig() || !m.el.isConnected) return;
    m.zoom = tal(m.el.dataset.fokusZoom) || nivaFor(m.lager)?.zoom || tal(TX.profilFor(m.lager).zoom);
    if (!m.zoom) { notera(m, "ingen-zoom"); return; }
    m.startad = true;
    const sr = ctx.stage().getBoundingClientRect();
    const g = TX.lagerGeo(m.lager, sr);
    if (!g.box.w || !g.box.h) { notera(m, "ingen-box"); return; }
    sakraEgen(m, "Y", TX.roll(m.lager, g, m.fokus, 1, m.zoom, sr));
    if (m.inre) byggInre(m);
    notera(m, "startad");
  }

  function byggInre(m) {
    const el = m.inre;
    if (!el?.isConnected || !el.childElementCount) return;
    const sr = ctx.stage().getBoundingClientRect();
    const g = TX.lagerGeo(el, sr);
    if (!g.box.w || !g.box.h) return;
    sakraEgen(m, "I", TX.roll(el, g, m.fokus, 1 / m.zoom, 1, sr));
  }

  /** sakra() med prio "nu"; en NY post ägs av målet tills klick/avbrott. */
  function sakraEgen(m, roll, r) {
    const yta = ctx.yta();
    if (!yta) return;
    const fore = TX.postFor(r.nyckel);
    const post = TX.sakra(r, { yta, prio: "nu", kalla: "mal" });
    if (m.poster.some((p) => p.post === post)) return; // samma lager förvärmt igen
    const egen = post !== fore; // (blir den ett alias för `fore` släpps inget av den)
    m.poster.push({ post, egen, roll, lager: r.el.id });
    post.minSatt.then(
      () => { if (m === mal) notera(m, `${roll}-klar`, { [`${roll}ms`]: Math.round(post.ms.minimum ?? 0) }); },
      () => {},
    );
  }

  /** Avbryt målet: släpp dess egna (ej lånade) pyramider. */
  function avbryt(orsak) {
    const m = mal;
    if (!m) return;
    mal = null;
    clearTimeout(m.timer);
    for (const { post, egen } of m.poster) if (egen) TX.slappOmLedig(post);
    if (m.startad) notera(m, orsak);
  }

  /** Klicket kom: målets pyramider blir vanliga cache-poster (släpps inte). */
  function overlat() {
    const m = mal;
    if (!m) return null;
    mal = null;
    clearTimeout(m.timer);
    if (m.startad) notera(m, "klickad");
    return m;
  }

  /**
   * Scenen har förrenderat målets innerlager (dolt) → bygg dess pyramid för
   * det aktuella målets fokus. @returns {boolean} fanns ett mål att värma för
   */
  function forvarmLager(lagerEl) {
    const m = mal;
    if (!m || !lagerEl?.isConnected || lagerEl.parentElement !== ctx.stage()) return false;
    m.inre = lagerEl;
    if (m.startad) byggInre(m);
    return true;
  }

  function notera(m, status, extra = {}) {
    senasteMal = {
      ...(senasteMal?.id === m.id ? senasteMal : {}),
      id: m.id, lager: m.lager.id, fokus: m.fokus, inre: m.inre?.id || null, status,
      ms: Math.round(performance.now() - m.t0),
      poster: m.poster.map(({ post, egen, roll }) => ({ roll, pid: post.pid, egen, minKlar: post.minKlar })),
      ...extra,
    };
    ctx.logga(senasteMal);
  }

  // ---- Idle-grannövergångar ----------------------------------------------------

  /** Bygg den aktiva nivåns grannövergångar (max maxPar, efter ett pågående mål). */
  function forvarm() {
    const stage = ctx.stage(), yta = ctx.yta();
    if (!stage || !yta || !ctx.ledig()) return;
    const aktiv = [...stage.querySelectorAll(":scope > .varld-lager")].find((l) => !l.inert && !l.classList.contains("varld-dold"));
    if (!aktiv) return;
    const par = [];
    for (const nivaer of ctx.kameror) {
      if (!stage.contains(nivaer[0]?.el)) { ctx.kameror.delete(nivaer); continue; }
      const k = nivaer.findIndex((n) => n.el === aktiv);
      if (k > 0) par.push([nivaer[k - 1], nivaer[k]]);
      if (k >= 0 && k < nivaer.length - 1) par.push([nivaer[k], nivaer[k + 1]]);
    }
    const maxPar = konfiguration().budget.maxPar - (mal?.startad ? 1 : 0);
    const sr = stage.getBoundingClientRect();
    const sedda = new Set();
    for (const [Y, I] of par) {
      const nyckel = `${Y.el.id}>${I.el.id}>${Y.fokus.x},${Y.fokus.y}`;
      // Tomt ytterlager (byn innan laddaBy) → inget att förvärma; tomt
      // innerlager → bara ytterrollen. Ingen data hämtas här.
      if (sedda.has(nyckel) || !Y.el.childElementCount) continue;
      if (sedda.size >= maxPar) break;
      sedda.add(nyckel);
      byggPar(Y, I, sr, yta, "idle");
    }
  }

  /** Båda rollerna för övergången Y → I (tomma lager hoppas över). */
  function byggPar(Y, I, sr, yta, prio) {
    const roller = [[Y, TX.lagerGeo(Y.el, sr), 1, Y.zoom], [I, TX.lagerGeo(I.el, sr), 1 / Y.zoom, 1]];
    for (const [niva, g, zMin, zMax] of roller) {
      if (!niva.el.childElementCount || !g.box.w || !g.box.h) continue;
      // Lager med levande ambient (utanför sprites) speglas om vid handoff
      // ändå; förvärmningen är bara reserven → högst var 4:e sekund.
      TX.sakra(TX.roll(niva.el, g, Y.fokus, zMin, zMax, sr), { yta, prio, tak: TX.levandeBas(niva.el) ? 4000 : 0 });
    }
  }

  /**
   * Scen-API (I1 #426): förvärma EN känd övergång direkt (prio "nu"), t.ex.
   * hus → gård vid hover på "Till gården"-skylten (den ligger i .varld-ui,
   * inte i ett lager, så målmekanismen gäller inte). Y/I = registrerade
   * nivåer {el, fokus, zoom}. @returns {boolean} byggs
   */
  function forvarmOvergang(Y, I) {
    const stage = ctx.stage(), yta = ctx.yta();
    if (!stage || !yta || !ctx.ledig() || !Y?.el?.isConnected || !I?.el?.isConnected) return false;
    if (!Y.el.childElementCount || !(Y.zoom > 0)) return false;
    byggPar(Y, I, stage.getBoundingClientRect(), yta, "nu");
    return true;
  }

  // ---- Livscykel ----------------------------------------------------------------

  /** Lyssna på stagets mål (ersätter tidigare stage). */
  function koppla(stage) {
    slappa();
    lyssnare = new AbortController();
    // Capture: målet finns INNAN scenens egen hover-hanterare (på lagret)
    // förrenderar innerlagret och anropar forvarmLager().
    const o = { signal: lyssnare.signal, passive: true, capture: true };
    stage.addEventListener("pointerover", nar, o);
    stage.addEventListener("focusin", nar, o);
    stage.addEventListener("pointerout", lamna, o);
    stage.addEventListener("focusout", lamna, o);
  }

  function slappa() {
    lyssnare?.abort();
    lyssnare = null;
    avbryt("ny-scen");
  }

  return {
    koppla, slappa, forvarm, forvarmLager, forvarmMal, forvarmOvergang, overlat,
    avbryt: () => avbryt("avbruten"),
    get mal() { return mal ? { id: mal.id, lager: mal.lager.id, fokus: mal.fokus, startad: mal.startad } : null; },
    get senasteMal() { return senasteMal; },
  };
}
