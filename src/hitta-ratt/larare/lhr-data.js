// ============================================================================
// Hitta rätt! – lärarvyns läsningar och anrop (src/hitta-ratt/larare/lhr-data.js) · #634
// ----------------------------------------------------------------------------
// Laddas bara DYNAMISKT (lärarfliken), aldrig i bootgrafen (#271).
// Läraren skriver aldrig i packen själv – allt går via servern (§11.0):
//
//   sparaPack(indata, { kopieraFran }) → hittaRattSparaPack → { id, version, nollstalld }
//                           kopieraFran = källpackets id vid första sparningen av
//                           en kopia – servern kopierar dess bilder (#637)
//   raderaPack(packId)    → hittaRattRaderaPack → { fanns }
//   sattTopplista(packId, pa) → hittaRattSattTopplista → { leaderboard, tillagda } (#635)
//   hamtaKatalog()        → hittaRattMeta/egnaPack, EN läsning (färsk vid varje besök)
//   hamtaPack(id)         → hittaRattPacks/{id} (1 läsning) eller null
//   hamtaPackIndex()      → content/packs/index.json (officiella, statisk)
//   hamtaOfficielltPack(id) → content/packs/<id>.json
//   hamtaGeo(geo)         → content/geo/<geo>.json (kartvalet, #636)
//   sparaBild(packId, { blob, mime, bredd, hojd }) → bild-id (#637, §11.8):
//                           hittaRattBilder/{packId}--{8 tecken}, Bytes ≤ 150 kB
//                           (regeln), ägare = läraren. Ingen uppdatering – nytt id per bild.
//   laddaOmraden(geo)     → { lista: [{ id, key, namn }], nycklar, geoOmraden }
//                           ur <geo>.namn.json + <geo>.nycklar.json (bara lärarvyn)
// Fel från servern kastas som LhrFel { code, message } med serverns svenska text.
// ============================================================================

import { app, auth, db } from "../../firebase-config.js";
import { Bytes, doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { hamtaKatalog as lasKatalog, invalideraKatalog } from "../hr-egna-data.js";
import { omradeslista } from "./lhr-modell.js";

const REGION = "europe-west1";

export class LhrFel extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const calls = new Map();
function callable(namn) {
  if (!calls.has(namn)) {
    const fns = getFunctions(app, globalThis.__PP_FUNCTIONS_URL || REGION);
    calls.set(namn, httpsCallable(fns, namn, { timeout: 20_000 }));
  }
  return calls.get(namn);
}

async function anropa(namn, data) {
  try {
    return (await callable(namn)(data)).data;
  } catch (err) {
    const code = String(err?.code || "").replace(/^functions\//, "");
    const msg = String(err?.message || "");
    const egen = msg && msg.toLowerCase().replace(/[\s_]/g, "-") !== code;
    if (code === "not-found" && !egen) {
      throw new LhrFel(code, "Servern svarar inte på kartorna ännu (funktionen saknas). Försök igen senare.");
    }
    throw new LhrFel(code, egen && code !== "internal" ? msg : "Något gick fel – inget ändrades. Försök igen.");
  } finally {
    invalideraKatalog(); // startsidan och listan läser om katalogen
  }
}

export const sparaPack = (pack, { kopieraFran } = {}) => anropa("hittaRattSparaPack", { pack, ...(kopieraFran ? { kopieraFran } : {}) });
export const raderaPack = (packId) => anropa("hittaRattRaderaPack", { packId });
export const sattTopplista = (packId, pa) => anropa("hittaRattSattTopplista", { packId, pa: pa === true });

export const hamtaKatalog = () => lasKatalog({ farsk: true });

const ALFABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const nyttBildId = (packId) => `${packId}--${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALFABET[b % ALFABET.length]).join("")}`;

export async function sparaBild(packId, { blob, mime, bredd, hojd }) {
  const id = nyttBildId(packId);
  const data = Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer()));
  try {
    await setDoc(doc(db, "hittaRattBilder", id), {
      ownerUid: auth.currentUser?.uid || "", packId, mime, bredd, hojd, data, skapad: serverTimestamp(),
    });
  } catch (err) {
    throw new LhrFel(String(err?.code || ""), "Bilden kunde inte sparas. Försök igen.");
  }
  return id;
}

export async function hamtaPack(id) {
  const snap = await getDoc(doc(db, "hittaRattPacks", id));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

const jsonCache = new Map();
function hamtaJson(rel) {
  if (!jsonCache.has(rel)) {
    const p = fetch(new URL(`../content/${rel}`, import.meta.url)).then((r) => {
      if (!r.ok) throw new Error(`${rel}: ${r.status}`);
      return r.json();
    });
    p.catch(() => jsonCache.delete(rel));
    jsonCache.set(rel, p);
  }
  return jsonCache.get(rel);
}

export const hamtaGeo = (geo) => hamtaJson(`geo/${geo}.json`);
export const hamtaPackIndex = () => hamtaJson("packs/index.json");
export const hamtaOfficielltPack = (id) => hamtaJson(`packs/${id}.json`);

export async function laddaOmraden(geo) {
  const [namn, nycklar] = await Promise.all([hamtaJson(`geo/${geo}.namn.json`), hamtaJson(`geo/${geo}.nycklar.json`)]);
  const ids = Object.fromEntries(Object.entries(nycklar).map(([key, id]) => [id, key]));
  return { lista: omradeslista(namn, nycklar), nycklar, geoOmraden: { [geo]: ids } };
}
