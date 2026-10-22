// ============================================================================
// Meteorstormen – projektorns RENA logik (#822). Ingen DOM, ingen Firebase,
// ingen Math.random()/Date.now(): allt som ritas räknas ur sessionen,
// händelseloggen (motorns logg), stormplanen, fröet och renderingstiden t.
// Därför ger två projektorer på samma session EXAKT samma bild för samma t
// (spec §4.4, Elias 2026-10-21). Testas i test/live-meteorstorm-projektor.test.js.
//
// API
//   W, H                         scenens logiska storlek (16:9)
//   motorIndata(s)               → motorns cfg ur sessionen (utan handlingar);
//                                  msStationer saknas → aktiva 1 (ingen har handlat)
//   slutVid(s)                   → när stormen tog slut (lärarens avslut eller
//                                  ordinarie slut) | null
//   handlingarUr(events)         → motorns handlingar (typ "fel" hoppas över)
//   namnUr(events)               → Map uid → namn (händelsernas namn)
//   stegaKlocka(prev, mal, dtMs) → nästa renderingstid: följer mal mjukt och
//                                  går ALDRIG bakåt (ingen "ångrad" bild)
//   platser(n, slut?)            → [{ x, y, skala }] – stationernas mitt
//   riktning(i, n, bana)         → enhetsvektor ut från station i (spegelvänd)
//   meteorPunkt(geo, t, pl)      → { x, y, vx, vy } – meteorns läge vid t
//   meteorGeo(id, plan, kast, cfg, index) → geo | null (för effekter ur loggen)
//   skapaLoggminne()             → { las(logg) } – inkrementellt index över loggen
//                                  (kast per meteor, träffar per station, flödet)
//   flodeVid(poster, t)          → de (högst 4) flödesrader som syns vid t
//   banderollVid(handelse, t)    → { typ, text, kvar } | null
//   humor(minne, classId, t, flyter) → "lugn"|"jubel"|"ducka"|"svett"|"drakt"
//   gungVid(minne, classId, t)   → { x, y } (px) – kort gung vid skrovträff
//   klocktext(ms)                → "07:42"
// ============================================================================

import { RENDER_FORDROJNING_MS, KAST_FLYGTID_MS, HANDLINGAR, STORLEKAR } from "./delat/ms-balans.js";
import { hashFro } from "./delat/ms-prng.js";
import { toMs } from "../../live-time.js";

export const W = 1600;
export const H = 900;
export const FORDROJNING_MS = RENDER_FORDROJNING_MS;

const ms = toMs;

/** Motorns indata ur sessionen (docs/METEORSTORMEN.md §8.1). */
export function motorIndata(s) {
  const start = ms(s?.startedAt);
  return {
    seed: s?.msSeed ?? 0,
    startMs: start == null ? 0 : start + (Number(s.countdownSeconds) || 0) * 1000,
    varaktighetMs: (Number(s?.durationSeconds) || 0) * 1000,
    stationer: Array.isArray(s?.msStationer) && s.msStationer.length
      ? s.msStationer.map((x) => ({ classId: x.classId, aktiva: x.aktiva }))
      : (s?.participatingClassIds || []).map((classId) => ({ classId, aktiva: 1 })),
    installningar: s?.msInstallningar || {},
  };
}

/** Lärarens avslut före tiden gäller som slut (som serverns slutFor). */
export function slutVid(s) {
  const cfg = motorIndata(s);
  if (!cfg.startMs) return null;
  const end = cfg.startMs + cfg.varaktighetMs;
  const f = ms(s?.finishedAt);
  return f != null && f < end ? Math.max(cfg.startMs, f) : end;
}

export function handlingarUr(events) {
  const ut = [];
  for (const e of events || []) {
    if (!e || !HANDLINGAR.includes(e.typ) || !Number.isFinite(e.t)) continue;
    ut.push({ id: e.id, t: e.t, classId: e.classId, uid: e.uid, typ: e.typ, ...(e.mal ? { mal: e.mal } : {}) });
  }
  return ut;
}

export function namnUr(events) {
  const m = new Map();
  for (const e of events || []) if (e?.uid && e.namn) m.set(e.uid, String(e.namn));
  return m;
}

/**
 * Renderingstiden: följer mal (= nu − fördröjning) med verklig tid, rättar
 * mjukt (högst 8 % fart upp/ned) och hoppar bara FRAMÅT vid stora avvikelser
 * (flik i bakgrunden, ny klocksynk). Aldrig bakåt.
 */
export function stegaKlocka(prev, mal, dtMs) {
  if (prev == null || !Number.isFinite(prev)) return mal;
  const dt = Math.max(0, Math.min(250, dtMs || 0));
  const fri = prev + dt;
  const fel = mal - fri;
  if (fel > 2000) return mal;
  const rattning = Math.max(-0.08 * dt, Math.min(0.08 * dt, fel * 0.1));
  return Math.max(prev, fri + rattning);
}

/**
 * Stationernas platser (logiska px) och skala. 3–4 stationer ryms också.
 * slut = true: mindre och högre upp – slutrutan tar nedre delen av bilden.
 */
export function platser(n, slut = false) {
  const y = slut ? 285 : 545;
  const k = slut ? 0.62 : 1;
  if (n <= 1) return [{ x: 800, y, skala: 1.15 * k }];
  if (n === 2) return [{ x: slut ? 520 : 430, y, skala: k }, { x: slut ? 1080 : 1170, y, skala: k }];
  return Array.from({ length: n }, (_, i) => ({ x: (W * (i + 0.5)) / n, y: y + 15, skala: (n === 3 ? 0.8 : 0.66) * k }));
}

/** Meteorernas riktning ut från station i: en solfjäder, spegelvänd för högra halvan. */
export function riktning(i, n, bana) {
  const b = Math.min(1, Math.max(0, Number(bana) || 0));
  let vinkel;
  if (n <= 1) vinkel = -Math.PI / 2 + (b - 0.5) * Math.PI * 0.9;
  else {
    const vanster = (i + 0.5) / n < 0.5;
    const v = -Math.PI * 0.7 + (b - 0.5) * Math.PI * 0.75; // uppåt-vänster ± 67°
    vinkel = vanster ? v : -Math.PI - v;
  }
  return { x: Math.cos(vinkel), y: Math.sin(vinkel) };
}

/** Avstånd från p längs d tills punkten är utanför bilden (+ marginal). */
function tillKanten(p, d, marg = 70) {
  let best = Infinity;
  if (d.x > 1e-6) best = Math.min(best, (W + marg - p.x) / d.x);
  if (d.x < -1e-6) best = Math.min(best, (-marg - p.x) / d.x);
  if (d.y > 1e-6) best = Math.min(best, (H + marg - p.y) / d.y);
  if (d.y < -1e-6) best = Math.min(best, (-marg - p.y) / d.y);
  return Number.isFinite(best) ? best : 900;
}

/** Bubblans/skrovets radie (logiska px, före stationens skala). */
export const RADIE = { skrov: 74, bubbla: 158 };

/**
 * Meteorens läge. geo = { mal, kastadAv (index | -1), bana, spawnMs, ankomstMs }
 * (index i stationslistan). pos 0 = kanten (eller kastarens station), 1 = framme.
 * pl = platser(n); slutR = radien där den slår ner.
 */
export function meteorPunkt(geo, t, pl, slutR = RADIE.bubbla) {
  const n = pl.length;
  const mal = pl[geo.mal] || pl[0];
  const pos = Math.min(1, Math.max(0, (t - geo.spawnMs) / Math.max(1, geo.ankomstMs - geo.spawnMs)));
  if (geo.kastadAv >= 0 && pl[geo.kastadAv]) {
    const fran = pl[geo.kastadAv];
    const sida = Math.sign(mal.x - fran.x) || 1;
    const p0 = { x: fran.x + sida * 60 * fran.skala, y: fran.y - 110 * fran.skala };
    const p2 = { x: mal.x - sida * slutR * mal.skala * 0.7, y: mal.y - slutR * mal.skala * 0.7 };
    const c = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - 260 };
    const u = 1 - pos;
    return {
      x: u * u * p0.x + 2 * u * pos * c.x + pos * pos * p2.x,
      y: u * u * p0.y + 2 * u * pos * c.y + pos * pos * p2.y,
      vx: 2 * u * (c.x - p0.x) + 2 * pos * (p2.x - c.x),
      vy: 2 * u * (c.y - p0.y) + 2 * pos * (p2.y - c.y),
      pos,
    };
  }
  const d = riktning(geo.mal, n, geo.bana);
  const r0 = tillKanten(mal, d);
  const r1 = slutR * mal.skala;
  const r = r0 + (r1 - r0) * pos;
  return { x: mal.x + d.x * r, y: mal.y + d.y * r, vx: -d.x, vy: -d.y, pos };
}

/**
 * En meteors bana ur stormplanen och loggens kast – för effekter efter att
 * meteoren försvunnit ur tillståndet (sprängd, nedslag). id = "<n>.<station>".
 */
export function meteorGeo(id, plan, kast, cfg, index) {
  const [nStr, iStr] = String(id || "").split(".");
  const pm = plan?.meteorer?.[Number(nStr)];
  if (!pm) return null;
  const k = kast?.get(id);
  if (k) {
    return { mal: index.get(k.mot) ?? 0, kastadAv: index.get(k.classId) ?? -1, bana: pm.bana, spawnMs: k.t, ankomstMs: k.t + KAST_FLYGTID_MS, storlek: k.storlek };
  }
  return { mal: Number(iStr) || 0, kastadAv: -1, bana: pm.bana, spawnMs: cfg.startMs + pm.spawnMs, ankomstMs: cfg.startMs + pm.ankomstMs, storlek: pm.storlek };
}

// ---- Flödet (§4.2: bara det som är bra, högst 4 rader) --------------------------

export const FLODE_MAX = 4;
export const FLODE_TTL_MS = 14_000;
const FLODE_TAKT_MS = 650;
const FLODE_GALLRA_MS = 3500; // en rad som väntat så här länge hoppas över
const SKOLD_RAD_MS = 12_000; // "4D:s sköld höll!" högst så här ofta per klass
const STORLEK_TEXT = { liten: "en liten", mellan: "en mellanstor", stor: "en stor" };

/** Flödesraden för en loggpost (eller null – aldrig fel svar, aldrig skada). */
export function flodeText(p, { namn, klass, visaNamn }) {
  const vem = (uid, classId) => (visaNamn && uid && namn.get(uid)) || klass(classId);
  if (p.typ === "nedskjuten") {
    if (p.jatte) return { ikon: "☄️", text: `${klass(p.classId)} sköt ner jättemeteoren!`, stor: true };
    if (p.fran) return { ikon: "🔫", text: `${vem(p.uid, p.classId)} sköt ner meteoren från ${klass(p.fran)}!` };
    return { ikon: "🔫", text: `${vem(p.uid, p.classId)} sköt ner ${STORLEK_TEXT[p.storlek] || "en"} meteor!` };
  }
  if (p.typ === "kast") return { ikon: "🌀", text: `${klass(p.classId)} slungade en meteor mot ${klass(p.mot)}!` };
  if (p.typ === "skold") {
    const gen = klassGenitiv(klass(p.classId));
    return { ikon: "🛡️", text: p.jatte ? `${gen} sköld höll mot jättemeteoren!` : `${gen} sköld höll!`, stor: !!p.jatte };
  }
  if (p.typ === "hjalp") return { ikon: "🚀", text: `${klass(p.classId)} får extra kraft!` };
  return null;
}

/** Genitiv: "4D:s", "Bläckfiskarnas", "Rymdlöss". */
export function klassGenitiv(namn) {
  const n = String(namn || "");
  if (/[A-ZÅÄÖ0-9]$/.test(n)) return `${n}:s`;
  return /[sxz]$/i.test(n) ? n : `${n}s`;
}

/**
 * Inkrementellt index över motorns logg. Loggens poster är frysta objekt; spolar
 * motorn tillbaka (sen händelse) byggs indexet om från början – samma logg ger
 * alltid samma index, oavsett när projektorn startade.
 */
export function skapaLoggminne({ namn = new Map(), klass = (id) => id, visaNamn = true } = {}) {
  let sedda = [];
  const tom = () => ({ kast: new Map(), traffar: new Map(), poster: [], senast: new Map(), skoldRad: new Map(), visad: -Infinity });
  let m = tom();
  const opts = { namn, klass: (id) => klass(id), visaNamn };

  function lagg(p) {
    if (p.typ === "kast") m.kast.set(p.meteor, p);
    if (p.typ === "traff") {
      const l = m.traffar.get(p.classId) || [];
      l.push(p);
      if (l.length > 16) l.shift();
      m.traffar.set(p.classId, l);
    }
    if (p.classId) {
      const s = m.senast.get(p.classId) || {};
      s[p.typ === "skold" && p.jatte ? "skoldJatte" : p.typ === "nedskjuten" && p.jatte ? "jatteNer" : p.typ] = p.t;
      m.senast.set(p.classId, s);
    }
    if (p.typ === "skold" && !p.jatte) {
      if (p.t - (m.skoldRad.get(p.classId) ?? -Infinity) < SKOLD_RAD_MS) return;
      m.skoldRad.set(p.classId, p.t);
    }
    const f = flodeText(p, opts);
    if (!f) return;
    const visas = Math.max(p.t, m.visad + FLODE_TAKT_MS);
    if (visas - p.t > FLODE_GALLRA_MS && !f.stor) return;
    m.visad = visas;
    m.poster.push({ key: `${p.t}|${p.typ}|${p.meteor || p.classId}|${m.poster.length}`, visas, ...f });
  }

  return {
    las(logg) {
      const l = logg || [];
      let i = sedda.length;
      if (l.length < i || (i && l[i - 1] !== sedda[i - 1])) {
        m = tom();
        sedda = [];
        i = 0;
      }
      for (; i < l.length; i++) {
        sedda.push(l[i]);
        lagg(l[i]);
      }
      return m;
    },
    satNamn(nyNamn) { opts.namn = nyNamn; },
    get minne() { return m; },
  };
}

/** Flödesraderna som syns vid t: { key, ikon, text, alder } – nyast först. */
export function flodeVid(poster, t) {
  const ut = [];
  for (let i = poster.length - 1; i >= 0 && ut.length < FLODE_MAX; i--) {
    const p = poster[i];
    if (p.visas > t) continue;
    if (t - p.visas >= FLODE_TTL_MS) break;
    ut.push({ key: p.key, ikon: p.ikon, text: p.text, stor: !!p.stor, alder: t - p.visas });
  }
  return ut;
}

const BANDEROLL = {
  solstorm: "☀️ SOLSTORM! Dubbel energi i 20 sekunder!",
  jattemeteor: "☄️ JÄTTEMETEOR – skjut ner den!",
  kometsvans: "✨ KOMETSVANS! +1 energi för varje rätt svar!",
  lugnet: "🌌 LUGNET – inga meteorer på en stund. Andas!",
};

export function banderollVid(h, t) {
  if (!h || !BANDEROLL[h.typ]) return null;
  return { typ: h.typ, text: BANDEROLL[h.typ], kvar: Math.max(0, Math.ceil((h.slutMs - t) / 1000)) };
}

/** Besättningens humör (§4.1.1) – ur stationens senaste loggposter. */
export function humor(minne, classId, t, flyter) {
  if (flyter) return "drakt";
  const s = minne.senast.get(classId) || {};
  const sedan = (k) => (s[k] == null ? Infinity : t - s[k]);
  if (sedan("traff") < 1100) return "ducka";
  if (sedan("skoldJatte") < 3000 || sedan("jatteNer") < 3000) return "svett";
  if (sedan("nedskjuten") < 1300) return "jubel";
  return "lugn";
}

/** Kort, liten gungning efter en skrovträff (0 med reducerad rörelse – sköts av den som ritar). */
export function gungVid(minne, classId, t) {
  const l = minne.traffar.get(classId);
  let x = 0;
  let y = 0;
  for (let i = l ? l.length - 1 : -1; i >= 0; i--) {
    const age = t - l[i].t;
    if (age < 0) continue;
    if (age > 650) break;
    const amp = Math.min(7, 2.5 + (l[i].skrov || 0) * 0.35) * (1 - age / 650);
    x += amp * Math.sin(age / 38);
    y += amp * 0.5 * Math.cos(age / 45);
  }
  return { x, y };
}

/** Deterministisk "slump" i [0,1) ur fröet och en nyckel – för kosmetik. */
export const brus = (seed, nyckel) => hashFro(`${seed}|${nyckel}`) / 4294967296;

export function klocktext(msLeft) {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export const METEOR_R = { liten: 13, mellan: 19, stor: 27, jatte: 62 };
export const SKADA = Object.fromEntries(Object.entries(STORLEKAR).map(([k, v]) => [k, v.skada]));
