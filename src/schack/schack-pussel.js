// ============================================================================
// Pusslen "Matt i ett drag" / "Matt i två drag" (#791, spec §13) – ren modul
// utan DOM: pusselbanken (lat), bedömningen av elevens drag, tipset och
// framstegen (studentData.schack.pussel). Ritas av schack-pussel-vy.js.
//
// Banken: src/schack/pussel/matt-i-ett.json och matt-i-tva.json, byggda av
// admin/schack-pussel.mjs ur Lichess öppna pusseldatabas (CC0, se pussel/README.md).
// Varje pussel: { id, fen, senast, losning: [UCI…], rating } – `fen` är ställningen
// där VIT är vid draget, `senast` motståndarens drag som just gjordes (markeras),
// `losning` = [vitt drag] (matt i ett) eller [vitt, svart försvar, vitt] (matt i två).
// JSON:en hämtas med fetch först när pusselvyn öppnas – aldrig statiskt importerad.
//
// Bedömningen: ett drag som ger matt när det är dags för matt är ALLTID rätt
// (även ett annat mattdrag än lösningens). Matt i två: första draget måste vara
// lösningens (skriptet har tagit bort pussel där ett annat första drag också
// tvingar fram matt), sedan gör datorn försvaret ur lösningen.
//
// Framstegen: { ett: { losta, senast }, tva: { losta, senast } } – `senast` = numret
// (1, 2, …) på det senast lösta NYA pusslet, `losta` = hur många nya pussel som lösts.
// Ett pussel räknas bara när dess nummer är större än `senast` (EN skrivning); att
// göra om ett gammalt pussel skriver ingenting. Var eleven står (även efter "Hoppa
// över") sparas bara lokalt i localStorage.
// ============================================================================

import { Chess } from "./vendor/chess.js";

export const SORTER = {
  ett: { id: "ett", fil: "matt-i-ett.json", titel: "Matt i ett drag", uppgift: "Vit drar och gör matt i ett drag", drag: 1 },
  tva: { id: "tva", fil: "matt-i-tva.json", titel: "Matt i två drag", uppgift: "Vit drar och gör matt i två drag", drag: 2 },
};
export const ARSORT = (s) => Object.hasOwn(SORTER, s);

export const TEXT = {
  ratt: "Snyggt! Schack matt! ⭐",
  fel: "Inte riktigt – prova igen!",
  forstaRatt: "Bra drag! Nu försvarar sig svart …",
  nuMatt: "Nu: gör matt i ett drag!",
  tips: "Tips: flytta den markerade pjäsen.",
  tipsDrag: (san) => `Tips: ${san}`,
};

/** UCI ("e7e8q") → { from, to, promotion? } */
export function uciDrag(s) {
  const d = { from: s.slice(0, 2), to: s.slice(2, 4) };
  if (s[4]) d.promotion = s[4];
  return d;
}

const cache = new Map();

/**
 * Hämta en sorts pussel (lat, en gång per sida). `hamta` = fetch (injicerbar i tester).
 * Returnerar listan; kastar om filen inte går att läsa.
 */
export function laddaPussel(sort, { hamta } = {}) {
  if (!ARSORT(sort)) return Promise.reject(new Error(`okänd sort ${sort}`));
  if (!hamta && cache.has(sort)) return cache.get(sort);
  const f = hamta || ((u) => fetch(u));
  const p = Promise.resolve(f(new URL(`./pussel/${SORTER[sort].fil}`, import.meta.url).href))
    .then((svar) => {
      if (svar && typeof svar.json === "function") {
        if (svar.ok === false) throw new Error(`pusslen: HTTP ${svar.status}`);
        return svar.json();
      }
      return svar;
    })
    .then((data) => {
      const lista = Array.isArray(data?.pussel) ? data.pussel : [];
      if (!lista.length) throw new Error("pusslen: tom bank");
      return lista;
    });
  if (!hamta) {
    cache.set(sort, p);
    p.catch(() => cache.delete(sort));
  }
  return p;
}

/**
 * Ett pussel utan DOM. Brädet (beforeMove) frågar `bedom(drag)` för varje drag eleven gör.
 *   bedom({from,to,promotion}) → { ok, klart, text, forsvar? }
 *       ok=false: draget nekas (pjäsen hoppar tillbaka).
 *       ok, !klart: matt i två, rätt första drag – `forsvar` = datorns drag att spela.
 *       ok, klart: matt – pusslet löst.
 *   tips() → { from, to, san } – lösningens nästa drag (från = pjäsen att markera)
 *   fen()  → ställningen just nu (efter försvaret i matt i två)
 */
export function skapaPusselLopp(pussel, sort) {
  const chess = new Chess(pussel.fen);
  let steg = 0; // index i losning för elevens nästa drag (0, sedan 2 i matt i två)
  let klart = false;
  let fel = 0;
  const sista = () => steg === pussel.losning.length - 1;

  function bedom(drag) {
    if (klart) return { ok: false, klart: true, text: "" };
    let gjort;
    try {
      gjort = chess.move({ from: drag.from, to: drag.to, promotion: drag.promotion || undefined });
    } catch {
      gjort = null;
    }
    if (!gjort) { fel++; return { ok: false, klart: false, text: TEXT.fel }; }
    if (sista()) {
      if (chess.isCheckmate()) {
        klart = true;
        return { ok: true, klart: true, text: TEXT.ratt };
      }
      chess.undo();
      fel++;
      return { ok: false, klart: false, text: TEXT.fel };
    }
    const facit = uciDrag(pussel.losning[steg]);
    if (gjort.from !== facit.from || gjort.to !== facit.to || (gjort.promotion || undefined) !== facit.promotion) {
      chess.undo();
      fel++;
      return { ok: false, klart: false, text: TEXT.fel };
    }
    const forsvar = uciDrag(pussel.losning[steg + 1]);
    chess.move(forsvar);
    steg += 2;
    return { ok: true, klart: false, text: TEXT.forstaRatt, forsvar };
  }

  function tips() {
    if (klart) return null;
    const d = uciDrag(pussel.losning[steg]);
    const c = new Chess(chess.fen());
    let san = "";
    try { san = c.move(d).san; } catch { /* lösningen är kontrollerad av skriptet */ }
    return { ...d, san };
  }

  return {
    sort,
    pussel,
    bedom,
    tips,
    fen: () => chess.fen(),
    klart: () => klart,
    fel: () => fel,
    /** Vilket drag i ordningen eleven är på: 1, eller 2 efter försvaret (matt i två). */
    elevDrag: () => steg / 2 + 1,
  };
}

// --- Framstegen --------------------------------------------------------------

const heltal = (v, max = 10_000) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);

/** studentData.schack.pussel → { ett: { losta, senast }, tva: { losta, senast } } (trasigt = 0). */
export function normaliseraFramsteg(m) {
  const ut = {};
  for (const s of Object.keys(SORTER)) {
    const x = m && typeof m === "object" && m[s] && typeof m[s] === "object" ? m[s] : {};
    ut[s] = { losta: heltal(x.losta), senast: heltal(x.senast) };
  }
  return ut;
}

/** Är pussel nummer `nr` (1-baserat) nytt, så att det ska räknas och sparas? */
export function arNyttLost(framsteg, sort, nr) {
  return Number.isInteger(nr) && nr >= 1 && nr > normaliseraFramsteg(framsteg)[sort].senast;
}

/** Framstegen efter att pussel `nr` lösts (oförändrade om det inte var nytt). */
export function efterLost(framsteg, sort, nr) {
  const f = normaliseraFramsteg(framsteg);
  if (!arNyttLost(f, sort, nr)) return f;
  return { ...f, [sort]: { losta: f[sort].losta + 1, senast: nr } };
}

/**
 * Vilket pussel eleven ska få: det lokalt sparade läget om det finns, annars
 * nästa efter det senast lösta. Alltid inom 1..antal.
 */
export function startNummer(framsteg, lokalt, sort, antal) {
  const n = Number.isInteger(lokalt) && lokalt >= 1 ? lokalt : normaliseraFramsteg(framsteg)[sort].senast + 1;
  return Math.min(Math.max(1, n), Math.max(1, antal));
}

/** Var eleven står per sort, lokalt (localStorage inom try/catch): { ett: nr, tva: nr }. */
export function lasLage(lagring, nyckel) {
  try {
    const v = JSON.parse(lagring?.getItem(nyckel) || "{}");
    const ut = {};
    for (const s of Object.keys(SORTER)) if (Number.isInteger(v?.[s]) && v[s] >= 1) ut[s] = v[s];
    return ut;
  } catch {
    return {};
  }
}

export function sparaLage(lagring, nyckel, sort, nr) {
  try {
    lagring?.setItem(nyckel, JSON.stringify({ ...lasLage(lagring, nyckel), [sort]: nr }));
  } catch { /* full kvot / privat läge – läget är bara en bekvämlighet */ }
}
