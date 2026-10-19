// ============================================================================
// Guiden "Lär dig schack" (#790, §12): översikten med de 12 lektionerna och en
// lektion i taget. Laddas med import() från schack-flode.js:
//
//   #/elev/schack?vy=lar             översikten
//   #/elev/schack?vy=lar&lektion=N   lektion N (alla lektioner är öppna)
//
//   const vy = skapaGuideVy(host, { lektion, guide: { lektioner(), spara(nr, stjarnor) },
//                                   go, tillHash, hashBas, namn, avatarHtml, dator, lagring, nyckel });
//
// Framstegen: `guide.lektioner()` = studentData.schack.lektioner ur den redan
// cachade studentData (ingen läsning här). När en lektion blir klar anropas
// `guide.spara(nr, stjarnor)` – EN skrivning – och bara när resultatet är bättre
// än det sparade. Ett fel vid sparningen stoppar aldrig guiden.
// ============================================================================

import { oversiktHtml } from "./schack-guide-delar.js";
import { lektionFor, normaliseraLektioner, arForbattring } from "./schack-lektioner.js";
import { skapaLektionVy } from "./schack-lektion-vy.js";
import { helskarmElement } from "../helskarm.js";

/**
 * En lektion blev klar: spara bara en förbättring (EN skrivning, `guide.spara`).
 * Returnerar om det var en förbättring. Sparningen väntas inte in och ett fel loggas bara.
 */
export function sparaOmBattre(guide, nr, stjarnor) {
  const nu = normaliseraLektioner(guide.lektioner());
  if (!arForbattring(nu, nr, stjarnor)) return false;
  Promise.resolve()
    .then(() => guide.spara(nr, stjarnor))
    .catch((e) => console.warn("schack: lektionen kunde inte sparas", e));
  return true;
}

export function skapaGuideVy(host, ctx) {
  const guide = ctx.guide || { lektioner: () => ({}), spara: async () => false };
  const lektion = ctx.lektion ? lektionFor(ctx.lektion) : null;
  const tillGuide = (nr) => ctx.go(ctx.tillHash(nr ? `vy=lar&lektion=${nr}` : "vy=lar"));
  let lektionVy = null;
  let klick = null;
  let levande = true;

  function visaLektion(l) {
    const sparade = normaliseraLektioner(guide.lektioner())[String(l.nr)] || 0;
    lektionVy = skapaLektionVy(host, {
      lektion: l, sparade, namn: ctx.namn, avatarHtml: ctx.avatarHtml, dator: ctx.dator,
      lagring: ctx.lagring, nyckel: ctx.nyckel, reducedMotion: ctx.reducedMotion, mynt: ctx.mynt,
      tidsgransMs: ctx.tidsgransMs, tankMinMs: ctx.tankMinMs,
      onKlar: (stjarnor) => sparaOmBattre(guide, l.nr, stjarnor),
      onAlla: () => tillGuide(null),
      onNasta: (n) => nastaLektionIPlats(n),
    });
  }

  /**
   * Nästa lektion. Ett hashbyte ritar om hela sidan och därmed avslutar helskärmen (#794) –
   * i helskärm byts lektionen på stället (hashen skrivs om utan hashchange), annars går eleven dit.
   */
  function nastaLektionIPlats(n) {
    if (!n || !helskarmElement()) return tillGuide(n?.nr || null);
    lektionVy?.destroy(); // helskärmen lever vidare (exitOnDestroy: false), bara knappen försvinner
    lektionVy = null;
    if (typeof history !== "undefined") history.replaceState(null, "", ctx.tillHash(`vy=lar&lektion=${n.nr}`));
    visaLektion(n);
  }

  if (lektion) {
    visaLektion(lektion);
  } else {
    // Mynten (#798): bockarna ur kvittot – ritas om när det lästs (en gång per besök).
    const rita = () => { host.innerHTML = oversiktHtml(guide.lektioner(), ctx.mynt ? ctx.mynt.nu() : undefined); };
    rita();
    if (ctx.mynt && !ctx.mynt.nu()) ctx.mynt.kvitto().then((k) => { if (k && levande && !lektionVy) rita(); });
    klick = (e) => {
      const nr = e.target.closest("[data-lektion]")?.dataset.lektion;
      if (nr) return tillGuide(nr);
      if (e.target.closest('[data-act="tillbaka"]')) ctx.go(ctx.hashBas);
    };
    host.addEventListener("click", klick);
  }

  return {
    lektion: () => lektionVy,
    destroy() {
      levande = false;
      lektionVy?.destroy();
      lektionVy = null;
      if (klick) host.removeEventListener("click", klick);
      host.innerHTML = "";
    },
  };
}
