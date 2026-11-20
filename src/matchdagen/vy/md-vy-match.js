// ============================================================================
// Matchdagen (#869): MATCH-fliken (spec §5, §14) – ny klubb första gången,
// rutan före avspark ("Säsong 1 · Division 6 · Omgång 2 av 5", lagen, Avspark!),
// en pågående match att fortsätta, och när säsongen är slut: placeringen och
// "Starta nästa säsong". Själva matchen spelas i md-match-spel.js.
// ============================================================================

import { DIVISIONER } from "../delat/md-config.js";
import { nastaMatch, nyKarriar, nySasong, sasongFro, tabellRader } from "../delat/md-sasong.js";
import { skapaPrng } from "../delat/md-prng.js";
import { lasPagaende } from "../md-lokal.js";
import { klubbFormular } from "./md-vy-klubb.js";
import { chip, esc } from "./md-vy-delat.js";

/** "Säsong 1 · Division 6 · Omgång 2 av 5" */
export const omgangText = (K, n) => `Säsong ${K.sasong} · ${DIVISIONER[K.div]} · Omgång ${n.omg + 1} av ${n.antal}`;

export async function visaMatchFlik(S, el) {
  if (S.spel?.pagar) return; // matchen ligger kvar där eleven lämnade den
  if (!S.K) return nyKlubb(S, el);
  const n = nastaMatch(S.K);
  if (!n) return sasongSlut(S, el);
  const pagaende = lasPagaende(S.lagring, S.uid, S.K);
  const vi = S.K.klubb;
  el.innerHTML = `<div class="md-panel md-fore">
    <p class="md-overrad">${esc(omgangText(S.K, n))}</p>
    <h2 class="md-motet"><span>${chip(vi.farg)}${esc(vi.namn)}</span><span class="md-mot-streck">–</span><span>${chip(n.mot.farg)}${esc(n.mot.namn)}</span></h2>
    ${pagaende
      ? `<p class="md-pagar">Matchen pågår: <b>${pagaende.m.oss} – ${pagaende.m.dem}</b> efter ${Math.round(pagaende.m.min)} minuter.</p>`
      : `<p class="md-svag">Varje drag ger en fråga. Svarar du rätt lyckas passet eller skottet oftare – men även snygga skott kan räddas, och långskott går sällan in.</p>`}
    <div class="md-rad">
      <button type="button" class="md-stor" data-avspark>${pagaende ? "Fortsätt matchen" : "Avspark!"}</button>
      ${S.lugnt ? `<span class="md-lugnt-etikett">Lugnt läge</span>` : ""}
    </div>
    <p class="md-fel" aria-live="polite"></p>
  </div>`;
  el.querySelector("[data-avspark]").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    const { spelaMatch } = await import("./md-match-spel.js");
    try {
      await spelaMatch(S, el, { pagaende });
    } catch (err) {
      console.error("Matchdagen: matchen kunde inte startas", err);
      S.spel = null;
      el.innerHTML = `<div class="md-panel md-tom"><h2>Något gick fel</h2><p>${esc(err?.meddelande || "Matchen kunde inte startas. Ladda om sidan och prova igen.")}</p></div>`;
    }
  });
}

async function nyKlubb(S, el) {
  if (S.lasfel) {
    el.innerHTML = `<div class="md-panel md-tom"><h2>Klubben kunde inte hämtas</h2><p>Prova att ladda om sidan om en stund.</p></div>`;
    return;
  }
  const v = await klubbFormular(el, {
    knapp: "Starta klubben",
    rubrik: "Din egen klubb",
    text: "Välkommen till Division 6! Döp ditt lag och välj tröjfärg. Spelarna har redan sina namn – en av dem är lagkapten.",
  });
  S.K = nyKarriar({ ...v, rng: Math.random });
  el.querySelector(".md-stor").disabled = true;
  try {
    await S.data.sparaKarriar(S.uid, S.K);
  } catch (err) {
    console.warn("Matchdagen: klubben kunde inte sparas än – sparas efter första matchen", err);
  }
  S.kassa();
  return visaMatchFlik(S, el);
}

/** Säsongen är slut: placeringen, och nästa säsong (Etapp 1: samma division – kvalet kommer i Etapp 2). */
async function sasongSlut(S, el) {
  const rader = tabellRader(S.K);
  const plac = rader.findIndex((r) => r.vi) + 1;
  const vann = plac === 1;
  el.innerHTML = `<div class="md-panel md-fore">
    <p class="md-overrad">Säsong ${S.K.sasong} · ${esc(DIVISIONER[S.K.div])} · klar</p>
    <h2>${vann ? "Ligavinnare!" : "Säsongen är slut"}</h2>
    <p>${vann
      ? `Ni vann ${esc(DIVISIONER[S.K.div])}! Pokalen står i Statistik. Nästa säsong väntar nya motståndare.`
      : `Ni slutade på plats ${plac} av ${rader.length} i ${esc(DIVISIONER[S.K.div])}. Nästa säsong får ni nya motståndare – vinn ligan!`}</p>
    <div class="md-rad"><button type="button" class="md-stor" data-ny>Starta nästa säsong</button><button type="button" class="md-ghost" data-tabell>Se tabellen</button></div>
  </div>`;
  el.querySelector("[data-tabell]").addEventListener("click", () => S.visa("tabell"));
  el.querySelector("[data-ny]").addEventListener("click", () => {
    // Samma frö vid omladdning: ligan lottas likadant tills första matchen sparar den.
    S.K = nySasong(S.K, skapaPrng(sasongFro(S.K, S.uid)).tal);
    visaMatchFlik(S, el);
  });
}
