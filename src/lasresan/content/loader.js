// ============================================================================
// Läsresan – innehållsladdare (src/lasresan/content/loader.js)
// ----------------------------------------------------------------------------
// Texterna är DATA (spec §12/§23), inte kod: de hämtas med fetch enligt
// Innehållskontraktet (epic #398/#404):
//
//   content/bank/manifest.json = { "version": 1, "levels": { "1": ["level-1.json"], … } }
//   content/bank/level-N*.json = ReadingText[]
//
// * Lat laddning PER NIVÅ (loadLevel) – flera filer per nivå tillåts, så 500+
//   texter kräver ingen kodändring. loadBank laddar alla nivåer.
// * Varje fil valideras (content/validate.js). Texter med FEL hoppas över med
//   console.warn – en trasig text får aldrig krascha läsvyn.
// * FALLBACK: saknas banken (manifest 404/nätfel/ogiltigt) eller ger den inga
//   giltiga texter alls → dev-seed (spec:ens 4 referenstexter). `source()`
//   säger vilket som används ("bank" | "dev-seed").
//
// Banken (content/bank/) ägs av innehållsepicet #404 – motorn skapar inga
// filer där. createLoader tar en egen fetch/baseUrl så loadern kan testas med
// `node --test` utan nätverk.
// ============================================================================

import { validateBank } from "./validate.js";
import { DEV_SEED } from "./dev-seed.js";

const ID_LEVEL = /^lr-n(\d+)-/;

/**
 * @param {{fetch?:Function, baseUrl?:(string|URL), seed?:object[], warn?:Function}} [opts]
 */
export function createLoader(opts = {}) {
  const fetchFn = opts.fetch || ((...a) => globalThis.fetch(...a));
  const baseUrl = String(opts.baseUrl || new URL("./bank/", import.meta.url));
  const seed = opts.seed || DEV_SEED;
  const warn = opts.warn || ((...a) => console.warn("[Läsresan]", ...a));

  let manifestPromise = null; // → manifest | null (null = använd dev-seed)
  let forcedSeed = false; // banken fanns men gav inga giltiga texter
  const levelCache = new Map(); // level → Promise<ReadingText[]>

  async function fetchJson(file) {
    const res = await fetchFn(new URL(file, baseUrl).toString(), { cache: "no-cache" });
    if (!res || !res.ok) throw new Error(`${file}: HTTP ${res ? res.status : "?"}`);
    return res.json();
  }

  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetchJson("manifest.json")
        .then((m) => {
          if (!m || typeof m.levels !== "object" || !m.levels) throw new Error("manifest saknar levels");
          return m;
        })
        .catch((err) => {
          warn("innehållsbanken saknas – använder dev-seed:", err && err.message);
          return null;
        });
    }
    return manifestPromise;
  }

  function seedLevel(level) {
    return validateBank(seed).validTexts.filter((t) => t.level === level);
  }

  async function fetchLevel(manifest, level) {
    const files = manifest.levels[String(level)] || [];
    const texts = [];
    for (const file of files) {
      try {
        const data = await fetchJson(file);
        if (!Array.isArray(data)) throw new Error("inte en lista");
        texts.push(...data);
      } catch (err) {
        warn(`kunde inte läsa ${file}:`, err && err.message);
      }
    }
    const res = validateBank(texts);
    for (const e of res.errors) warn("hoppar över text:", e);
    const valid = res.validTexts.filter((t) => {
      if (t.level !== level) warn(`${t.id}: nivå ${t.level} ligger i fil för nivå ${level} – hoppas över`);
      return t.level === level;
    });
    // En listad nivå som inte gav någon giltig text (fil saknas/404/trasig) →
    // dev-seedens texter för nivån (om några), så nivån inte står tom.
    if (valid.length === 0 && files.length > 0) {
      const fallback = seedLevel(level);
      if (fallback.length > 0) warn(`nivå ${level} gav inga texter ur banken – använder dev-seed för nivån`);
      return fallback;
    }
    return valid;
  }

  /** Alla giltiga texter på en nivå (cachat). */
  function loadLevel(level) {
    const n = Number(level);
    if (!levelCache.has(n)) {
      levelCache.set(
        n,
        loadManifest().then((m) => (m && !forcedSeed ? fetchLevel(m, n) : seedLevel(n)))
      );
    }
    return levelCache.get(n);
  }

  /** Hela banken (alla nivåer i manifestet, eller hela dev-seed). */
  async function loadBank() {
    const m = await loadManifest();
    if (!m || forcedSeed) return validateBank(seed).validTexts;
    const levels = Object.keys(m.levels).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
    const all = (await Promise.all(levels.map(loadLevel))).flat();
    const seedIds = new Set(seed.map((t) => t && t.id));
    if (all.every((t) => seedIds.has(t.id))) {
      // Ingen enda text kom ur banken (bara per-nivå-fallback eller inget alls).
      warn("innehållsbanken gav inga giltiga texter – använder dev-seed");
      forcedSeed = true;
      levelCache.clear();
      return validateBank(seed).validTexts;
    }
    return all;
  }

  /** En text via id (för att återuppta currentTextId). Null om den inte finns. */
  async function findText(id) {
    if (typeof id !== "string") return null;
    const hit = ID_LEVEL.exec(id);
    if (hit) {
      const t = (await loadLevel(Number(hit[1]))).find((x) => x.id === id);
      if (t) return t;
    }
    return (await loadBank()).find((x) => x.id === id) || null;
  }

  /** "bank" eller "dev-seed" (efter att något laddats). */
  async function source() {
    const m = await loadManifest();
    return m && !forcedSeed ? "bank" : "dev-seed";
  }

  return { loadManifest, loadLevel, loadBank, findText, source };
}

// Standardinstans för appen (webbläsaren): banken bredvid den här filen.
let _default = null;
function def() {
  return (_default = _default || createLoader());
}
export const loadLevel = (level) => def().loadLevel(level);
export const loadBank = () => def().loadBank();
export const findText = (id) => def().findText(id);
export const contentSource = () => def().source();
