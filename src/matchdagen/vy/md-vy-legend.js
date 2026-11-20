// ============================================================================
// Matchdagen (#873, Etapp 3): STARTA EN LEGENDKLUBB (spec §10.3). Erbjuds efter
// en vunnen Mästarcup (Match-fliken, rutan efter finalen och när säsongen är
// slut) – inget tvång: "Fortsätt i Superligan" tar eleven tillbaka. Eleven döper
// den nya klubben och väljer tröjfärg (md-vy-klubb.js); motorn är md-legend.js.
//
// Sparningen: kön av osparade matcher sparas FÖRST (den gamla klubbens matcher ska
// in före den nya), sedan EN skrivning av hela den nya karriären (sparaKarriar).
// Går den inte fram blir det ingen ny klubb – eleven kan prova igen (inget halvt läge). Kom svaret
// efter tidsgränsen men skrivningen gick fram, läses serverns karriär: den nya klubben gäller då.
// (md-spara.js legender: en längre klubbhistorik på servern vinner också vid nästa start.)
//
//   startaLegend(S, el, tillbaka)   tillbaka() = visa Match-fliken igen
// ============================================================================

import { DIVISIONER, MASTARCUP } from "../delat/md-config.js";
import { legendErbjudande, nyLegendklubb } from "../delat/md-legend.js";
import { pagaendeLager, rensaPagaende } from "../md-lokal.js";
import { truppFalt } from "../delat/md-trupp.js";
import { legender, sparaKon } from "../md-spara.js";
import { klubbFormular } from "./md-vy-klubb.js";
import { esc, ruta } from "./md-vy-delat.js";

export async function startaLegend(S, el, tillbaka) {
  if (!legendErbjudande(S.K) || S.spel?.pagar) return tillbaka();
  if (pagaendeLager(S)) {
    el.innerHTML = `<div class="md-panel md-fore"><h2>Gör klart träningen först</h2>
      <p>Ett träningsläger pågår. Gör klart det under Truppen innan ni startar en legendklubb.</p>
      <div class="md-rad"><button type="button" class="md-stor" data-trupp>Till Truppen</button></div></div>`;
    el.querySelector("[data-trupp]").addEventListener("click", () => S.visa("trupp"));
    return;
  }
  const stjarnor = (Number(S.K.klubb?.legendStjarnor) || 0) + 1;
  el.innerHTML = `<div class="md-panel md-legend">
    <p class="md-overrad">${esc(MASTARCUP.namn)} är er · legendklubb</p>
    <div class="md-legend-form"></div>
    <div class="md-rad"><button type="button" class="md-ghost" data-tillbaka>Nej tack – fortsätt i Superligan</button></div>
  </div>`;
  el.querySelector("[data-tillbaka]").addEventListener("click", () => tillbaka());
  const yta = el.querySelector(".md-legend-form");
  // "Sparar …" står i svag färg, felen i rött (.md-fel)
  const fel = (t, svag = false) => { const p = yta.querySelector(".md-fel"); if (p) { p.textContent = t; p.classList.toggle("md-svag", svag); } };
  let v = { namn: "", farg: undefined };
  let meddelande = "";
  for (;;) {
    const formular = klubbFormular(yta, {
      namn: v.namn, farg: v.farg, knapp: "Starta legendklubben",
      rubrik: "Starta en legendklubb",
      text: `${esc(S.K.klubb.namn)} har tagits hela vägen! Starta en ny klubb i ${DIVISIONER[0]}: nytt namn, nya grundpelare, ny marknad och 600 kr i kassan.
        Pokalskåpet och rekorden följer med, och klubbmärket får ${stjarnor === 1 ? "en guldstjärna" : `${stjarnor} guldstjärnor`}.
        ${esc(S.K.klubb.namn)} sparas i klubbhistoriken under Statistik.`,
    });
    fel(meddelande);
    v = await formular;
    if (!yta.isConnected) return; // eleven bytte flik
    const knapp = yta.querySelector(".md-stor");
    knapp.disabled = true;
    fel("Sparar …", true);
    const tom = await sparaKon(S);
    if (!tom) { meddelande = "Matcherna är inte sparade än – prova igen när datorn har kontakt med servern."; continue; }
    let Kny = nyLegendklubb(S.K, { ...v, rng: Math.random });
    try {
      await S.data.sparaKarriar(S.uid, Kny);
    } catch (err) {
      const G = await S.data.lasKarriar(S.uid).catch(() => null);
      if (legender(G) > legender(S.K)) Kny = truppFalt(G); // skrivningen gick fram trots allt
      else {
        console.warn("Matchdagen: legendklubben kunde inte sparas", err);
        meddelande = "Den nya klubben kunde inte sparas just nu – prova igen om en stund.";
        continue;
      }
    }
    S.K = Kny;
    fel("");
    rensaPagaende(S.lagring, S.uid);
    S.kassa();
    await ruta(S.host, {
      rubrik: "En ny legend föds!",
      html: `<p>${esc(Kny.klubb.namn)} börjar i ${esc(DIVISIONER[0])}. Grundpelarna är nya – och pokalskåpet är fullt av minnen.</p>`,
      knappar: [{ id: "ok", text: "Till första matchen" }],
      klass: "md-legend-ruta",
    }, S.signal);
    return tillbaka();
  }
}
