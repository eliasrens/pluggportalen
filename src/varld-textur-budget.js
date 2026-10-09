// ============================================================================
// Pluggporten – GPU-minnesbudget för Pixi-rörelsens texturer (#396, F3 #417, G1 #425)
// ----------------------------------------------------------------------------
// REN logik (ingen DOM, ingen Pixi) → testas med `node --test`. Används av
// textur-pipelinen (varld-textur.js) och motorn (F4). Värdena är §6 i
// docs/pixi-arkitektur-396.md, kalibrerade i G1 (#425) för skolans svaga
// Chromebooks – se docs/pixi-gpu-budget-396.md för siffrorna och protokollet.
//
//   enhetsKlass(nav, maxTex, gpu) → "svag" | "normal"
//   budget(klass)            → { maxBytes, dprTak, steg, tegel, under1Upplosning, maxPar }
//   overgangBytes(matt, zoom, b) → uppskattade GPU-bytes för EN övergång (båda rollerna)
//   anpassaBudget(b, matt)   → maxPar begränsad av maxBytes för den faktiska scenstorleken
//   sattAnpassning(fn)       → krok som budget() kör (vakten i varld-motor-hud.js)
//   nivaer(zMin, zMax, steg) → pyramidens zoomnivåer (t.ex. 0.2 … 1 … 5)
//   texturBytes(w, h)        → GPU-bytes för en RGBA-textur INKL. mipmaps (×4/3)
//   forstoringVid/maxForstoring → hur mycket en pyramid förstoras (mål ≤ steg)
//   class TexturLRU          → LRU över cachade pyramider med budget-eviction
//
// Test-/mätflaggor (localStorage, try/catch): pp:pixi:klass = svag|normal
// tvingar enhetsklassen (Chromebook-budgeten går att prova på en stark dator).
// Laddas aldrig statiskt (bootgrafen från src/app.js är oförändrad).
// ============================================================================

const MB = 1024 * 1024;

/**
 * Budget per enhetsklass (§6, kalibrerad i G1). `steg` = största förstoring
 * (enhets-px) mellan två pyramidnivåer, `tegel` = största tegelsida i px.
 * svag: Chromebook 1366×768/dpr 1 (scen ≈ 1366×700) → T2 ≈ 34 MB, T3 ≈ 40 MB;
 * FHD-Chromebook i 125 % (scen ≈ 1536×800) → T2 ≈ 44 MB, T3 ≈ 52 MB. 112 MB
 * rymmer navets (huset) båda grannövergångar förvärmda på båda, med marginal
 * för en reserv-pyramid under omspegling. maxPar 2 begränsas av anpassaBudget().
 * normal: 1920×1000/dpr 1 → T3 ≈ 117 MB; 1440×800/dpr 1.5 → T3 ≈ 158 MB.
 */
const BUDGETAR = Object.freeze({
  svag: Object.freeze({ maxBytes: 112 * MB, dprTak: 1, steg: 1.5, tegel: 2048, under1Upplosning: 0.5, maxPar: 2 }),
  normal: Object.freeze({ maxBytes: 256 * MB, dprTak: 1.5, steg: 1.5, tegel: 2048, under1Upplosning: 1, maxPar: 3 }),
});

/** Mjukvaru-GL (SwiftShader/llvmpipe …): inget GPU-minne att tala om, CPU-rastrering. */
const MJUKVARU_GL = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i;

let kandGpu = "";
/** Workerns WebGL-renderer-sträng (UNMASKED_RENDERER) – används av enhetsKlass. */
export function sattGpu(gpu) {
  kandGpu = String(gpu || "");
}

/** pp:pixi:klass = svag|normal (test/mätning), annars null. */
export function tvingadKlass() {
  try {
    const v = globalThis.localStorage?.getItem("pp:pixi:klass");
    return v === "svag" || v === "normal" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Enhetsklass ur navigator-värden + WebGL:s MAX_TEXTURE_SIZE + GPU-sträng.
 * "svag" om (G1-kalibrerat, målgruppen är skolans Chromebooks):
 *   deviceMemory ≤ 4 GB (Chromium rapporterar alltid – alla Chromebooks), ELLER
 *   hardwareConcurrency ≤ 2, ELLER ≤ 4 kärnor när minnet är okänt, ELLER
 *   maxTex < 8192, ELLER mjukvaru-GL.
 * (§6 hade "kärnor ≤ 4" – det gjorde varje fyrkärnig 8 GB-laptop svag.)
 * Värden som saknas (Safari/Firefox har ingen deviceMemory; maxTex okänd före
 * workerns `redo`) räknas inte emot enheten. pp:pixi:klass vinner alltid.
 * @param {{deviceMemory?:number, hardwareConcurrency?:number}|null|undefined} nav
 * @param {number} [maxTex]
 * @param {string} [gpu]  standard: sattGpu()-värdet
 * @returns {"svag"|"normal"}
 */
export function enhetsKlass(nav, maxTex, gpu = kandGpu) {
  const tvingad = tvingadKlass();
  if (tvingad) return tvingad;
  const mem = Number(nav?.deviceMemory);
  const cores = Number(nav?.hardwareConcurrency);
  const tex = Number(maxTex);
  if (mem > 0 && mem <= 4) return "svag";
  if (cores > 0 && cores <= 2) return "svag";
  if (!(mem > 0) && cores > 0 && cores <= 4) return "svag";
  if (tex > 0 && tex < 8192) return "svag";
  if (gpu && MJUKVARU_GL.test(gpu)) return "svag";
  return "normal";
}

let anpassning = null;
/**
 * Krok som budget() kör på varje ny budget (null = ingen). Vakten sätter den
 * så att maxPar följer scenens verkliga storlek (anpassaBudget).
 * @param {((b:object) => object)|null} fn
 */
export function sattAnpassning(fn) {
  anpassning = typeof fn === "function" ? fn : null;
}

/**
 * Budgeten för en enhetsklass. Okänd klass → "svag" (säkra sidan).
 * Returnerar en ny kopia (anroparen får ändra den, t.ex. tegel ≤ maxTex).
 * @param {"svag"|"normal"} klass
 */
export function budget(klass) {
  const b = { ...(BUDGETAR[klass] || BUDGETAR.svag) };
  if (!anpassning) return b;
  try {
    return { ...b, ...anpassning({ ...b }) };
  } catch {
    return b;
  }
}

/**
 * Uppskattade GPU-bytes för EN övergång med zoom `zoom`: ytterrollen z ∈
 * [1, zoom] (varje nivå ≈ en scenstor textur) + innerrollen z ∈ [1/zoom, 1)
 * (varje nivå ≈ scenstor × under1Upplosning²) + innerrollens egen nivå 1.
 * Samma formler som planeraNiva i varld-textur.js när fångsten täcker vyn.
 * @param {{w:number, h:number, dpr:number}} matt  scenen i CSS-px + effektiv dpr
 * @param {number} zoom
 * @param {{steg:number, under1Upplosning:number}} b
 */
export function overgangBytes({ w, h, dpr }, zoom, b) {
  const W = Math.ceil(w * dpr), H = Math.ceil(h * dpr);
  const u = b.under1Upplosning;
  let s = 0;
  for (const z of nivaer(1, zoom, b.steg)) s += texturBytes(W, H);
  for (const z of nivaer(1 / zoom, 1, b.steg)) s += z < 1 ? texturBytes(Math.ceil(W * u), Math.ceil(H * u)) : texturBytes(W, H);
  return s;
}

/**
 * maxPar begränsad av maxBytes för den faktiska scenen: så många övergångar
 * (värsta zoomen, T3 = 6) som ryms, minst 1, högst klassens maxPar. Annars
 * förvärmer motorn fler än budgeten rymmer och LRU:n slänger det den nyss byggt.
 * @param {object} b  budget(klass)
 * @param {{w:number, h:number, dpr:number, zoom?:number}} matt  dpr = enhetens (taket tillämpas här)
 */
export function anpassaBudget(b, { w, h, dpr, zoom = 6 }) {
  if (!(w > 0) || !(h > 0)) return { ...b };
  const per = overgangBytes({ w, h, dpr: Math.min(dpr || 1, b.dprTak) }, zoom, b);
  const ryms = Math.floor(b.maxBytes / per);
  return { ...b, maxPar: Math.max(1, Math.min(b.maxPar, ryms)) };
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
    /** Senast använd (performance.now) per nyckel – för vaktens 30 s-städning. */
    this._tid = new Map();
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
    this._tid.set(nyckel, nu());
    this._summa += b;
    return this._trimma(nyckel);
  }

  /** Markera som senast använd. @returns {boolean} fanns nyckeln */
  rör(nyckel) {
    const p = this._poster.get(nyckel);
    if (!p) return false;
    this._poster.delete(nyckel);
    this._poster.set(nyckel, p);
    this._tid.set(nyckel, nu());
    return true;
  }

  /** ms sedan nyckeln senast lades till/rördes (Infinity om den saknas). */
  alder(nyckel, tid = nu()) {
    const t = this._tid.get(nyckel);
    return t == null ? Infinity : tid - t;
  }

  /** Olåsta nycklar som inte använts på `ms` ms (äldst först). */
  gamla(ms, tid = nu()) {
    return this.nycklar().filter((k) => !this._last.has(k) && this.alder(k, tid) > ms);
  }

  /** Är nyckeln låst (spelas just nu)? */
  last(nyckel) {
    return this._last.has(nyckel);
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
    this._tid.delete(nyckel);
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
      this._tid.delete(k);
      this._summa -= p.bytes;
      ut.push(k);
      kor(p.slapp, k);
    }
    return ut;
  }
}

const nu = () => (globalThis.performance?.now ? performance.now() : Date.now());

function kor(fn, nyckel) {
  if (!fn) return;
  try {
    fn(nyckel);
  } catch (err) {
    console.warn("[pp:pixi] TexturLRU slapp:", err);
  }
}
