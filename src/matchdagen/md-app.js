// ============================================================================
// Matchdagen (#869, Etapp 1c): elevens app – sidhuvudet med klubbkassan, flikarna
// Match, Tabell, Truppen och Statistik (spec §14), tillståndet och sparningen.
// Etapp 3 (#873): fliken Pokalskåpet (§10.4) och klubbmärket i sidhuvudet – guldkant för
// mästare i Superligan och en guldstjärna per legendklubb (§10.1, §10.3).
// Etapp 4 (#874): fliken Vänskap (vänskapsmatcher mot klasskompisar, vanskap/md-vy-vanskap.js) –
// bara när page-matchdagen.js hittat elevens klass (deps.vanskap) och den inte är pausad (#894,
// VANSKAP.pausad i md-config.js). #878: helskärmsknappen i
// sidhuvudet (md-helskarm.js). #880: fliken Topplista (topp 5 per årskurs, vy/md-vy-topplista.js) –
// öppen även innan klubben finns; deps.arskurs = elevens årskurs (page-matchdagen.js).
// Firebase skickas in som `data` (page-matchdagen.js ger den riktiga, förhands-
// visningen en stubbe), så samma kod kör i appen och i preview-matchdagen.html.
//
//   startaMatchdagen(host, { uid, inst, data, hamtaOmrade, avatar?, lagring?, tvinga2d?, signal?, vanskap?, arskurs? })
//     vanskap: { classId, kompisar(), moln() } (md-vy-vanskap.js)
//     data: { lasKarriar, sparaKarriar, sparaMatch, lasMatch, lasTopplista }
//     arskurs: "4" | "ovriga" | null (md-topplista.js elevArskurs)
//
// Kvoten (§13): karriären läses EN gång här (lasKarriar), inga lyssnare. Färdiga
// matcher som inte hann sparas (offline) ligger i en kö i localStorage och sparas
// om nästa gång (md-lokal.js, md-spara.js).
// ============================================================================

import { MATCHDAGEN_IKON } from "../gamemode-visibility.js";
import { harKallor, normalizeInst } from "./md-inst.js";
import { hamtaKarriar } from "./md-spara.js";
import { truppFalt } from "./delat/md-trupp.js";
import { esc, laddaTypsnitt } from "./vy/md-vy-delat.js";
import { marke } from "./vy/md-vy-pokaler.js";
import { monteraHelskarm } from "./md-helskarm.js";
import { VANSKAP } from "./delat/md-config.js";

const FLIKAR = [["match", "Match"], ["tabell", "Tabell"], ["trupp", "Truppen"], ["stat", "Statistik"], ["pokaler", "Pokalskåpet"], ["topplista", "Topplista"]];

/**
 * Flikarna: Vänskap bara med en klass (deps.vanskap) och när vänskapsmatcherna inte är pausade
 * (#894, VANSKAP.pausad). Utan fliken går det inte att utmana någon från appen.
 */
export function flikarFor(vanskap, pausad = VANSKAP.pausad) {
  return vanskap && !pausad ? [...FLIKAR, ["vanskap", "Vänskap"]] : FLIKAR;
}

function webbLagring() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export async function startaMatchdagen(host, deps) {
  laddaTypsnitt();
  const flikar = flikarFor(deps.vanskap);
  const lugntMedia = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const inst = normalizeInst(deps.inst);
  const S = {
    uid: deps.uid, inst, data: deps.data, hamtaOmrade: deps.hamtaOmrade, avatar: deps.avatar || null,
    lagring: deps.lagring === undefined ? webbLagring() : deps.lagring,
    tvinga2d: !!deps.tvinga2d, signal: deps.signal, lugnt: !!inst.lugnt || lugntMedia, vanskap: deps.vanskap || null, arskurs: deps.arskurs ?? null,
    K: null, vy: "match", lasfel: false, sessionStart: Date.now(),
  };
  host.replaceChildren();
  host.className = "md-sida md-app";
  host.innerHTML = `<header class="md-huvud">
      <div class="md-logo"><span class="md-logo-boll" aria-hidden="true">${MATCHDAGEN_IKON}</span><span>Match<b>dagen</b></span></div>
      <span class="md-klubbhuvud"></span>
      <span class="md-kassa" aria-live="polite"></span>
      <nav class="md-flikar" aria-label="Matchdagen">${flikar.map(([id, t]) => `<button type="button" data-vy="${id}" aria-pressed="false">${t}</button>`).join("")}</nav>
    </header>
    ${flikar.map(([id]) => `<section class="md-vy" data-vy-sektion="${id}" hidden></section>`).join("")}`;
  const sektion = (id) => host.querySelector(`[data-vy-sektion="${id}"]`);
  // Helskärm (#878): knappen före flikarna; reserv utan Fullscreen-API (iPhone).
  S.helskarm = monteraHelskarm(host, { signal: S.signal });
  host.querySelector(".md-flikar").before(S.helskarm.knapp);
  S.host = host;
  S.sektion = sektion;

  /** Sidhuvudet: klubbmärket och namnet (nytt namn, guldkant, legendklubb) och klubbkassan. */
  S.kassa = () => {
    host.querySelector(".md-kassa").textContent = S.K ? `${Number(S.K.kassa || 0).toLocaleString("sv-SE")} kr i klubbkassan` : "";
    host.querySelector(".md-klubbhuvud").innerHTML = S.K ? `${marke(S.K)}<span class="md-klubbhuvud-namn">${esc(S.K.klubb?.namn)}</span>` : "";
  };
  /**
   * Byt flik. Matchen ligger kvar (pausad på frågan) när eleven tittar på en annan flik.
   * S.flik avbryts vid varje flikbyte – träningslägrets fråga (Truppen) stängs då; svaren
   * är redan sparade lokalt och lägret fortsätter när eleven kommer tillbaka (#871).
   */
  S.visa = async (vy) => {
    if (!flikar.some(([id]) => id === vy)) vy = "match"; // t.ex. Vänskap när den är pausad (#894)
    S.vy = vy;
    S.flik?.abort();
    S.flik = new AbortController();
    host.querySelectorAll(".md-flikar button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vy === vy)));
    for (const [id] of flikar) sektion(id).hidden = id !== vy;
    S.kassa();
    const el = sektion(vy);
    if (vy === "match") return (await import("./vy/md-vy-match.js")).visaMatchFlik(S, el);
    if (vy === "topplista") return (await import("./vy/md-vy-topplista.js")).visaTopplista(S, el);
    if (!S.K) { el.innerHTML = `<div class="md-panel"><p class="md-svag">Skapa ditt lag under <b>Match</b> först.</p></div>`; return; }
    if (vy === "tabell") return (await import("./vy/md-vy-tabell.js")).visaTabell(S, el);
    if (vy === "trupp") return (await import("./vy/md-vy-trupp.js")).visaTrupp(S, el);
    if (vy === "stat") return (await import("./vy/md-vy-stat.js")).visaStat(S, el);
    if (vy === "pokaler") return (await import("./vy/md-vy-pokaler.js")).visaPokaler(S, el);
    if (vy === "vanskap") return (await import("./vanskap/md-vy-vanskap.js")).visaVanskap(S, el);
  };
  S.signal?.addEventListener("abort", () => S.flik?.abort(), { once: true });
  host.querySelector(".md-flikar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-vy]");
    if (b) S.visa(b.dataset.vy);
  });

  if (!harKallor(inst)) {
    sektion("match").hidden = false;
    sektion("match").innerHTML = `<div class="md-panel md-tom"><h2>Ingen match än</h2><p>${esc(deps.meddelande || "Din lärare har inte valt några frågor än")}</p></div>`;
    host.querySelector(".md-flikar").hidden = true;
    return S;
  }
  S.K = truppFalt(await hamtaKarriar(S));
  // Även när vänskapsmatcherna är pausade (#894): en match som redan pågick räknas in i S.K när
  // den slutar, så att appen inte sparar över serverns kassa.
  if (S.vanskap && S.K) vanskapPagar(S);
  await S.visa("match");
  return S;
}

/**
 * En vänskapsmatch som pågår (en annan flik, en omladdning): vakten lyssnar tills den slutar, så att
 * kassan och de inbördes mötena räknas in i S.K innan appen sparar karriären igen. EN läsning.
 */
async function vanskapPagar(S) {
  try {
    const moln = await S.vanskap.moln();
    const { aktiv } = await moln.lasElev(S.uid);
    if (typeof aktiv === "string" && aktiv) (await import("./vanskap/md-vy-vanskap.js")).bevaka(S, moln, aktiv);
  } catch (err) { console.warn("Matchdagen: vänskapsmatchen kunde inte kollas", err); }
}
