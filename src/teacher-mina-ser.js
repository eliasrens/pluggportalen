// ============================================================================
// Pluggporten – lärarsidan: Mina klasser → Vad eleverna ser (teacher-mina-ser.js)
// ----------------------------------------------------------------------------
// #804 (epic #802 §3.3). De tre befintliga sektionerna blir EN sida med
// numrerade steg – sektionerna själva är oförändrade (samma data-anrop, samma
// Spara-knappar):
//   1. omraden   "Vilka områden jobbar ni med nu?" (hela områdesnamnen syns)
//   2. synlighet "Vilka delar ska finnas i elevernas meny?" (moduler, schack, byar)
//   3. lagen     "Avancerat: dölj vissa övningslägen i ett område" – ihopfälld,
//                ritas först när läraren fäller ut den
// Varje steg sparar för sig som förr; stegets rubrik visar tydligt "Sparat ✓"
// när sektionens egen bekräftelse (.ok-inline "✓ …") dyker upp, och "Inte
// sparat än" så fort något ändras efter det.
// Laddas med import() från teacher-mina-klasser.js (#271).
// ============================================================================

import { el, esc } from "./teacher-shared.js";
import { CLASS_SECTIONS, withLoading } from "./teacher-classes-sections.js";

const STEG = [
  { key: "omraden", titel: "Vilka områden jobbar ni med nu?", hjalp: "Kryssar du inte i några områden ser eleverna alla." },
  { key: "synlighet", titel: "Vilka delar ska finnas i elevernas meny?",
    hjalp: "Det du slår på här får sin statistik och sina inställningar under <b>Hur går det?</b>." },
  { key: "lagen", titel: "Avancerat: dölj vissa övningslägen i ett område", ihop: true,
    hjalp: "Till exempel ett område utan Memory. De flesta behöver aldrig ändra det här." },
];

/** Rita Vad eleverna ser för klassen `cls` i `host`. */
export function renderVadElevernaSer(ctx, cls, host, store) {
  const steg = STEG.map((s, i) => {
    const head = `<span class="mk-steg-nr" aria-hidden="true">${i + 1}</span>
      <h3 class="mk-steg-titel"><span class="sr-only">Steg ${i + 1}: </span>${esc(s.titel)}</h3>
      <span class="mk-sparat" role="status"></span>`;
    const body = `<p class="hint mk-steg-hjalp">${s.hjalp}</p><div class="mk-steg-body"></div>`;
    return s.ihop
      ? `<details class="mk-steg mk-steg-ihop" data-steg="${s.key}"><summary class="mk-steg-head">${head}</summary>${body}</details>`
      : `<section class="mk-steg" data-steg="${s.key}"><header class="mk-steg-head">${head}</header>${body}</section>`;
  }).join("");
  const box = el(`<div class="mk-ser">
    <p class="mk-ser-intro">Här bestämmer du <b>vad eleverna i ${esc(cls.name || cls.id)} ser</b>. Varje steg sparas för sig, och eleverna ser ändringen direkt.</p>
    ${steg}
  </div>`);
  host.replaceChildren(box);

  for (const s of STEG) {
    const stegEl = box.querySelector(`[data-steg="${s.key}"]`);
    const body = stegEl.querySelector(".mk-steg-body");
    sparStatus(stegEl, body);
    const rita = () => {
      const sec = CLASS_SECTIONS.find((x) => x.key === s.key);
      return withLoading(body, sec.what, () => sec.render(ctx, cls, body, store));
    };
    if (!s.ihop) rita();
    else stegEl.addEventListener("toggle", () => stegEl.open && !body.hasChildNodes() && rita());
  }
}

/**
 * "Sparat ✓" / "Inte sparat än" / "Kunde inte spara" i stegets rubrik, ur
 * sektionernas egna resultatrader (.ok-inline / .err-inline) och ändringar.
 * Ett steg kan ha flera sparegrupper med var sin Spara-knapp (steg 2: moduler +
 * byar) – grupp = värdens barn. "Sparat ✓" visas bara när INGEN grupp har
 * osparade ändringar; att spara byarna gör inte modulerna sparade (#804 F1).
 */
function sparStatus(stegEl, body) {
  const status = stegEl.querySelector(".mk-sparat");
  const osparade = new Set();
  let fel = false;
  let sparat = false;
  const grupp = (n) => {
    while (n && n.parentElement !== body) n = n.parentElement;
    return n || body;
  };
  const rita = () => {
    const [cls, text] = fel ? ["fel", "Kunde inte spara"]
      : osparade.size ? ["andrat", "Inte sparat än"]
      : sparat ? ["ok", "Sparat ✓"] : ["", ""];
    status.className = `mk-sparat ${cls}`.trim();
    status.textContent = text;
  };
  new MutationObserver((poster) => {
    for (const p of poster) {
      for (const n of p.addedNodes) {
        if (n.nodeType !== 1) continue;
        const ok = n.matches(".ok-inline") ? n : n.querySelector(".ok-inline");
        const err = n.matches(".err-inline") ? n : n.querySelector(".err-inline");
        if (ok) {
          osparade.delete(grupp(ok));
          sparat = true;
          fel = false;
        } else if (err && /spara/i.test(err.textContent)) fel = true;
        else continue;
        rita();
      }
    }
  }).observe(body, { childList: true, subtree: true });
  const andrat = (n) => {
    osparade.add(grupp(n));
    fel = false;
    rita();
  };
  body.addEventListener("change", (e) => andrat(e.target));
  body.addEventListener("click", (e) => {
    const knapp = e.target.closest("[data-act]");
    if (knapp && !/^save/.test(knapp.dataset.act)) andrat(knapp);
  });
}
