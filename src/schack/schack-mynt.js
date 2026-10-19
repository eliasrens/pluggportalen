// ============================================================================
// Schackets pluggmynt i KLIENTEN (#798): kvittot (bockarna) och anropen till
// servern bakom ett litet API som vyerna får via ctx.mynt. Transporten skickas
// in – appen (page-schack.js) ger callables + EN läsning av schackMynt/{uid},
// förhandsvisningarna en stubb – så vyerna aldrig rör Firebase.
//
//   const mynt = skapaMynt({ hamtaKvitto, datorVinst, lektion, pussel, onBetalt? });
//   mynt.kvitto()                     → Promise<kvitto | null>  (läses EN gång; null = läsfel)
//   mynt.nu()                         → kvittot om det lästs, annars null (synkront, för markup)
//   mynt.datorVinst(parti)            → Promise<{ mynt, redan, nyckel, pokal }>
//   mynt.lektion(nr, losning)         → Promise<svar>
//   mynt.pussel(sort, nr, id, drag)   → Promise<svar>
//   myntHtml(text)                    → escapad HTML med {mynt} som myntikonen (withCoinIcon)
// Efter ett svar uppdateras kvittot lokalt (ingen ny läsning); onBetalt(svar) körs när
// mynt faktiskt betalades (saldot i sidomenyn läses om).
// ============================================================================

import { withCoinIcon } from "../icons.js";
import { esc } from "./schack-bradet-delar.js";
import { normaliseraKvitto, efterUtbetalning, pusselNyckel } from "./schack-mynt-delat.js";

export function skapaMynt(t) {
  let kvitto = null; // Promise<kvitto|null>
  let senast = null; // det lästa kvittot (synkront)

  function las() {
    if (!kvitto) {
      kvitto = Promise.resolve()
        .then(() => t.hamtaKvitto())
        .then((k) => (senast = normaliseraKvitto(k)))
        .catch((e) => {
          console.warn("schack: myntkvittot kunde inte läsas", e);
          kvitto = null; // nästa vy försöker igen
          return null;
        });
    }
    return kvitto;
  }

  async function efter(grupp, nyckel, svar) {
    if (svar && (svar.mynt > 0 || svar.redan)) {
      const k = (await las()) || normaliseraKvitto(null);
      senast = efterUtbetalning(k, grupp, nyckel, svar.mynt > 0 ? svar.mynt : 0);
      kvitto = Promise.resolve(senast);
      if (svar.mynt > 0) {
        try { t.onBetalt?.(svar); } catch (e) { console.warn("schack: onBetalt", e); }
      }
    }
    return svar;
  }

  return {
    kvitto: las,
    nu: () => senast,
    datorVinst: (parti) => Promise.resolve(t.datorVinst({ niva: parti.niva, seed: parti.seed, drag: [...parti.drag] }))
      .then((s) => efter("dator", parti.niva, s)),
    lektion: (nr, losning) => Promise.resolve(t.lektion({ nr, losning })).then((s) => efter("lektioner", String(nr), s)),
    pussel: (sort, nr, id, drag) => Promise.resolve(t.pussel({ sort, nr, drag: [...drag] }))
      .then((s) => efter("pussel", pusselNyckel(sort, id), s)),
  };
}

/** Text → escapad HTML där {mynt} blir myntikonen (aldrig mynt-emojin, #590). */
export function myntHtml(text) {
  return withCoinIcon(esc(text));
}
