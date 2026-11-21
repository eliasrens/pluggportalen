// ============================================================================
// Matchdagen i helskärm (#878): knappen i sidhuvudet (md-app.js) visar hela appen
// i helskärm med Fullscreen-API:t (src/helskarm.js, webkit-prefix som reserv –
// datorn, Chromebook, iPad). Där API:t saknas (Safari på iPhone) blir det en
// RESERV: sidomenyn, hamburgaren och överlägget döljs och appen fyller fönstret
// (position: fixed). Esc eller knappen lämnar båda lägena; att lämna sidan också.
//
//   monteraHelskarm(host, { signal?, doc? }) → { knapp, aktiv(), lamna() }
//     host    appens rot (.md-app) – den som visas i helskärm
//     signal  sidans AbortSignal: vid abort lämnas helskärmen och lyssnarna tas bort
//
// Klasser: .md-helskarm-pa på host i båda lägena, .md-helskarm-reserv i reserven och
// html.md-helskarm-sida (döljer menyn) – 49-matchdagen-match.css. Planens höjd räknas
// om (md-match-spel.js lyssnar på resize) när läget byts.
// ============================================================================

import { fullscreenSupported, goIn, goUt, helskarmElement, lyssna } from "../helskarm.js";

const IN = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
const UT = '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>';
const ikon = (d) => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.4"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;

export function monteraHelskarm(host, { signal, doc = document } = {}) {
  const api = fullscreenSupported(doc);
  let reserv = false; // reservläget (ingen Fullscreen-API)
  const knapp = doc.createElement("button");
  knapp.type = "button";
  knapp.className = "md-helskarm-knapp";

  const aktiv = () => reserv || helskarmElement(doc) === host;
  const rita = () => {
    const pa = aktiv();
    host.classList.toggle("md-helskarm-pa", pa);
    host.classList.toggle("md-helskarm-reserv", reserv);
    doc.documentElement.classList.toggle("md-helskarm-sida", reserv);
    const text = pa ? "Lämna helskärm" : "Helskärm";
    knapp.innerHTML = `${ikon(pa ? UT : IN)}<span class="md-helskarm-text">${text}</span>`;
    knapp.setAttribute("aria-pressed", String(pa));
    knapp.setAttribute("aria-label", text);
    knapp.title = pa ? "Lämna helskärm (Esc)" : "Helskärm";
    doc.defaultView?.dispatchEvent(new Event("resize")); // planens höjd följer
  };
  const satt = (pa) => { reserv = pa; rita(); };
  const lamna = () => {
    if (reserv) satt(false);
    else if (helskarmElement(doc) === host) goUt(doc);
  };

  knapp.addEventListener("click", () => {
    if (aktiv()) lamna();
    else if (api) goIn(host, doc);
    else satt(true);
  });
  // Esc lämnar reserven (i riktig helskärm gör webbläsaren det själv).
  const tangent = (e) => { if (reserv && e.key === "Escape") satt(false); };
  doc.addEventListener("keydown", tangent);
  const sluta = lyssna(rita, doc);
  rita();

  signal?.addEventListener("abort", () => {
    sluta();
    doc.removeEventListener("keydown", tangent);
    lamna();
    host.classList.remove("md-helskarm-pa", "md-helskarm-reserv");
    doc.documentElement.classList.remove("md-helskarm-sida");
  }, { once: true });
  return { knapp, aktiv, lamna };
}
