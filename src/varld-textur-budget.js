// ============================================================================
// Pluggporten – GPU-minnesbudget för Pixi-rörelsens texturer (#396, F3 #417)
// ----------------------------------------------------------------------------
// REN logik (ingen DOM, ingen Pixi) → testas med `node --test`. Används av
// textur-pipelinen (varld-textur.js) och motorn (F4). Utgångsvärdena är §6 i
// docs/pixi-arkitektur-396.md – G1 kalibrerar dem på riktig Chromebook.
//
//   enhetsKlass(nav, maxTex) → "svag" | "normal"
//   budget(klass)            → { maxBytes, dprTak, steg, tegel, under1Upplosning, maxPar }
//   nivaer(zMin, zMax, steg) → pyramidens zoomnivåer (t.ex. 0.2 … 1 … 5)
//   texturBytes(w, h)        → GPU-bytes för en RGBA-textur INKL. mipmaps (×4/3)
//   forstoringVid/maxForstoring → hur mycket en pyramid förstoras (mål ≤ steg)
//   class TexturLRU          → LRU över cachade pyramider med budget-eviction
//
// Laddas aldrig statiskt (bootgrafen från src/app.js är oförändrad).
// ============================================================================

const MB = 1024 * 1024;

/**
 * Startvärden per enhetsklass (§6). `steg` = största förstoring (enhets-px)
 * mellan två pyramidnivåer, `tegel` = största tegelsida i px.
 */
const BUDGETAR = Object.freeze({
  svag: Object.freeze({ maxBytes: 72 * MB, dprTak: 1, steg: 1.5, tegel: 2048, under1Upplosning: 0.5, maxPar: 1 }),
  normal: Object.freeze({ maxBytes: 256 * MB, dprTak: 1.5, steg: 1.5, tegel: 2048, under1Upplosning: 1, maxPar: 3 }),
});

/**
 * Enhetsklass ur navigator-värden + WebGL:s MAX_TEXTURE_SIZE.
 * "svag" om deviceMemory ≤ 4 ELLER hardwareConcurrency ≤ 4 ELLER maxTex < 8192.
 * Värden som saknas (Safari/Firefox har ingen deviceMemory; maxTex okänd före
 * workerns `redo`) räknas inte emot enheten.
 * @param {{deviceMemory?:number, hardwareConcurrency?:number}|null|undefined} nav
 * @param {number} [maxTex]
 * @returns {"svag"|"normal"}
 */
export function enhetsKlass(nav, maxTex) {
  const mem = Number(nav?.deviceMemory);
  const cores = Number(nav?.hardwareConcurrency);
  const tex = Number(maxTex);
  if (mem > 0 && mem <= 4) return "svag";
  if (cores > 0 && cores <= 4) return "svag";
  if (tex > 0 && tex < 8192) return "svag";
  return "normal";
}

/**
 * Budgeten för en enhetsklass. Okänd klass → "svag" (säkra sidan).
 * Returnerar en ny kopia (anroparen får ändra den, t.ex. tegel ≤ maxTex).
 * @param {"svag"|"normal"} klass
 */
export function budget(klass) {
  return { ...(BUDGETAR[klass] || BUDGETAR.svag) };
}

/** GPU-bytes för en w×h RGBA8-textur med full mip-kedja (≈ ×4/3). */
export function texturBytes(w, h) {
  return Math.ceil((Math.max(0, w) * Math.max(0, h) * 4 * 4) / 3);
}

/** n jämna geometriska steg från a till b (a, b exakta, n = färsta med kvot ≤ steg). */
function geometrisk(a, b, steg) {
  if (!(b > a)) return [a];
  const n = Math.max(1, Math.ceil(Math.log(b / a) / Math.log(steg) - 1e-9));
  const r = Math.pow(b / a, 1 / n);
  const ut = [a];
  for (let i = 1; i < n; i++) ut.push(+(a * Math.pow(r, i)).toFixed(4));
  ut.push(b);
  return ut;
}

/**
 * Pyramidens zoomnivåer mellan zMin och zMax. Om intervallet innehåller 1 är 1
 * alltid en nivå (den delas av ytter- och innerrollen, och är vilans bild).
 * Stegen är jämnt geometriska på varje sida om 1 med kvot ≤ `steg`, och färsta
 * möjliga antal nivåer: ingen nivå visas någonsin förstorad mer än `steg`.
 *   nivaer(0.2, 5, 1.5) → [0.2, 0.2991, 0.4472, 0.6687, 1, 1.4953, 2.2361, 3.3437, 5]
 * @param {number} zMin
 * @param {number} zMax
 * @param {number} [steg=1.5]
 * @returns {number[]} stigande
 */
export function nivaer(zMin, zMax, steg = 1.5) {
  if (!(zMin > 0) || !(zMax > 0)) throw new RangeError("nivaer: zMin/zMax måste vara > 0");
  if (!(steg > 1)) throw new RangeError("nivaer: steg måste vara > 1");
  const lo = Math.min(zMin, zMax);
  const hi = Math.max(zMin, zMax);
  if (lo < 1 && hi > 1) return [...geometrisk(lo, 1, steg), ...geometrisk(1, hi, steg).slice(1)];
  return geometrisk(lo, hi, steg);
}

/**
 * Förstoring (rastrets px → skärmens enhets-px) i stagets KANT när lagret visas
 * i scale(s): kanten täcks bara av nivåer med z ≤ s, och den skarpaste av dem
 * ligger överst. ≤ 1 = nedskalning (mipmaps). dpr = skärmens enhets-px per CSS-px.
 * @param {{z:number, skala:number}[]} nivaer  skala = rastrets px per lager-px
 * @param {number} s
 * @param {number} [dpr=1]
 */
export function forstoringVid(nivaer, s, dpr = 1) {
  let bast = 0;
  for (const n of nivaer) if (n.z <= s + 1e-9 && n.skala > bast) bast = n.skala;
  if (!bast) bast = Math.max(0, ...nivaer.map((n) => n.skala)); // s < zMin: grovaste nivån
  return bast ? (s * dpr) / bast : Infinity;
}

/**
 * Största förstoringen över hela pyramidens zoomintervall [z0, zN]: värst
 * precis innan nästa nivå tar över (s → z_{i+1}⁻) och vid z_N.
 * @param {{z:number, skala:number}[]} nivaer
 * @param {number} [dpr=1]
 */
export function maxForstoring(nivaer, dpr = 1) {
  const n = [...nivaer].sort((a, b) => a.z - b.z);
  let max = 0, bast = 0;
  for (let i = 0; i < n.length; i++) {
    bast = Math.max(bast, n[i].skala);
    const s = i + 1 < n.length ? n[i + 1].z : n[i].z;
    max = Math.max(max, (s * dpr) / bast);
  }
  return max;
}

/**
 * LRU över cachade texturer/pyramider ("senast spelad/förvärmd övergång").
 * När summan överstiger maxBytes släpps de MINST nyligen använda posterna
 * (deras `slapp()` anropas) tills summan ryms. Låsta poster (den som spelas)
 * och posten som just lades till släpps aldrig – då får summan tillfälligt
 * ligga över budget (syns i `over()`).
 */
export class TexturLRU {
  /** @param {number} maxBytes */
  constructor(maxBytes) {
    this.maxBytes = maxBytes;
    /** Map-ordningen ÄR LRU-ordningen: först = äldst. @type {Map<string,{bytes:number, slapp:Function|null}>} */
    this._poster = new Map();
    /** @type {Set<string>} */
    this._last = new Set();
    this._summa = 0;
  }

  /**
   * Lägg till (eller uppdatera) en post och gör den senast använd. Finns
   * nyckeln redan uppdateras bytes/slapp UTAN att den gamla slapp() anropas
   * (en pyramid som strömmar in fler nivåer växer under samma nyckel).
   * @param {string} nyckel
   * @param {number} bytes
   * @param {() => void} [slapp] anropas när posten evictas eller släpps
   * @returns {string[]} nycklarna som evictades
   */
  lagg(nyckel, bytes, slapp) {
    const gammal = this._poster.get(nyckel);
    if (gammal) {
      this._summa -= gammal.bytes;
      this._poster.delete(nyckel);
    }
    const b = Math.max(0, Number(bytes) || 0);
    this._poster.set(nyckel, { bytes: b, slapp: slapp || gammal?.slapp || null });
    this._summa += b;
    return this._trimma(nyckel);
  }

  /** Markera som senast använd. @returns {boolean} fanns nyckeln */
  rör(nyckel) {
    const p = this._poster.get(nyckel);
    if (!p) return false;
    this._poster.delete(nyckel);
    this._poster.set(nyckel, p);
    return true;
  }

  /** Summan bytes i cachen. */
  summa() {
    return this._summa;
  }

  har(nyckel) {
    return this._poster.has(nyckel);
  }

  /** Antal poster. */
  get storlek() {
    return this._poster.size;
  }

  /** Nycklarna i LRU-ordning (äldst först). */
  nycklar() {
    return [...this._poster.keys()];
  }

  /** Lås (spelas just nu) – evictas aldrig förrän lasUpp. */
  las(nyckel) {
    this._last.add(nyckel);
  }

  lasUpp(nyckel) {
    this._last.delete(nyckel);
    this._trimma(null);
  }

  /** Ligger cachen över budget (bara möjligt med låsta/nya poster)? */
  over() {
    return this._summa > this.maxBytes;
  }

  /** Ändra budgeten (t.ex. efter enhetsklass) – evictar direkt vid behov. */
  stallMax(maxBytes) {
    this.maxBytes = maxBytes;
    return this._trimma(null);
  }

  /** Släpp en post nu (anropar dess slapp). @returns {boolean} */
  slapp(nyckel) {
    const p = this._poster.get(nyckel);
    if (!p) return false;
    this._poster.delete(nyckel);
    this._last.delete(nyckel);
    this._summa -= p.bytes;
    kor(p.slapp, nyckel);
    return true;
  }

  /** Släpp allt (resize/DPR-byte → alla pyramider ogiltiga). */
  rensa() {
    for (const k of [...this._poster.keys()]) this.slapp(k);
  }

  _trimma(skona) {
    const ut = [];
    if (this._summa <= this.maxBytes) return ut;
    for (const [k, p] of [...this._poster]) {
      if (this._summa <= this.maxBytes) break;
      if (k === skona || this._last.has(k)) continue;
      this._poster.delete(k);
      this._summa -= p.bytes;
      ut.push(k);
      kor(p.slapp, k);
    }
    return ut;
  }
}

function kor(fn, nyckel) {
  if (!fn) return;
  try {
    fn(nyckel);
  } catch (err) {
    console.warn("[pp:pixi] TexturLRU slapp:", err);
  }
}
