// ============================================================================
// Bråkresan – klientens anropslogik utan Firebase (src/brakresan/data-core.js) · #708
// ----------------------------------------------------------------------------
// Ren logik som data.js använder och som testas i Node (test/brakresan-data-core.test.js):
//
//   BrakresaFel(code, message, { retryable })  fel med svensk text till eleven
//   createSaveStatus()     "Sparar …"/"Sparat"-tillståndet: { get, set, subscribe }
//                          tillstånd: "vilar" | "sparar" | "sparat" | "offline" | "fel"
//   callWithRetry(invoke, data, opts)
//                          anropar en callable; nätfel och tillfälliga serverfel
//                          försöks igen med SAMMA data (samma omgångs-/uppgifts-id,
//                          servern är idempotent – §13 "Nätverk och återhämtning").
//                          Ger upp efter `delays.length` omförsök → BrakresaFel med
//                          retryable: true; UI:t behåller elevens inmatning och
//                          låter eleven trycka "Försök igen".
//   createDrafts(storage)  elevens osparade inmatning per omgång/uppgift (localStorage)
// ============================================================================

export class BrakresaFel extends Error {
  constructor(code, message, { retryable = false } = {}) {
    super(message);
    this.name = "BrakresaFel";
    this.code = code;
    this.retryable = retryable;
  }
}

/** Fel som kan vara nätet eller en tillfällig störning – säkra att försöka igen. */
export const RETRYABLE = Object.freeze(["unavailable", "deadline-exceeded", "internal", "unknown", "aborted", "resource-exhausted"]);
export const DEFAULT_DELAYS = Object.freeze([800, 2000, 4000]);
export const OFFLINE_MESSAGE = "Ingen kontakt med servern just nu. Ditt svar finns kvar – försök igen.";

export function createSaveStatus() {
  let state = "vilar";
  const subs = new Set();
  return {
    get: () => state,
    set(next) {
      if (next === state) return;
      state = next;
      for (const cb of subs) {
        try {
          cb(state);
        } catch {
          /* en trasig lyssnare stoppar inte de andra */
        }
      }
    },
    subscribe(cb) {
      subs.add(cb);
      cb(state);
      return () => subs.delete(cb);
    },
  };
}

const codeOf = (err) => String(err?.code || "").replace(/^functions\//, "") || "unknown";

/**
 * @param {(data) => Promise<any>} invoke  httpsCallable-funktionen (svarar { data })
 * @param {object} data
 * @param {{ status?, delays?: number[], sleep?: (ms) => Promise, online?: () => boolean }} opts
 */
export async function callWithRetry(invoke, data, opts = {}) {
  const { status = null, delays = DEFAULT_DELAYS } = opts;
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const online = opts.online || (() => globalThis.navigator?.onLine !== false);
  status?.set("sparar");
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await invoke(data);
      status?.set("sparat");
      return res?.data;
    } catch (err) {
      const code = codeOf(err);
      if (!RETRYABLE.includes(code)) {
        status?.set("fel");
        const msg = String(err?.message || "");
        throw new BrakresaFel(code, msg && msg.toLowerCase() !== code ? msg : "Det gick inte just nu.");
      }
      if (attempt >= delays.length) {
        status?.set(online() ? "fel" : "offline");
        throw new BrakresaFel(code, OFFLINE_MESSAGE, { retryable: true });
      }
      if (!online()) status?.set("offline");
      await sleep(delays[attempt]);
      status?.set("sparar");
    }
  }
}

/** Osparad inmatning per omgång och uppgift. storage = localStorage (eller en ersättare i test). */
export function createDrafts(storage, prefix = "pp:brakresan:utkast:") {
  const key = (roundId, index) => `${prefix}${roundId}:${index}`;
  const safe = (fn, fallback) => {
    try {
      return fn();
    } catch {
      return fallback; // privat läge / full lagring: utkastet är en bekvämlighet
    }
  };
  return {
    save: (roundId, index, answer) => safe(() => storage?.setItem(key(roundId, index), JSON.stringify(answer)), undefined),
    load: (roundId, index) => safe(() => {
      const v = storage?.getItem(key(roundId, index));
      return v == null ? null : JSON.parse(v);
    }, null),
    clear: (roundId, index) => safe(() => storage?.removeItem(key(roundId, index)), undefined),
  };
}
