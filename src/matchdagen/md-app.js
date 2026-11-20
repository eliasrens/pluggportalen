// ============================================================================
// Matchdagen (#869, Etapp 1c): elevens app – sidhuvudet med klubbkassan, flikarna
// Match, Tabell, Truppen och Statistik (spec §14), tillståndet och sparningen.
// Firebase skickas in som `data` (page-matchdagen.js ger den riktiga, förhands-
// visningen en stubbe), så samma kod kör i appen och i preview-matchdagen.html.
//
//   startaMatchdagen(host, { uid, inst, data, hamtaOmrade, avatar?, lagring?, tvinga2d?, signal? })
//     data: { lasKarriar, sparaKarriar, sparaMatch, lasMatch }
//
// Kvoten (§13): karriären läses EN gång här (lasKarriar), inga lyssnare. En
// färdig match som inte hann sparas (offline) ligger i localStorage och sparas
// om nästa gång (md-lokal.js).
// ============================================================================

import { MATCHDAGEN_IKON } from "../gamemode-visibility.js";
import { harKallor, normalizeInst } from "./md-inst.js";
import { karriarOk } from "./delat/md-sasong.js";
import { lasOsparad, rensaOsparad } from "./md-lokal.js";
import { esc, laddaTypsnitt } from "./vy/md-vy-delat.js";

const FLIKAR = [["match", "Match"], ["tabell", "Tabell"], ["trupp", "Truppen"], ["stat", "Statistik"]];

function webbLagring() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/** Den sparade karriären eller den lokala (osparade) – den som har flest matcher. */
async function hamtaKarriar(S) {
  let K = null;
  try { K = await S.data.lasKarriar(S.uid); } catch (err) { console.warn("Matchdagen: karriären kunde inte läsas", err); S.lasfel = true; }
  const osparad = lasOsparad(S.lagring, S.uid);
  if (osparad && (!karriarOk(K) || (osparad.K.summa?.matcher || 0) > (K.summa?.matcher || 0))) {
    try {
      await S.data.sparaMatch(S.uid, osparad.K, osparad.matchId, osparad.match);
      rensaOsparad(S.lagring, S.uid);
    } catch (err) { console.warn("Matchdagen: den osparade matchen kunde inte sparas än", err); }
    return osparad.K;
  }
  if (osparad) rensaOsparad(S.lagring, S.uid);
  return karriarOk(K) ? K : null;
}

export async function startaMatchdagen(host, deps) {
  laddaTypsnitt();
  const lugntMedia = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const inst = normalizeInst(deps.inst);
  const S = {
    uid: deps.uid, inst, data: deps.data, hamtaOmrade: deps.hamtaOmrade, avatar: deps.avatar || null,
    lagring: deps.lagring === undefined ? webbLagring() : deps.lagring,
    tvinga2d: !!deps.tvinga2d, signal: deps.signal, lugnt: !!inst.lugnt || lugntMedia,
    K: null, vy: "match", lasfel: false, sessionStart: Date.now(),
  };
  host.replaceChildren();
  host.className = "md-sida md-app";
  host.innerHTML = `<header class="md-huvud">
      <div class="md-logo"><span class="md-logo-boll" aria-hidden="true">${MATCHDAGEN_IKON}</span><span>Match<b>dagen</b></span></div>
      <span class="md-kassa" aria-live="polite"></span>
      <nav class="md-flikar" aria-label="Matchdagen">${FLIKAR.map(([id, t]) => `<button type="button" data-vy="${id}" aria-pressed="false">${t}</button>`).join("")}</nav>
    </header>
    ${FLIKAR.map(([id]) => `<section class="md-vy" data-vy-sektion="${id}" hidden></section>`).join("")}`;
  const sektion = (id) => host.querySelector(`[data-vy-sektion="${id}"]`);
  S.host = host;
  S.sektion = sektion;

  S.kassa = () => {
    host.querySelector(".md-kassa").textContent = S.K ? `${Number(S.K.kassa || 0).toLocaleString("sv-SE")} kr i klubbkassan` : "";
  };
  /** Byt flik. Matchen ligger kvar (pausad på frågan) när eleven tittar på en annan flik. */
  S.visa = async (vy) => {
    S.vy = vy;
    host.querySelectorAll(".md-flikar button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vy === vy)));
    for (const [id] of FLIKAR) sektion(id).hidden = id !== vy;
    S.kassa();
    const el = sektion(vy);
    if (vy === "match") return (await import("./vy/md-vy-match.js")).visaMatchFlik(S, el);
    if (!S.K) { el.innerHTML = `<div class="md-panel"><p class="md-svag">Skapa ditt lag under <b>Match</b> först.</p></div>`; return; }
    if (vy === "tabell") return (await import("./vy/md-vy-tabell.js")).visaTabell(S, el);
    if (vy === "trupp") return (await import("./vy/md-vy-trupp.js")).visaTrupp(S, el);
    if (vy === "stat") return (await import("./vy/md-vy-stat.js")).visaStat(S, el);
  };
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
  S.K = await hamtaKarriar(S);
  await S.visa("match");
  return S;
}
