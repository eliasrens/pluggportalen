// ============================================================================
// Prov (#810, spec §5.6): helskärmsläget på elevens provsida.
//   begarHelskarm()            går in i helskärm – anropas DIREKT i klicket
//                              ("Starta provet", "Fortsätt provet"); → Promise<bool>
//   kopplaHelskarm(o)          pausvakten + pausen + väntan på läraren
// När eleven lämnar provet (ur helskärm, flik dold, fokus borta > 2 s):
//   1. svaren + pausen sparas i EN skrivning (pausa, prov-elev-data.js)
//   2. provvyn tas bort ur sidan (inte bara gömd) och rutan "Provet är pausat" visas
//   3. eleven lyssnar på sitt eget svar tills läraren släpper in → "Fortsätt provet"
// Tiden går under pausen. Reglerna nekar sparningar så länge pausad == true.
// ============================================================================

import { escHtml } from "../ui.js";
import { fullscreenSupported, goUt, helskarmElement } from "../helskarm.js";
import { serverNow } from "../data-class-lock.js";
import { hamtaMittSvar, lyssnaMittSvar, pausa } from "./prov-elev-data.js";
import { arPausad, pausFalt, skapaPausvakt } from "./prov-helskarm.js";
import { arSlutgiltigtFel } from "./prov-sparning.js";

export { FORKLARING, helskarmFor } from "./prov-helskarm.js";

/** Gå in i helskärm (måste ske i ett klick). true = helskärm, false = stöds inte / nekades. */
export function begarHelskarm() {
  if (helskarmElement()) return Promise.resolve(true);
  if (!fullscreenSupported()) return Promise.resolve(false);
  try {
    const el = document.documentElement;
    const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: "hide" });
    return Promise.resolve(p).then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

function pausRuta() {
  const ruta = document.createElement("div");
  ruta.className = "provv-panel provv-paus";
  ruta.setAttribute("role", "alert");
  ruta.innerHTML = `<h1 class="provv-sidrubrik">⏸ Provet är pausat</h1>
    <p>Du lämnade provet. Räck upp handen – din lärare släpper in dig igen.</p>
    <p class="provv-paus-vantar"><i>Väntar på läraren…</i></p>
    <p class="provv-fel" role="status" hidden></p>
    <button class="provv-lamna-in" type="button" hidden>Fortsätt provet</button>`;
  return ruta;
}

/**
 * @param {object} o
 * @param {string} o.t                  tillfällets id
 * @param {string} o.meId
 * @param {object} o.svarDok            elevens svar som det lästes (pausad? pausLogg?)
 * @param {HTMLElement} o.vyEl          provvyn – tas bort ur sidan under pausen
 * @param {boolean} o.nyss              eleven tryckte nyss "Starta provet" (klicket gick till helskärmen)
 * @param {boolean} o.helskarmFel       helskärmen gick inte vid starten
 * @param {() => object} o.svarNu       elevens svar just nu
 * @param {() => number} o.flikbyten    räknaren (#748) – pauserna räknas i den
 * @param {(n: number) => void} o.satFlikbyten
 * @param {() => void} o.forePaus       stoppa sparandet (skrivs lokalt av sidan)
 * @param {() => void} o.efterPaus      eleven är tillbaka – börja spara igen
 * @param {(nytt: object|null) => void} o.onLage  stängt / inlämnat under pausen – sidan läser läget
 */
export function kopplaHelskarm(o) {
  let fel = o.helskarmFel === true || o.svarDok?.helskarmFel === true || !fullscreenSupported();
  let logg = o.svarDok?.pausLogg || [];
  let ruta = null;
  let avLyssna = null;
  let scroll = window.scrollY || 0;
  let klar = false;
  // Platsen i provet: bara medan eleven är i helskärm – när helskärmen lämnas
  // krymper fönstret och webbläsaren flyttar scrollen innan pausen hinner läsa den.
  const merkScroll = () => { if (!ruta && (fel || helskarmElement())) scroll = window.scrollY || 0; };
  window.addEventListener("scroll", merkScroll, { passive: true });
  const route = location.hash;

  const vakt = skapaPausvakt({
    onPaus: (orsak) => void pausaNu(orsak),
    doc: document,
    win: window,
    harFokus: () => document.hasFocus(),
    kravHelskarm: !fel,
  });

  // Provvyn ut ur sidan, pausrutan in.
  function visaPaus() {
    if (ruta) return;
    const r = pausRuta();
    ruta = r;
    o.vyEl.replaceWith(r);
    window.scrollTo?.(0, 0);
  }

  function lyssna() {
    avLyssna?.();
    avLyssna = lyssnaMittSvar(o.t, o.meId, (d) => {
      if (klar || !ruta) return;
      if (!d || d.inlamnad) return o.onLage(d);
      if (d.pausad === false) slapptIn(d);
    });
  }

  async function pausaNu(orsak) {
    if (klar) return;
    o.forePaus();
    visaPaus();
    const svar = o.svarNu();
    let omlast = false;
    // Pausen måste fram: försök igen tills det går (offline köar SDK:t skrivningen).
    for (let forsok = 0; !klar; forsok++) {
      const falt = pausFalt({ flikbyten: o.flikbyten(), pausLogg: logg }, orsak, serverNow());
      try {
        await Promise.race([
          pausa(o.t, o.meId, svar, falt, fel),
          new Promise((_, nej) => setTimeout(() => nej(Object.assign(new Error("timeout"), { code: "deadline-exceeded" })), 10_000)),
        ]);
        o.satFlikbyten(falt.flikbyten);
        logg = falt.pausLogg;
        break;
      } catch (err) {
        if (arSlutgiltigtFel(err)) {
          // Nekad. En gammal pauslogg (en annan flik pausade) – läs om och försök en gång till.
          const d = omlast ? null : await hamtaMittSvar(o.t, o.meId).catch(() => null);
          if (d && !d.inlamnad && !d.pausad) {
            omlast = true;
            logg = d.pausLogg || [];
            o.satFlikbyten(Math.max(o.flikbyten(), d.flikbyten || 0));
            continue;
          }
          // Stängt, inlämnat eller tiden slut – sidan läser läget.
          o.onLage(undefined);
          break;
        }
        const f = ruta?.querySelector(".provv-fel");
        if (f) {
          f.hidden = false;
          f.textContent = "Kunde inte nå servern – kontrollera internet. Dina svar finns kvar.";
        }
        await new Promise((r) => setTimeout(r, Math.min(5_000 * (forsok + 1), 20_000)));
      }
    }
    if (ruta) ruta.querySelector(".provv-fel").hidden = true;
    lyssna();
  }

  function slapptIn(d) {
    logg = d.pausLogg || logg;
    avLyssna?.();
    avLyssna = null;
    ruta.querySelector(".provv-paus-vantar").innerHTML = `<b>${escHtml("Din lärare har släppt in dig.")}</b>`;
    const knapp = ruta.querySelector("button");
    knapp.hidden = false;
    knapp.focus();
    knapp.addEventListener("click", () => {
      // Klicket går direkt till helskärmen (webbläsaren kräver det).
      const p = fel ? Promise.resolve(false) : begarHelskarm();
      p.then((ok) => {
        if (klar) return;
        if (!ok && !fel) {
          fel = true;
          vakt.kravHelskarm = false;
        }
        ruta.replaceWith(o.vyEl);
        ruta = null;
        // Samma plats – efter att helskärmen hunnit ändra fönstrets storlek.
        window.scrollTo?.(0, scroll);
        setTimeout(() => window.scrollTo?.(0, scroll), 250);
        vakt.aterstall();
        o.efterPaus({ helskarmFel: fel });
      });
    }, { once: true });
  }

  vakt.starta();
  if (arPausad(o.svarDok)) {
    // Redan pausad (omladdning): rutan direkt, inget skrivs.
    vakt.markeraPausad();
    o.forePaus();
    visaPaus();
    lyssna();
  } else if (!o.nyss && !fel && !helskarmElement()) {
    // Tillbaka i ett påbörjat prov utan helskärm (omladdad sida, ny flik):
    // eleven har lämnat provet – samma paus som Esc.
    vakt.pausa("helskarm");
  }

  return {
    get pausad() { return !!ruta; },
    /** Räknar helskärmsläget elevens pauser just nu (då räknar sidan inga egna flikbyten)? */
    get aktiv() { return vakt.aktiv || !!ruta; },
    get helskarmFel() { return fel; },
    /** Tillfället ändrades: helskärmsläget av eller eleven undantagen → vakten av (en pågående paus står kvar). */
    galler(pa) {
      if (!pa && !ruta) vakt.stoppa();
      else if (pa) vakt.starta();
    },
    /** Inlämnat / stängt: provvyn tillbaka (låst), vakten av, ut ur helskärm. */
    slut() {
      klar = true;
      vakt.stoppa();
      window.removeEventListener("scroll", merkScroll);
      avLyssna?.();
      avLyssna = null;
      if (ruta) {
        ruta.replaceWith(o.vyEl);
        ruta = null;
      }
      if (helskarmElement()) goUt();
    },
    /**
     * Sidan städas. Gick eleven till en annan sida mitt i provet (utan
     * fokuslås går det) har hen lämnat provet: pausen skrivs, som vid Esc.
     * Samma route som ritas om: bara vakten av – helskärmen ligger kvar.
     * @returns {boolean} true = pausen skrevs (med svaren) – sidan ska inte spara mer
     */
    lamnaSidan() {
      if (location.hash === route) {
        klar = true;
        vakt.stoppa();
        window.removeEventListener("scroll", merkScroll);
        avLyssna?.();
        return false;
      }
      const skriv = !klar && vakt.aktiv && !vakt.pausad;
      if (skriv) {
        const falt = pausFalt({ flikbyten: o.flikbyten(), pausLogg: logg }, "helskarm", serverNow());
        pausa(o.t, o.meId, o.svarNu(), falt, fel).catch(() => {});
      }
      this.slut();
      return skriv;
    },
  };
}
