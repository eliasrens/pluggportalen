// ============================================================================
// Stjärnjakten (#790, guiden §12, lektion 2–8): EN vit pjäs på ett bräde utan
// kungar, några stjärnor att samla och ibland svarta pjäser att ta (de står
// still) eller egna bönder som står i vägen. Ren modul utan DOM.
//
// Varför egen draggenerering: chess.js kräver två kungar, och med
// `skipValidation` blir dragen fel (schackregler mot en kung som inte finns).
// En ensam pjäs på ett nästan tomt bräde är enkel att räkna själv – och
// test/schack-guide.test.js jämför varje pjästyp på varje ruta med chess.js.
//
//   jaktDrag(typ, fran, hinder)          → [{ to, tar }]   hinder: Map ruta → "egen" | "fiende"
//   minstaDrag(uppgift)                  → { drag, vag }   BFS: minsta antal drag + en lösning
//   skapaJaktKontroll(uppgift, opt)      → kontroll med samma API som schack-kontroll.js
//                                          (skapaSchackbrade(rot, { kontroll }))
// uppgift = { pjas: "r"|"b"|"q"|"k"|"n"|"p", fran, stjarnor: [ruta], fiender?: [{ ruta, typ }], egna?: [ruta] }
// ============================================================================

const FILER = "abcdefgh";
const RAK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SNETT = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const HOPP = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const GLIDER = { r: RAK, b: SNETT, q: [...RAK, ...SNETT] };
/** Pjäsens namn i bestämd form ("Flytta tornet."). */
export const BESTAMD = { r: "tornet", b: "löparen", q: "damen", k: "kungen", n: "springaren", p: "bonden" };

const xy = (ruta) => [FILER.indexOf(ruta[0]), Number(ruta[1]) - 1];
const ruta = (x, y) => (x >= 0 && x < 8 && y >= 0 && y < 8 ? FILER[x] + (y + 1) : null);

/**
 * Den vita pjäsens drag från `fran`. Egna pjäser stoppar, svarta kan tas (och stoppar).
 * Bonden går ett steg framåt (två från rad 2 om båda rutorna är tomma) och tar snett
 * framåt; på rad 8 går den inte längre (lektionerna förvandlar aldrig – det gör lektion 11).
 */
export function jaktDrag(typ, fran, hinder = new Map()) {
  const [x, y] = xy(fran);
  const ut = [];
  const prova = (t) => {
    if (!t) return false;
    const h = hinder.get(t);
    if (h === "egen") return false;
    ut.push({ to: t, tar: h === "fiende" });
    return !h;
  };
  if (GLIDER[typ]) {
    for (const [dx, dy] of GLIDER[typ]) {
      for (let i = 1; i < 8; i++) if (!prova(ruta(x + dx * i, y + dy * i))) break;
    }
  } else if (typ === "k" || typ === "n") {
    for (const [dx, dy] of typ === "k" ? [...RAK, ...SNETT] : HOPP) prova(ruta(x + dx, y + dy));
  } else if (typ === "p") {
    const ett = ruta(x, y + 1);
    if (ett && !hinder.has(ett)) {
      ut.push({ to: ett, tar: false });
      const tva = ruta(x, y + 2);
      if (y === 1 && !hinder.has(tva)) ut.push({ to: tva, tar: false });
    }
    for (const dx of [-1, 1]) {
      const t = ruta(x + dx, y + 1);
      if (t && hinder.get(t) === "fiende") ut.push({ to: t, tar: true });
    }
  }
  return ut;
}

/** Hindren i ett läge: egna bönder + de svarta pjäser som inte tagits än. */
function hinderFor(uppgift, kvarFiender) {
  const h = new Map();
  for (const r of uppgift.egna || []) h.set(r, "egen");
  for (const f of kvarFiender) h.set(f.ruta, "fiende");
  return h;
}

/** Målen = stjärnorna + de svarta pjäserna (allt ska samlas/tas). */
export function malFor(uppgift) {
  return [...uppgift.stjarnor, ...(uppgift.fiender || []).map((f) => f.ruta)];
}

/**
 * BFS över (pjäsens ruta, kvarvarande mål): minsta antal drag för att samla allt
 * från läget `{ ruta, kvar }` (standard: uppgiftens start). `{ drag: Infinity, vag: null }`
 * om det inte går (t.ex. bonden har gått förbi en stjärna).
 */
export function minstaDrag(uppgift, start = null) {
  const mal = malFor(uppgift);
  const fiendeVid = new Map((uppgift.fiender || []).map((f) => [f.ruta, f]));
  const fran = start?.ruta || uppgift.fran;
  const kvar0 = start?.kvar ? new Set(start.kvar) : new Set(mal);
  let mask0 = 0;
  mal.forEach((m, i) => { if (kvar0.has(m)) mask0 |= 1 << i; });
  if (!mask0) return { drag: 0, vag: [] };
  const nyckel = (r, m) => `${r}:${m}`;
  const forra = new Map([[nyckel(fran, mask0), null]]);
  let ko = [[fran, mask0]];
  for (let djup = 1; ko.length; djup++) {
    const nasta = [];
    for (const [r, mask] of ko) {
      const fiender = mal.flatMap((m, i) => (mask & (1 << i) && fiendeVid.has(m) ? [fiendeVid.get(m)] : []));
      for (const d of jaktDrag(uppgift.pjas, r, hinderFor(uppgift, fiender))) {
        const i = mal.indexOf(d.to);
        const nyMask = i >= 0 ? mask & ~(1 << i) : mask;
        const k = nyckel(d.to, nyMask);
        if (forra.has(k)) continue;
        forra.set(k, nyckel(r, mask));
        if (!nyMask) {
          const vag = [];
          for (let p = k; p; p = forra.get(p)) vag.unshift(p.split(":")[0]);
          return { drag: djup, vag: vag.slice(1) };
        }
        nasta.push([d.to, nyMask]);
      }
    }
    ko = nasta;
  }
  return { drag: Infinity, vag: null };
}

/**
 * Kontrollen för en stjärnjakt – samma API som skapaSchackKontroll (det brädet och
 * inmatningen använder), så att samma bräde ritar den. Extra: `state.stjarnor`,
 * `state.jakt = { antal, kvar, klar, fast }`, `borjaOm()`.
 * @param {object} uppgift
 * @param {object} [opt]  { onMove(drag, state), onKlar(state), status(state) → text }
 */
export function skapaJaktKontroll(uppgift, opt = {}) {
  const fiendeVid = new Map((uppgift.fiender || []).map((f) => [f.ruta, f]));
  let pos, kvar, antal, vald, senast, klar, fast;
  let statusText = null;
  let interaktiv = true;
  const lyssnare = new Set();

  function nollstall() {
    pos = uppgift.fran;
    kvar = new Set(malFor(uppgift));
    antal = 0;
    vald = null;
    senast = null;
    klar = false;
    fast = false;
    statusText = null;
  }
  nollstall();

  const kvarFiender = () => [...fiendeVid.values()].filter((f) => kvar.has(f.ruta));
  const drag = () => (klar ? [] : jaktDrag(uppgift.pjas, pos, hinderFor(uppgift, kvarFiender())));
  const kanValja = (r) => interaktiv !== false && !klar && r === pos;

  function getState() {
    const pjaser = [{ ruta: pos, color: "w", type: uppgift.pjas }];
    for (const r of uppgift.egna || []) pjaser.push({ ruta: r, color: "w", type: "p" });
    for (const f of kvarFiender()) pjaser.push({ ruta: f.ruta, color: "b", type: f.typ });
    const stjarnor = uppgift.stjarnor.filter((s) => kvar.has(s));
    const jakt = { antal, kvar: kvar.size, klar, fast };
    const auto = klar ? "Alla stjärnor tagna!" : fast ? "Nu går det inte att nå alla – tryck på Börja om." : `Flytta ${BESTAMD[uppgift.pjas]}.`;
    const text = statusText ?? opt.status?.(jakt) ?? auto;
    return {
      fen: "", tur: "w", pjaser, vald, mal: vald ? drag().map((d) => ({ to: d.to, tar: d.tar })) : [],
      forvandling: null, pagaende: null, senast, schackRuta: null, orientering: "w", interaktiv, pilar: [],
      status: { text, ton: klar ? "vinst" : "normal", orsak: "" }, slut: null,
      drag: [], dragText: "", dragRader: [], tagna: { w: [], b: [] }, fordel: { w: 0, b: 0 },
      egenFarg: "w", motstandare: null, namn: {}, stjarnor, jakt,
    };
  }

  function emit(h) {
    const s = getState();
    for (const fn of lyssnare) {
      try { fn(s, h); } catch (e) { console.error("schack: fel i callback", e); }
    }
  }

  function flytta(to) {
    const d = drag().find((m) => m.to === to);
    if (!d) return { typ: "nekad" };
    const from = pos;
    pos = to;
    antal++;
    kvar.delete(to);
    senast = { from, to };
    vald = null;
    statusText = null;
    klar = kvar.size === 0;
    fast = !klar && minstaDrag(uppgift, { ruta: pos, kvar: [...kvar] }).drag === Infinity;
    const info = { from, to, flags: d.tar ? "c" : "n", piece: uppgift.pjas, color: "w", captured: d.tar ? fiendeVid.get(to).typ : null, stjarna: uppgift.stjarnor.includes(to) };
    emit({ typ: "drag", drag: info });
    try { opt.onMove?.(info, getState()); } catch (e) { console.error(e); }
    if (klar) try { opt.onKlar?.(getState()); } catch (e) { console.error(e); }
    return { typ: "drag", drag: info };
  }

  const valj = (r) => { vald = r; emit({ typ: "val" }); return { typ: "vald", ruta: r }; };
  const avmarkera = () => { const fanns = vald != null; vald = null; if (fanns) emit({ typ: "val" }); return { typ: "avmarkerad" }; };

  return {
    getState,
    kanValja,
    lagligaDrag: (r) => (r === pos ? drag().map((d) => ({ from: pos, to: d.to, captured: d.tar ? "x" : null })) : []),
    subscribe(fn) { lyssnare.add(fn); return () => lyssnare.delete(fn); },
    tryck(r) {
      if (klar) return { typ: "ingen" };
      if (vald) {
        if (r === vald) return avmarkera();
        if (drag().some((d) => d.to === r)) return flytta(r);
        return avmarkera();
      }
      return kanValja(r) ? valj(r) : { typ: "ingen" };
    },
    valj: (r) => (kanValja(r) ? valj(r) : { typ: "ingen" }),
    avmarkera,
    slapp(from, to) {
      if (!kanValja(from)) return { typ: "ingen" };
      if (from === to || !to) return valj(from);
      const svar = flytta(to);
      if (svar.typ === "nekad") valj(from);
      return svar;
    },
    valjForvandling: () => ({ typ: "ingen" }),
    avbrytForvandling() {},
    /** Ett drag från koden (tester, "visa lösningen"): { to } eller rutan. */
    move: (d) => (flytta(typeof d === "string" ? d : d?.to).drag || null),
    borjaOm() { nollstall(); emit({ typ: "position" }); },
    setInteractive(v) { interaktiv = v; if (!v) vald = null; emit({ typ: "val" }); },
    setStatus(t) { statusText = t == null ? null : String(t); emit({ typ: "status" }); },
    setSpelare() {},
    setOrientation() {},
    flip() {},
    showArrow() {},
    clearArrows() {},
    getFen: () => "",
    getHistory: () => [],
  };
}
