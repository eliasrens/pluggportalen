// ============================================================================
// Schack – lärarens sektion "Schack" i klassens sidor (#781, spec §10).
//
//   1. Modulen på/av för klassen (enabledModules, samma skrivning som Synlighet).
//   2. Pågående partier ur schackKlass/{classId}.partier → åskådarläget live
//      (schack-larare-askadare.js).
//   3. Avsluta parti (bekräftelseruta på sidan) → callable schackLarareAvsluta.
//   4. Topplistan: se, dölj/visa (dold), nollställ → schackLarareTopplista.
//   5. Statistik per elev: mot kompisar (tabell.partier, ur samma lyssnare) och
//      mot datorn (studentData.schack.datorPartier, bara på knapptryck).
//
// Lyssnare: EN onSnapshot på schackKlass/{classId} medan sektionen är öppen,
// plus EN på partiet i åskådarläget. Båda stängs av vakten (skapaVakt) när
// värden lämnar DOM:en (annan flik/klass/sida) eller vid hashchange.
// Laddas bara med import() från teacher-classes-sections.js (#271).
// ============================================================================

import { modulAndring, okandaId, partiRader, schackPa, skapaNamnFor, skapaVakt, statistikRader, topplista } from "./schack-larare-delar.js";
import { esc, modulHtml, partiListaHtml, statistikHtml, topplistaHtml } from "./schack-larare-markup.js";

const CSS_URL = new URL("./schack-larare.css", import.meta.url).href;
// Datorpartierna per klass, hämtade under sessionen (läses bara på knapptryck).
const datorCache = new Map();

function laddaCss() {
  if (document.querySelector('link[data-schack-larare-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_URL;
  link.dataset.schackLarareCss = "1";
  document.head.appendChild(link);
}

/** Serverns fel i lärarens ord. */
export function felText(err) {
  switch (err?.code) {
    case "permission-denied": return "Du har inte behörighet till den här klassens schack.";
    case "failed-precondition": return "Partiet var redan slut.";
    case "not-found": return "Hittade inte klassen.";
    case "unauthenticated": return "Du är utloggad – logga in igen.";
    default: return err?.message || "Det gick inte just nu – försök igen.";
  }
}

/** Sätt innerHTML bara om markupen ändrats (behåller fokus vid ointressanta ändringar). */
function satt(el, html) {
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
}

/**
 * Rendera sektionen för klassen `cls` i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: hiddenModules/enabledModules vid på/av)
 * @param {HTMLElement} host
 * @param {{ students?: object[] }} [o]  lärarsidans redan laddade elevlista (namnen, 0 läsningar)
 */
export async function renderSchackSektion(ctx, cls, host, { students = [] } = {}) {
  laddaCss();
  const [moln, data] = await Promise.all([import("../schack-moln.js"), import("../../data.js")]);
  const klassNamn = cls.name || cls.id;
  host.innerHTML = `<div class="sl">
    <section class="cls-block sl-block sl-modul" aria-labelledby="sl-h-modul">
      <h3 id="sl-h-modul" class="sl-h">Schack för klassen</h3><div class="sl-modul-innehall"></div>
    </section>
    <section class="cls-block sl-block sl-partier-block" aria-labelledby="sl-h-partier">
      <h3 id="sl-h-partier" class="sl-h">Pågående partier <span class="sl-antal"></span></h3>
      <div class="sl-partier-innehall"><div class="spinner">Laddar partierna…</div></div>
    </section>
    <section class="cls-block sl-block sl-topp" aria-labelledby="sl-h-topp">
      <h3 id="sl-h-topp" class="sl-h">Topplistan</h3>
      <p class="hint">Bara partier mot kompisar räknas. Alla börjar på 1000 poäng; ingen kan hamna under 800.</p>
      <div class="sl-topp-innehall"></div>
    </section>
    <section class="cls-block sl-block sl-stat" aria-labelledby="sl-h-stat">
      <h3 id="sl-h-stat" class="sl-h">Statistik</h3><div class="sl-stat-innehall"></div>
    </section>
  </div>`;
  const $ = (s) => host.querySelector(s);
  const modulEl = $(".sl-modul-innehall");
  const partierEl = $(".sl-partier-innehall");
  const antalEl = $(".sl-antal");
  const toppEl = $(".sl-topp-innehall");
  const statEl = $(".sl-stat-innehall");

  // Kvar = värden sitter i DOM:en OCH routen är samma sida (en ny route kan rita
  // sin vy först efter att den läst klart – då stängs lyssnarna redan vid hashchange).
  const route = location.hash.split("?")[0];
  const vakt = skapaVakt(() => host.isConnected && location.hash.split("?")[0] === route);
  const studentIds = Array.isArray(cls.studentIds) ? cls.studentIds : [];
  let klass = null;
  let namnFor = skapaNamnFor(students);
  let projektionBegard = false;
  const ui = {
    bekrafta: null, upptagen: null, fel: "", // partilistan
    toppBekrafta: false, toppUpptagen: false, toppRes: null, modulRes: null, // { ok, text }
    hamtar: false, datorFel: "",
    askadare: null, // { id, stang }
  };

  // --- 1. Modulen ------------------------------------------------------------
  function ritaModul() {
    satt(modulEl, modulHtml({ pa: schackPa(cls), klassNamn, antalPartier: klass ? partiRader(klass.partier).length : 0, resultat: ui.modulRes }));
  }
  modulEl.addEventListener("click", async (e) => {
    const knapp = e.target.closest("[data-modul]");
    if (!knapp) return;
    const pa = knapp.dataset.modul === "pa";
    const { hidden, enabled } = modulAndring(cls, pa);
    knapp.disabled = true;
    knapp.textContent = "Sparar…";
    try {
      cls.hiddenModules = await data.setClassHiddenModules(cls.id, hidden, enabled);
      cls.enabledModules = enabled;
      ui.modulRes = { ok: true, text: `Sparat – schack är ${pa ? "på" : "av"}.` };
    } catch (err) {
      ui.modulRes = { ok: false, text: `Kunde inte spara: ${err.message}` };
    }
    delete modulEl.dataset.html;
    ritaModul();
    modulEl.querySelector("[data-modul]")?.focus();
  });

  // --- 2–3. Partierna ----------------------------------------------------------
  async function avsluta(id) {
    ui.upptagen = id;
    ritaPartier();
    try {
      await moln.larare.avsluta(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, fel: felText(err) };
    } finally {
      ui.upptagen = null;
      ui.bekrafta = null;
      ritaPartier();
    }
  }

  function ritaPartier() {
    if (!klass) return;
    const rader = partiRader(klass.partier);
    antalEl.textContent = rader.length ? `(${rader.length})` : "";
    if (ui.askadare) return; // åskådarläget står i blocket
    if (ui.bekrafta && !rader.some((r) => r.id === ui.bekrafta)) ui.bekrafta = null;
    satt(partierEl, partiListaHtml(rader, { bekrafta: ui.bekrafta, upptagen: ui.upptagen, fel: ui.fel, vantar: Object.keys(klass.vantar).length }));
  }

  async function titta(id) {
    const rad = partiRader(klass?.partier).find((r) => r.id === id);
    if (!rad) return;
    ui.askadare = { id, stang: null };
    delete partierEl.dataset.html;
    partierEl.innerHTML = "";
    const stang = await oppna(rad);
    if (ui.askadare?.id === id) ui.askadare.stang = stang;
    else stang();
  }
  async function oppna(rad) {
    const { oppnaAskadare } = await import("./schack-larare-askadare.js");
    return oppnaAskadare(partierEl, { rad, moln, vakt, avsluta, onTillbaka: tillbaka });
  }
  function tillbaka() {
    ui.askadare?.stang?.();
    ui.askadare = null;
    delete partierEl.dataset.html;
    partierEl.innerHTML = "";
    ritaPartier();
    partierEl.querySelector("[data-titta]")?.focus();
  }

  partierEl.addEventListener("click", async (e) => {
    if (ui.askadare) return; // åskådarläget har egna knappar
    const t = e.target.closest("[data-titta]");
    if (t) return titta(t.dataset.titta);
    const a = e.target.closest("[data-avsluta]");
    if (a) {
      ui.bekrafta = a.dataset.avsluta;
      ui.fel = "";
      ritaPartier();
      partierEl.querySelector(".sl-bekrafta [data-nej]")?.focus();
      return;
    }
    if (e.target.closest(".sl-bekrafta [data-nej]")) {
      const id = ui.bekrafta;
      ui.bekrafta = null;
      ritaPartier();
      partierEl.querySelector(`[data-avsluta="${CSS.escape(id || "")}"]`)?.focus();
      return;
    }
    const ja = e.target.closest(".sl-bekrafta [data-ja]");
    if (ja && !ui.upptagen) {
      const r = await avsluta(ja.dataset.ja);
      ui.fel = r.ok ? "" : r.fel;
      ritaPartier();
    }
  });

  // --- 4. Topplistan -------------------------------------------------------------
  function ritaTopp() {
    if (!klass) return;
    satt(toppEl, topplistaHtml(topplista(klass.tabell, namnFor), { dold: klass.dold, bekrafta: ui.toppBekrafta, upptagen: ui.toppUpptagen, resultat: ui.toppRes }));
  }
  async function toppAnrop(opt, klart) {
    ui.toppUpptagen = true;
    ui.toppRes = null;
    ritaTopp();
    try {
      await moln.larare.topplista(cls.id, opt);
      ui.toppRes = { ok: true, text: klart };
    } catch (err) {
      ui.toppRes = { ok: false, text: felText(err) };
    }
    ui.toppUpptagen = false;
    ui.toppBekrafta = false;
    ritaTopp(); // lyssnaren ritar den nya listan när servern skrivit
    toppEl.querySelector("[data-dold]")?.focus();
  }
  toppEl.addEventListener("click", (e) => {
    const d = e.target.closest("[data-dold]");
    if (d) return toppAnrop({ dold: d.dataset.dold === "dolj" }, d.dataset.dold === "dolj" ? "Topplistan är dold för eleverna." : "Eleverna ser topplistan igen.");
    if (e.target.closest("[data-nollstall]")) {
      ui.toppBekrafta = true;
      ui.toppRes = null;
      ritaTopp();
      toppEl.querySelector(".sl-bekrafta [data-nej]")?.focus();
      return;
    }
    if (e.target.closest(".sl-bekrafta [data-nej]")) {
      ui.toppBekrafta = false;
      ritaTopp();
      toppEl.querySelector("[data-nollstall]")?.focus();
      return;
    }
    if (e.target.closest(".sl-bekrafta [data-ja]") && !ui.toppUpptagen) toppAnrop({ nollstall: true }, "Topplistan är nollställd.");
  });

  // --- 5. Statistiken ------------------------------------------------------------
  function ritaStat() {
    const dator = datorCache.get(cls.id) || null;
    const rader = statistikRader(studentIds, { tabell: klass?.tabell || {}, dator, namnFor });
    satt(statEl, statistikHtml(rader, { datorHamtad: !!dator, hamtar: ui.hamtar, fel: ui.datorFel }));
  }
  statEl.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-dator]") || ui.hamtar) return;
    ui.hamtar = true;
    ui.datorFel = "";
    ritaStat();
    try {
      const { lasDatorPartier } = await import("./schack-larare-data.js");
      const m = await lasDatorPartier(studentIds);
      datorCache.set(cls.id, m);
      if ([...m.values()].some((v) => v == null)) ui.datorFel = "Några elevers partier gick inte att läsa (visas som –).";
    } catch (err) {
      ui.datorFel = `Kunde inte hämta: ${err.message}`;
    }
    ui.hamtar = false;
    if (host.isConnected) ritaStat();
  });

  // Namn: elevlistan räcker nästan alltid; elever som lämnat klassen men står kvar
  // i tabellen slås upp i klassprojektionen (1 läsning, en gång per öppning).
  function kollaNamn() {
    if (projektionBegard || !klass) return;
    const okanda = okandaId([...studentIds, ...Object.keys(klass.tabell)], students);
    if (!okanda.length) return;
    projektionBegard = true;
    import("./schack-larare-data.js")
      .then((m) => m.projektionsNamn(cls.id))
      .then((members) => {
        if (vakt.stangd) return;
        namnFor = skapaNamnFor(students, members);
        ritaTopp();
        ritaStat();
      });
  }

  ritaModul();
  ritaStat();
  const stopp = moln.lyssnaKlass(
    cls.id,
    (k) => {
      if (!vakt.kontrollera()) return;
      klass = k;
      kollaNamn();
      ritaModul();
      ritaPartier();
      ritaTopp();
      ritaStat();
    },
    (err) => {
      if (vakt.stangd) return;
      console.warn("schack: lärarens lyssnare", err);
      partierEl.innerHTML = `<p class="err-inline">Kunde inte läsa klassens schack: ${esc(felText(err))}</p>`;
      toppEl.innerHTML = "";
    },
  );
  vakt.lagg(stopp); // åskådarläget lägger själv sin avstängning i samma vakt
  // För tester/preview: vakten (antal öppna avstängningar, stäng).
  host.schackVakt = vakt;
  return vakt;
}
