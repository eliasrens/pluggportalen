// ============================================================================
// Pusselvyn (#791, §13): valet Matt i ett / Matt i två och ett pussel i taget på
// SAMMA bräde som partierna (schack-bradet.js). Laddas med import() från
// schack-flode.js; pusselbanken (JSON) hämtas först här (laddaPussel – fetch).
//
//   #/elev/schack?vy=pussel              valet med framstegen
//   #/elev/schack?vy=pussel&sort=ett|tva ett pussel i taget (där eleven var)
//
//   const vy = skapaPusselVy(host, { sort, nr?, pussel: { framsteg(), spara(sort, nr) },
//                                    go, tillHash, hashBas, lagring, nyckel, reducedMotion, forsvarMs?, hamta? });
//   vy.brade / vy.lopp() / vy.nr() för tester och förhandsvisningen; vy.destroy().
//
// Flödet: brädets beforeMove frågar loppet (schack-pussel.js). Fel drag → false,
// pjäsen hoppar tillbaka och "Inte riktigt – prova igen!". Matt → "Snyggt! Schack
// matt! ⭐" och Nästa pussel. Matt i två: efter rätt första drag spelar datorn
// försvaret (efter en kort paus, så att eleven ser det) och eleven gör matt.
// Framstegen: EN skrivning (pussel.spara) när ett NYTT pussel löses. Inga mynt.
// ============================================================================

import { skapaSchackbrade } from "./schack-bradet.js";
import { skapaSchackKontroll } from "./schack-kontroll.js";
import {
  SORTER, ARSORT, TEXT, laddaPussel, skapaPusselLopp, normaliseraFramsteg, arNyttLost, efterLost,
  startNummer, lasLage, sparaLage,
} from "./schack-pussel.js";
import { valHtml, pusselHtml, nrText } from "./schack-pussel-delar.js";
import { svenskSan } from "./schack-text.js";

const FORSVAR_MS = 700;

/**
 * Brädets kontroll + en tipsring (state.rutKlass = { ruta: "tips" }). Ringen
 * försvinner vid nästa drag och vid en ny ställning.
 */
export function skapaPusselKontroll(opt) {
  const k = skapaSchackKontroll(opt);
  let rutKlass = {};
  k.subscribe((s, h) => {
    if (h?.typ === "drag" || h?.typ === "position") rutKlass = {};
  });
  return {
    ...k,
    getState: () => ({ ...k.getState(), rutKlass }),
    subscribe: (fn) => k.subscribe((s, h) => fn({ ...s, rutKlass }, h)),
    /** Markera pjäsen som ska flyttas (null = ta bort ringen). Ritar om brädet. */
    markeraTips(ruta) {
      rutKlass = ruta ? { [ruta]: "tips" } : {};
      k.setInteractive(k.getState().interaktiv); // ingen ändring – bara en ny ritning
    },
  };
}

export function skapaPusselVy(host, ctx) {
  const pc = ctx.pussel || { framsteg: () => ({}), spara: async () => false };
  const lageNyckel = ctx.nyckel ? `${ctx.nyckel}:pussel` : null;
  const lagring = lageNyckel ? ctx.lagring : null;
  const tillVal = () => ctx.go(ctx.tillHash("vy=pussel"));
  let levande = true;
  let klick = null;
  let brade = null;
  let lopp = null;
  let lista = [];
  let nr = 1;
  let tipsSteg = 0;
  let rattDrag = null; // loppets svar på draget som just godkändes
  let timer = null;
  let framsteg = normaliseraFramsteg(pc.framsteg());
  let klar = null; // löftet om att banken laddats (pusselgrenen)

  host.addEventListener("click", (klick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    const sort = e.target.closest("[data-sort]")?.dataset.sort;
    if (sort) return ctx.go(ctx.tillHash(`vy=pussel&sort=${sort}`));
    if (act === "tillbaka") ctx.go(ctx.hashBas);
    else if (act === "val") tillVal();
    else if (act === "tips") visaTips();
    else if (act === "nasta") nasta();
    else if (act === "forra" && nr > 1) visa(nr - 1);
    else if (act === "hoppa" && nr < lista.length) visa(nr + 1);
  }));

  // --- Valet -----------------------------------------------------------------
  if (!ARSORT(ctx.sort)) {
    const antal = {};
    const rita = () => { host.innerHTML = valHtml(framsteg, antal, lasLage(lagring, lageNyckel)); };
    rita();
    for (const s of Object.keys(SORTER)) {
      laddaPussel(s, { hamta: ctx.hamta }).then((l) => {
        if (!levande) return;
        antal[s] = l.length;
        rita();
      }).catch(() => {});
    }
    return vyApi();
  }

  // --- Ett pussel ------------------------------------------------------------
  const sort = ctx.sort;
  host.innerHTML = pusselHtml(sort);
  const $ = (s) => host.querySelector(s);
  const text = (s, t) => { const e = $(s); if (e) e.textContent = t; };
  const svar = (t) => text(".schack-pussel-svar", t);
  text(".schack-pussel-nr", "Laddar pusslen …");
  klar = laddaPussel(sort, { hamta: ctx.hamta }).then((l) => {
    if (!levande) return;
    lista = l;
    // En direktlänk (&nr=N) gäller som den är; annars där eleven var (F1: vid slutet från 1).
    starta(ctx.nr ? Math.min(ctx.nr, lista.length) : startNummer(framsteg, lasLage(lagring, lageNyckel)[sort], sort, lista.length));
  }).catch((e) => {
    console.warn("schack: pusslen kunde inte laddas", e);
    if (levande) text(".schack-pussel-nr", "Pusslen kunde inte laddas. Ladda om sidan och försök igen.");
  });

  function starta(n) {
    const k = skapaPusselKontroll({
      egenFarg: "w", interaktiv: "w", orientering: "w",
      beforeMove(drag) {
        const r = lopp?.bedom(drag);
        if (!r) return false;
        if (!r.ok) {
          svar(r.text);
          brade.setStatus(r.text);
          return false;
        }
        rattDrag = r;
        return true;
      },
      onMove() {
        const r = rattDrag;
        rattDrag = null;
        if (!r) return;
        tipsSteg = 0;
        if (r.klart) return lost();
        brade.setInteractive(false);
        brade.setStatus(r.text);
        svar(r.text);
        const visade = lopp;
        timer = setTimeout(() => {
          timer = null;
          if (!levande || lopp !== visade) return;
          const d = brade.move(r.forsvar);
          brade.setInteractive("w");
          brade.setStatus(TEXT.nuMatt);
          svar(d ? `Svart spelade ${d.sanSv}. ${TEXT.nuMatt}` : TEXT.nuMatt);
        }, ctx.forsvarMs ?? FORSVAR_MS);
      },
    });
    brade = skapaSchackbrade($(".schack-pussel-brade"), {
      kontroll: k, reducedMotion: ctx.reducedMotion, etikett: "Schackbräde med pusslet",
    });
    visa(n);
  }

  function visa(n) {
    clearTimeout(timer);
    timer = null;
    nr = Math.min(Math.max(1, n), lista.length);
    sparaLage(lagring, lageNyckel, sort, nr);
    const p = lista[nr - 1];
    lopp = skapaPusselLopp(p, sort);
    rattDrag = null;
    tipsSteg = 0;
    const s = p.senast;
    brade.setPosition(p.fen, { senast: s ? { from: s.slice(0, 2), to: s.slice(2, 4) } : null });
    brade.setInteractive("w");
    brade.setStatus(SORTER[sort].uppgift);
    text(".schack-pussel-nr", nrText(nr, lista.length));
    svar("");
    $('[data-act="nasta"]').hidden = true;
    $('[data-act="tips"]').hidden = false;
    $('[data-act="forra"]').disabled = nr <= 1;
    $('[data-act="hoppa"]').disabled = nr >= lista.length;
  }

  function visaTips() {
    const t = lopp?.tips();
    if (!t || !brade.getState().interaktiv) return;
    tipsSteg++;
    brade.markeraTips(t.from);
    if (tipsSteg >= 2) {
      // Andra trycket: hela draget som en pil, så att ingen fastnar för gott.
      brade.clearArrows();
      brade.showArrow(t.from, t.to);
      svar(TEXT.tipsDrag(svenskSan(t.san)));
    } else svar(TEXT.tips);
  }

  /** Pusslet löst: texten, Nästa pussel, och EN skrivning om det var ett nytt. */
  function lost() {
    brade.avsluta({ resultat: "1-0", orsak: "matt", vinnare: "w", titel: TEXT.ratt });
    if (arNyttLost(framsteg, sort, nr)) {
      framsteg = efterLost(framsteg, sort, nr);
      Promise.resolve()
        .then(() => pc.spara(sort, nr))
        .catch((e) => console.warn("schack: pusslet kunde inte sparas", e));
    }
    // Sista pusslet: säg hur många som verkligen är lösta – efter Hoppa över är det färre (F2).
    svar(nr >= lista.length ? `${TEXT.ratt} ${TEXT.sista(framsteg[sort].losta, lista.length)}` : TEXT.ratt);
    const knapp = $('[data-act="nasta"]');
    knapp.textContent = nr >= lista.length ? "Till alla pussel" : "Nästa pussel ›";
    knapp.hidden = false;
    $('[data-act="tips"]').hidden = true;
    knapp.focus({ preventScroll: true });
  }

  function nasta() {
    if (nr >= lista.length) return tillVal();
    visa(nr + 1);
  }

  function vyApi() {
    return {
      get brade() { return brade; },
      klar: () => klar ?? Promise.resolve(),
      lopp: () => lopp,
      nr: () => nr,
      antal: () => lista.length,
      visa: (n) => brade && visa(n),
      tips: () => visaTips(),
      destroy() {
        levande = false;
        clearTimeout(timer);
        host.removeEventListener("click", klick);
        brade?.destroy();
        brade = null;
        host.innerHTML = "";
      },
    };
  }
  return vyApi();
}
