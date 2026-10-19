// ============================================================================
// Schack – klientens tunna lager mot molnet (src/schack/schack-moln.js, #779)
// ----------------------------------------------------------------------------
// Laddas BARA med import() (bootgrafen, #271). Allt elev-mot-elev går genom
// callables (servern avgör allt – docs/SCHACK.md §12); här finns bara anropen,
// de två lyssnarna och klockhjälpen. 2B (lobbyn/partiet) och 2C (lärarvyn)
// bygger på det här API:t utan att läsa serverkoden.
//
//   lobby.vanta(classId, klocka) / slutaVanta(classId?) / gaMed(classId, motstandare)
//   lobby.utmana(classId, till, klocka) / svara(utmaningId, ja, classId?)
//   parti.drag(partiId, { from, to, promotion? }) / geUpp / remi(partiId, handling) / kravaVinst
//   larare.avsluta(partiId) / topplista(classId, { dold?, nollstall? })
//   lyssnaKlass(classId, cb, onError?)   → avregistrering; cb(klass) med rensad lobby
//   lyssnaParti(partiId, cb, onError?)   → avregistrering; cb(parti | null)
//   klockaVisning(parti, nu = serverNow()) → { vitMs, svartMs, slut } för visningen
//   datorPartiKlart()                     EN skrivning: studentData.schack.datorPartier + 1
//   lektionKlar(nr, stjarnor)             EN skrivning: studentData.schack.lektioner.<nr> (guiden, #790)
//   pusselLost(sort, nr)                  EN skrivning: studentData.schack.pussel.<sort> (pusslen, #791)
//   mynt.datorVinst/lektion/pussel(...)   pluggmynten via callables (#798) → { mynt, redan, nyckel, pokal }
//   lasMyntKvitto()                       EN läsning: schackMynt/{uid} (bockarna)
//   SchackMolnFel(code, message)          felet från servern (code = HttpsError-koden)
// Alla tider från servern är epoch-ms; klienten jämför mot serverNow() (klock-
// korrigerad, data-class-lock.js) – aldrig mot Date.now() rakt av.
// ============================================================================

import { app, db } from "../firebase-config.js";
import { doc, getDoc, onSnapshot, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { currentStudentId } from "../data.js";
import { serverNow, syncServerClock } from "../data-class-lock.js";
import { klockaNu, rensaLobby } from "./schack-server-delat.js";

export { serverNow, syncServerClock, klockaNu, rensaLobby };
export * from "./schack-server-delat.js";

const REGION = "europe-west1";
const TIMEOUT_MS = 20_000;

export class SchackMolnFel extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SchackMolnFel";
    this.code = code;
  }
}

const calls = new Map();
function callable(name, timeout = TIMEOUT_MS) {
  if (!calls.has(name)) {
    const fns = getFunctions(app, globalThis.__PP_FUNCTIONS_URL || REGION);
    calls.set(name, httpsCallable(fns, name, { timeout }));
  }
  return calls.get(name);
}

/** Ett anrop; serverns fel blir SchackMolnFel med koden utan "functions/"-prefix. */
async function call(name, data, timeout) {
  try {
    return (await callable(name, timeout)(data)).data;
  } catch (err) {
    const code = String(err?.code || "").replace(/^functions\//, "") || "unknown";
    const msg = String(err?.message || "");
    throw new SchackMolnFel(code, msg && msg.toLowerCase() !== code ? msg : "Det gick inte just nu – försök igen.");
  }
}

const utan = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export const lobby = {
  vanta: (classId, klocka = null) => call("schackVanta", { classId, klocka }),
  slutaVanta: (classId) => call("schackSlutaVanta", utan({ classId })),
  gaMed: (classId, motstandare) => call("schackGaMed", { classId, motstandare }),
  utmana: (classId, till, klocka = null) => call("schackUtmana", { classId, till, klocka }),
  svara: (utmaningId, ja, classId) => call("schackSvara", utan({ utmaningId, ja: ja === true, classId })),
};

export const parti = {
  drag: (partiId, { from, to, promotion } = {}) => call("schackDrag", utan({ partiId, from, to, promotion })),
  geUpp: (partiId) => call("schackGeUpp", { partiId }),
  remi: (partiId, handling) => call("schackRemi", { partiId, handling }),
  kravaVinst: (partiId) => call("schackKravaVinst", { partiId }),
};

export const larare = {
  avsluta: (partiId) => call("schackLarareAvsluta", { partiId }),
  topplista: (classId, { dold, nollstall } = {}) => call("schackLarareTopplista", utan({ classId, dold, nollstall })),
};

// Pluggmynten (#798): servern kontrollerar och betalar (functions/schack-mynt.js).
// schackDatorVinst spelar om hela partiet med motorn – Damen kan ta en halv minut.
const DATOR_VINST_TIMEOUT_MS = 200_000;
export const mynt = {
  datorVinst: ({ niva, seed, drag }) => call("schackDatorVinst", { niva, seed, drag }, DATOR_VINST_TIMEOUT_MS),
  lektion: ({ nr, losning }) => call("schackLektionMynt", { nr, losning }),
  pussel: ({ sort, nr, id, drag }) => call("schackPusselMynt", { sort, nr, id, drag }),
};

/** Kvittot schackMynt/{uid} (EN läsning per besök på schacksidan); saknat = {}. Fel kastas. */
export async function lasMyntKvitto() {
  const uid = currentStudentId();
  if (!uid) return {};
  const snap = await getDoc(doc(db, "schackMynt", uid));
  return snap.exists() ? snap.data() : {};
}

/** Klassdokumentet i säker form (saknat dokument = tomt) med utgångna lobbyposter bortfiltrerade. */
export function normaliseraKlass(data, nu = serverNow()) {
  const map = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const k = { vantar: map(data?.vantar), utmaningar: map(data?.utmaningar), partier: map(data?.partier), tabell: map(data?.tabell), dold: data?.dold === true };
  const r = rensaLobby(k, nu);
  return { ...k, vantar: r.vantar, utmaningar: r.utmaningar, finns: Boolean(data) };
}

/**
 * EN onSnapshot på schackKlass/{classId} – bara medan eleven är på schacksidan;
 * anropa avregistreringen när sidan lämnas (§9). Nekad läsning → onError.
 */
export function lyssnaKlass(classId, cb, onError = () => {}) {
  syncServerClock();
  return onSnapshot(doc(db, "schackKlass", classId), (snap) => cb(normaliseraKlass(snap.exists() ? snap.data() : null)), onError);
}

/**
 * EN onSnapshot på schackPartier/{partiId}; cb(null) om partiet inte finns (reglerna
 * släpper igenom ett saknat dokument). onError = nekad läsning (inte din match).
 */
export function lyssnaParti(partiId, cb, onError = () => {}) {
  syncServerClock();
  return onSnapshot(doc(db, "schackPartier", partiId), (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}

/** Klockorna för visningen: räknas lokalt ur senastDragAt och serverNow() – ingen skrivning per sekund. */
export function klockaVisning(p, nu = serverNow()) {
  if (!p?.klocka) return null;
  if (p.status !== "pagar") return { vitMs: p.klocka.vitMs, svartMs: p.klocka.svartMs, slut: false };
  return klockaNu(p.klocka, p.tur, nu);
}

/**
 * Ett datorparti tog slut: räknaren studentData.schack.datorPartier ökar med 1
 * i EN skrivning (regeln schackOk tillåter +1). Fel sväljs – statistiken får
 * aldrig stoppa spelet.
 */
export async function datorPartiKlart() {
  const uid = currentStudentId();
  if (!uid) return false;
  try {
    await updateDoc(doc(db, "studentData", uid), { "schack.datorPartier": increment(1) });
    return true;
  } catch (err) {
    console.warn("schack: datorPartier kunde inte sparas", err);
    return false;
  }
}

/**
 * En lektion i guiden blev klar med ett BÄTTRE resultat (#790): EN skrivning av
 * fältvägen schack.lektioner.<nr> (regeln schackOk: heltal 1–3, sänks aldrig).
 * Anroparen (schack-guide-vy.js) skriver bara vid förbättring. Fel sväljs.
 */
export async function lektionKlar(nr, stjarnor) {
  const uid = currentStudentId();
  const n = Number(nr);
  if (!uid || !Number.isInteger(n) || n < 1 || n > 12 || ![1, 2, 3].includes(stjarnor)) return false;
  try {
    await updateDoc(doc(db, "studentData", uid), { [`schack.lektioner.${n}`]: stjarnor });
    return true;
  } catch (err) {
    console.warn("schack: lektionen kunde inte sparas", err);
    return false;
  }
}

/**
 * Ett NYTT pussel löstes (#791): EN skrivning av fältvägarna
 * schack.pussel.<sort>.losta (+1) och .senast (= nr). Regeln schackOk: losta ökar
 * med högst 1 och sjunker aldrig, senast sjunker aldrig. Anroparen (schack-pussel-vy.js)
 * skriver bara när nr > senast. Fel sväljs.
 */
export async function pusselLost(sort, nr) {
  const uid = currentStudentId();
  if (!uid || !["ett", "tva"].includes(sort) || !Number.isInteger(nr) || nr < 1 || nr > 1000) return false;
  try {
    await updateDoc(doc(db, "studentData", uid), {
      [`schack.pussel.${sort}.losta`]: increment(1),
      [`schack.pussel.${sort}.senast`]: nr,
    });
    return true;
  } catch (err) {
    console.warn("schack: pusslet kunde inte sparas", err);
    return false;
  }
}
