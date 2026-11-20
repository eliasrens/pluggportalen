// ============================================================================
// Matchdagen (#869): MATCH-fliken (spec §5, §14) – ny klubb första gången,
// rutan före avspark ("Säsong 1 · Division 6 · Omgång 2 av 5", lagen, Avspark!),
// en pågående match att fortsätta, och när säsongen är slut: placeringen och
// "Starta nästa säsong". Ligavinnaren (#870, §7.2) får först rutan före kvalet
// ("KVAL till Division 5 · … är ett lag från divisionen ovanför"), och säsongs-
// rutan berättar sedan hur kvalet gick. Själva matchen spelas i md-match-spel.js.
// ============================================================================

import { DIVISIONER, TOPP_DIV, TRANING } from "../delat/md-config.js";
import { kvalMatch } from "../delat/md-kval.js";
import { nastaMatch, nyKarriar, nySasong, sasongFro, tabellRader } from "../delat/md-sasong.js";
import { skapaPrng } from "../delat/md-prng.js";
import { lagerNyckel } from "../delat/md-trupp.js";
import { lasLager, lasPagaende } from "../md-lokal.js";
import { klubbFormular } from "./md-vy-klubb.js";
import { chip, esc } from "./md-vy-delat.js";

/** "Säsong 1 · Division 6 · Omgång 2 av 5" */
export const omgangText = (K, n) => `Säsong ${K.sasong} · ${DIVISIONER[K.div]} · Omgång ${n.omg + 1} av ${n.antal}`;
/** "KVAL till Division 5 · Ekebacka IF är ett lag från divisionen ovanför" (skissen). */
export const kvalText = (kv) => `KVAL till ${DIVISIONER[kv.till]} · ${kv.mot.namn} är ett lag från divisionen ovanför`;

/** Nästa match: ligamatchen, eller kvalet när ligan är slut och laget vann den – annars null. */
export function nastaSpel(K) {
  const n = nastaMatch(K);
  if (n) return { typ: "liga", ...n, text: omgangText(K, n) };
  const kv = kvalMatch(K);
  return kv ? { typ: "kval", omg: K.liga.omg, antal: K.liga.schema.length, mot: kv.mot, kval: kv, text: kvalText(kv) } : null;
}

const pagarText = (p) => {
  const m = p.m;
  if (m.straffar || (m.slut && m.oss === m.dem)) {
    const [a, b] = [m.straffar?.oss || [], m.straffar?.dem || []].map((l) => l.filter(Boolean).length);
    return `Straffläggningen pågår: <b>${Number(a)} – ${Number(b)}</b> (${Number(m.oss)} – ${Number(m.dem)} efter full tid).`;
  }
  return `Matchen pågår: <b>${Number(m.oss)} – ${Number(m.dem)}</b> efter ${Math.round(Number(m.min) || 0)} minuter.`;
};

export async function visaMatchFlik(S, el) {
  if (S.spel?.pagar) return; // matchen ligger kvar där eleven lämnade den
  if (!S.K) return nyKlubb(S, el);
  const n = nastaSpel(S.K);
  if (!n) return sasongSlut(S, el);
  const pagaende = lasPagaende(S.lagring, S.uid, S.K, n.typ);
  // Ett påbörjat träningsläger sparas före nästa match (lägret och matchen i samma skrivning
  // ryms inte i reglerna, och nästa match skulle stänga lägret) – #871.
  const lager = !pagaende && lasLager(S.lagring, S.uid, S.K);
  if (lager) return lagerVantar(S, el, lager);
  const vi = S.K.klubb;
  const kval = n.typ === "kval";
  el.innerHTML = `<div class="md-panel md-fore${kval ? " md-kval" : ""}">
    <p class="md-overrad">${esc(n.text)}</p>
    <h2 class="md-motet"><span>${chip(vi.farg)}${esc(vi.namn)}</span><span class="md-mot-streck">–</span><span>${chip(n.mot.farg)}${esc(n.mot.namn)}</span></h2>
    ${pagaende
      ? `<p class="md-pagar">${pagarText(pagaende)}</p>`
      : kval
        ? `<p>Ni vann ${esc(DIVISIONER[n.kval.div])}! Vinner ni kvalet går ni upp till <b>${esc(DIVISIONER[n.kval.till])}</b>. Blir det oavgjort avgörs det på straffar – fem var, sedan sudden death.</p>`
        : `<p class="md-svag">Varje drag ger en fråga. Svarar du rätt lyckas passet eller skottet oftare – men även snygga skott kan räddas, och långskott går sällan in.</p>`}
    ${!pagaende && lagerNyckel(S.K) ? `<p class="md-tips">Ni har ett träningsläger ledigt under <button type="button" class="md-lank" data-trupp>Truppen</button> – det går förlorat när nästa match spelas.</p>` : ""}
    <div class="md-rad">
      <button type="button" class="md-stor" data-avspark>${pagaende ? "Fortsätt matchen" : "Avspark!"}</button>
      ${S.lugnt ? `<span class="md-lugnt-etikett">Lugnt läge</span>` : ""}
    </div>
    <p class="md-fel" aria-live="polite"></p>
  </div>`;
  el.querySelector("[data-trupp]")?.addEventListener("click", () => S.visa("trupp"));
  el.querySelector("[data-avspark]").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    const { spelaMatch } = await import("./md-match-spel.js");
    try {
      await spelaMatch(S, el, { pagaende, spel: n });
    } catch (err) {
      console.error("Matchdagen: matchen kunde inte startas", err);
      S.spel = null;
      el.innerHTML = `<div class="md-panel md-tom"><h2>Något gick fel</h2><p>${esc(err?.meddelande || "Matchen kunde inte startas. Ladda om sidan och prova igen.")}</p></div>`;
    }
  });
}

/** Ett påbörjat (eller osparat) träningsläger: eleven gör klart det under Truppen först. */
function lagerVantar(S, el, lager) {
  const p = S.K.trupp.find((x) => x.id === lager.spelareId);
  const klart = lager.svar.length >= TRANING.fragor;
  el.innerHTML = `<div class="md-panel md-fore">
    <p class="md-overrad">Träningslägret</p>
    <h2>Gör klart träningen först</h2>
    <p>${klart ? `Träningen med ${esc(p?.namn)} är klar men inte sparad än.` : `${esc(p?.namn)} tränar – ${Number(lager.svar.length)} av ${TRANING.fragor} frågor besvarade.`} Gör klart lägret under Truppen innan nästa match.</p>
    <div class="md-rad"><button type="button" class="md-stor" data-trupp>Till Truppen</button></div>
  </div>`;
  el.querySelector("[data-trupp]").addEventListener("click", () => S.visa("trupp"));
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

/** Kvalets resultat: "2 – 1" eller "1 – 1 (straffar 4 – 3)" – bara tal (dokumentet skrivs av eleven). */
export const kvalResultat = (k) => `${Number(k.oss) || 0} – ${Number(k.dem) || 0}${Array.isArray(k.straffar) ? ` (straffar ${Number(k.straffar[0]) || 0} – ${Number(k.straffar[1]) || 0})` : ""}`;

/** Rubrik och text när säsongen (och kvalet) är slut. Ingen åker ner (§7.2). */
export function sasongSlutText(K, plac, antal) {
  const k = K.kval?.spelad ? K.kval : null;
  const ligaDiv = k ? Number(k.div) || 0 : K.div;
  if (k?.vann) return { rubrik: "Uppflyttning!", text: `Kvalet slutade ${kvalResultat(k)}. Ni går upp till ${DIVISIONER[K.div]}! Motståndet blir tuffare – fler lag och starkare motståndare.` };
  if (k) return { rubrik: "Nära!", text: `Kvalet slutade ${kvalResultat(k)}. Ni stannar i ${DIVISIONER[ligaDiv]} och får en ny chans nästa säsong.` };
  if (plac === 1 && K.div >= TOPP_DIV) return { rubrik: "Mästare!", text: `Ni vann ${DIVISIONER[K.div]} – den högsta ligan! Ni är bäst av alla.` };
  return { rubrik: "Säsongen är slut", text: `Ni slutade på plats ${plac} av ${antal} i ${DIVISIONER[K.div]}. Vinn ligan nästa säsong för att få kvala upp!` };
}

/** Säsongen är slut: placeringen, kvalets utfall och nästa säsong. */
async function sasongSlut(S, el) {
  const rader = tabellRader(S.K);
  const plac = rader.findIndex((r) => r.vi) + 1;
  const t = sasongSlutText(S.K, plac, rader.length);
  el.innerHTML = `<div class="md-panel md-fore">
    <p class="md-overrad">Säsong ${Number(S.K.sasong) || 1} · ${esc(DIVISIONER[S.K.kval?.spelad ? Number(S.K.kval.div) || 0 : S.K.div])} · klar</p>
    <h2>${esc(t.rubrik)}</h2>
    <p>${esc(t.text)}</p>
    <div class="md-rad"><button type="button" class="md-stor" data-ny>Starta nästa säsong</button><button type="button" class="md-ghost" data-tabell>Se tabellen</button></div>
  </div>`;
  el.querySelector("[data-tabell]").addEventListener("click", () => S.visa("tabell"));
  el.querySelector("[data-ny]").addEventListener("click", () => {
    startaNastaSasong(S);
    visaMatchFlik(S, el);
  });
}

/**
 * Nästa säsong (Match-fliken och Tabell-fliken efter sista omgången). Samma frö vid
 * omladdning: ligan lottas likadant tills första matchen sparar den.
 */
export function startaNastaSasong(S) {
  if (!nastaSpel(S.K)) S.K = nySasong(S.K, skapaPrng(sasongFro(S.K, S.uid)).tal);
}
