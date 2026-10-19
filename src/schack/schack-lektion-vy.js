// ============================================================================
// En lektion i guiden "Lär dig schack" (#790, §12): ritar ramen och kör
// uppgifterna i tur och ordning på SAMMA bräde som partierna (schack-bradet.js).
// Räkningen (uppgift, drag, stjärnor) sköts av skapaLopp i schack-lektioner.js.
//
//   fragor    brädet i utgångsställningen; varje tryck på en ruta är ett svar
//   jakt      stjärnjakten (schack-stjarnjakt.js) som kontroll i brädet
//   stallning en riktig ställning; brädets beforeMove bedömer draget (bedomDrag)
//             – ett drag som inte uppfyller kravet hoppar tillbaka och räknas
//   parti     partiet mot Bonden (schack-dator-vy.js), sparat i localStorage
//
//   const vy = skapaLektionVy(host, { lektion, sparade, namn, avatarHtml, dator, lagring, nyckel,
//                                     onKlar(stjarnor) → bool (förbättring), onAlla, onNasta, reducedMotion });
//   vy.borjaOm(); vy.destroy();   vy.brade / vy.lopp() för tester och förhandsvisningen
// Helskärm (#794): knappen ligger bland panelens knappar (lektion 12 har den i partivyn) och
// helskärmar schacksidans rot (.schack-rot), inte vyn – då överlever ett byte till nästa lektion.
// Ingen tidspress, inga mynt, ingen Firebase.
// ============================================================================

import { skapaSchackbrade } from "./schack-bradet.js";
import { skapaSchackKontroll } from "./schack-kontroll.js";
import { skapaJaktKontroll } from "./schack-stjarnjakt.js";
import { LEKTIONER, skapaLopp, stjarnorEfterParti } from "./schack-lektioner.js";
import { lektionHtml, klarHtml } from "./schack-guide-delar.js";
import { lasParti, sparaParti, nyttParti } from "./schack-parti.js";
import { monteraHelskarm } from "./schack-helskarm.js";

/**
 * Kontrollen för frågorna i lektion 1: utgångsställningen, inga drag – varje tryck
 * (klick, finger, Enter) går till `onTryck`. `markera({ ruta: "ratt"|"fel" })` färgar rutor.
 */
export function skapaFragaKontroll(onTryck) {
  const k = skapaSchackKontroll({ interaktiv: false });
  let rutKlass = {};
  return {
    ...k,
    kanValja: () => false,
    tryck(ruta) { onTryck(ruta); return { typ: "ingen" }; },
    valj: () => ({ typ: "ingen" }),
    slapp: () => ({ typ: "ingen" }),
    getState: () => ({ ...k.getState(), rutKlass }),
    subscribe: (fn) => k.subscribe((s, h) => fn({ ...s, rutKlass }, h)),
    /** Färga rutor och sätt statusraden (ritar om brädet). */
    markera(m, status) { rutKlass = m; k.setStatus(status); },
  };
}

const TOM_LAGRING = { getItem: () => null, setItem() {}, removeItem() {} };

export function skapaLektionVy(host, o) {
  const { lektion } = o;
  const nastaL = LEKTIONER.find((l) => l.nr === lektion.nr + 1) || null;
  let brade = null;
  let datorVy = null;
  let lopp = null;
  let klar = false;
  let levande = true;
  let laddar = null;

  host.innerHTML = lektionHtml(lektion, o.sparade || 0);
  const $ = (s) => host.querySelector(s);
  const yta = $(".schack-lektion-yta");
  const klarEl = $(".schack-lektion-klar");
  const plats = $(".schack-lektion-brade");
  const nastaKnapp = $('[data-act="nasta"]');
  const omKnapp = $('[data-act="om"]'); // bara i jakterna
  const text = (s, t) => { const e = $(s); if (e) e.textContent = t; };
  // Lektion 12 (partiet) monterar sin egen knapp i schack-dator-vy.js – bara en per sida.
  const helskarm = lektion.typ === "parti" ? null : monteraHelskarm(host.closest?.(".schack-rot") || host, { knappPlats: $(".schack-knappar") });

  function visaRaknare() {
    if (lektion.typ === "jakt") {
      const j = brade.getState().jakt;
      text(".schack-lektion-raknare", `Drag: ${j.antal} · det går på ${lopp.uppgift().min} drag · ${j.kvar} kvar`);
    } else {
      text(".schack-lektion-raknare", `${lektion.typ === "fragor" ? "Tryck" : "Drag"}: ${lopp.antal}`);
    }
  }

  function visaSteg() {
    const n = lektion.uppgifter.length;
    text(".schack-lektion-steg", n > 1 ? `${lektion.typ === "fragor" ? "Fråga" : "Uppgift"} ${lopp.steg + 1} av ${n}` : "");
    text(".schack-lektion-text", lopp.uppgift().text || "Ta alla stjärnor på så få drag som möjligt.");
    nastaKnapp.hidden = true;
    if (omKnapp) omKnapp.hidden = false;
    visaRaknare();
  }

  function uppgiftKlar(svar) {
    text(".schack-lektion-svar", svar);
    nastaKnapp.hidden = false;
    if (omKnapp) omKnapp.hidden = true; // uppgiften är klar – Börja om gör inget då (F2)
    nastaKnapp.focus({ preventScroll: true });
  }

  /** Lektionen klar: resultatrutan, och framsteget sparas (bara en förbättring – guiden avgör). */
  function lektionKlar(r) {
    if (klar) return;
    klar = true;
    let forbattring = false;
    if (r.stjarnor > 0) {
      try { forbattring = Boolean(o.onKlar?.(r.stjarnor)); } catch (e) { console.warn("schack: framsteget", e); }
    }
    klarEl.innerHTML = klarHtml(lektion, { ...r, forbattring, nasta: nastaL });
    klarEl.hidden = false;
    if (lektion.typ !== "parti") yta.hidden = true;
    klarEl.querySelector("button")?.focus({ preventScroll: true });
  }

  // --- Lektion 1: frågor ----------------------------------------------------
  function startaFragor() {
    const k = skapaFragaKontroll((ruta) => {
      const r = lopp.tryck(ruta);
      if (r.ratt) k.markera({ [ruta]: "ratt" }, `Rätt – ${ruta}!`);
      else if (!r.lektionKlar) k.markera({ [ruta]: "fel" }, `Det där var ${ruta}. Prova igen!`);
      if (r.lektionKlar) return lektionKlar(lopp.resultat());
      if (r.ratt) visaSteg();
      text(".schack-lektion-svar", r.ratt ? `Rätt – det var ${ruta}!` : `Det där var ${ruta}. Prova igen!`);
      visaRaknare();
    });
    brade = skapaSchackbrade(plats, { kontroll: k, reducedMotion: o.reducedMotion, etikett: "Schackbräde – tryck på rätt ruta" });
    k.markera({}, "Tryck på rätt ruta.");
  }

  // --- Lektion 2–8: stjärnjakt -----------------------------------------------
  function nyJakt() {
    brade?.destroy();
    const k = skapaJaktKontroll(lopp.uppgift(), {
      onMove(drag) {
        visaRaknare();
        text(".schack-lektion-svar", drag.captured ? "Tagen!" : drag.stjarna ? "En stjärna!" : "");
      },
      onKlar(s) {
        k.setInteractive(false);
        if (lopp.jaktKlar(s.jakt.antal).lektionKlar) return lektionKlar(lopp.resultat());
        uppgiftKlar(s.jakt.antal <= lopp.uppgift().min ? "Alla tagna – på minsta möjliga antal drag!" : "Alla tagna!");
      },
    });
    brade = skapaSchackbrade(plats, { kontroll: k, reducedMotion: o.reducedMotion, etikett: "Schackbräde med stjärnor" });
    text(".schack-lektion-svar", "");
    visaSteg();
  }

  // --- Lektion 9–11: ställningar ----------------------------------------------
  function startaStallning() {
    let rattDrag = false; // draget som bedömdes rätt och nu görs
    brade = skapaSchackbrade(plats, {
      fen: lopp.uppgift().fen, egenFarg: "w", interaktiv: "w", reducedMotion: o.reducedMotion,
      slutKnappar: [{ text: "Nästa uppgift", onClick: () => nasta() }],
      beforeMove(drag) {
        const r = lopp.drag(drag);
        if (!r.text) return false;
        text(".schack-lektion-svar", r.text);
        visaRaknare();
        if (!r.ok) { brade.setStatus("Prova igen!"); return false; }
        rattDrag = r;
        return true;
      },
      onMove() {
        if (!rattDrag) return;
        const r = rattDrag;
        rattDrag = false;
        brade.setInteractive(false);
        if (r.lektionKlar) return lektionKlar(lopp.resultat());
        uppgiftKlar(r.text);
      },
    });
    visaStallning();
  }
  function visaStallning() {
    const u = lopp.uppgift();
    brade.setPosition(u.fen, { senast: u.senast || null });
    brade.setInteractive("w");
    brade.setStatus(u.text);
    text(".schack-lektion-svar", "");
    visaSteg();
  }

  // --- Lektion 12: partiet mot Bonden -------------------------------------------
  const partiNyckel = o.nyckel ? `${o.nyckel}:lektion` : null;
  function startaParti(nytt) {
    const lagring = o.lagring || TOM_LAGRING;
    const sparat = !nytt && partiNyckel ? lasParti(lagring, partiNyckel) : null;
    const parti = sparat && !sparat.slut ? sparat : nyttParti({ niva: "bonden", farg: "w" });
    if (partiNyckel) sparaParti(lagring, partiNyckel, parti);
    const el = document.createElement("div");
    yta.replaceChildren(el);
    return import("./schack-dator-vy.js").then(({ skapaDatorVy }) => {
      if (!levande || !el.isConnected) return;
      datorVy = skapaDatorVy(el, {
        parti, namn: o.namn || "Du", avatarHtml: o.avatarHtml, dator: o.dator(), reducedMotion: o.reducedMotion,
        tidsgransMs: o.tidsgransMs, tankMinMs: o.tankMinMs, tillbakaText: "‹ Alla lektioner",
        spara: (p) => partiNyckel && sparaParti(lagring, partiNyckel, p),
        onSlut: (slut) => {
          const st = stjarnorEfterParti(slut, parti.egenFarg);
          const t = { 3: "Du vann mot Bonden!", 2: "Remi – bra kämpat!", 1: "Bonden vann den här gången, men du spelade klart ett helt parti!" }[st] ||
            "Du gav upp – spela klart ett parti för att få stjärnor.";
          lektionKlar({ stjarnor: st, parti: true, text: t });
        },
        onNytt: () => borjaOm(),
        onTillbaka: () => o.onAlla?.(),
      });
      brade = datorVy.brade;
    });
  }

  function nasta() {
    if (!lopp?.nasta()) return;
    text(".schack-lektion-svar", "");
    if (lektion.typ === "jakt") nyJakt();
    else if (lektion.typ === "stallning") visaStallning();
  }

  function stang() {
    datorVy?.destroy();
    datorVy = null;
    if (lektion.typ !== "parti") brade?.destroy();
    brade = null;
  }

  function starta(nyttSpel = false) {
    klar = false;
    klarEl.hidden = true;
    klarEl.innerHTML = "";
    yta.hidden = false;
    lopp = lektion.typ === "parti" ? null : skapaLopp(lektion);
    if (lektion.typ === "fragor") startaFragor();
    else if (lektion.typ === "jakt") nyJakt();
    else if (lektion.typ === "stallning") startaStallning();
    else laddar = startaParti(nyttSpel);
    if (lopp && lektion.typ !== "jakt") visaSteg();
  }

  function borjaOm() {
    stang();
    starta(true);
  }

  const klick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "alla") o.onAlla?.();
    else if (act === "nasta-lektion") o.onNasta?.(nastaL);
    else if (act === "igen") borjaOm();
    else if (act === "nasta") nasta();
    else if (act === "om" && !klar && !lopp.uppgiftKlar) {
      brade.borjaOm(); // jakt: bara den här uppgiften – dess drag nollas
      text(".schack-lektion-svar", "");
      visaRaknare();
    }
  };
  host.addEventListener("click", klick);
  starta();

  return {
    get brade() { return brade; },
    /** Lektion 12: löftet om att partivyn laddats. */
    klar: () => laddar || Promise.resolve(),
    datorVy: () => datorVy,
    lopp: () => lopp,
    nasta,
    borjaOm,
    destroy() {
      levande = false;
      host.removeEventListener("click", klick);
      helskarm?.destroy();
      stang();
      host.innerHTML = "";
    },
  };
}
