// ============================================================================
// Meteorstormen (#821): ANROPSKONTRAKTET – det klienten (ms-klient.js) och
// servern (functions/meteorstorm-core.js) måste vara överens om. Ren, delas
// med servern (functions/meteorstorm/ är en genererad kopia).
//
//   MS_MIN_GAP_MS       minsta tid mellan två handlingar (rätta svar) per elev
//   MS_FEL_TAK          högst så många buffrade fel svar per anrop
//   MS_FEL_SKICKA       klienten skickar bufferten ensam när den blivit så här lång
//   MS_STATUS_MS        msPublic/status skrivs högst så här ofta per session
//   MS_EFTER_SLUT_MS    fel svar får skickas så här länge efter matchens slut
//   MS_AVSLUTA_VANTA_MS msAvsluta väntar så här länge efter slutet (sista bufferten)
//   MS_TYPER            handlingarna eleven kan välja (= motorns HANDLINGAR)
//   MS_K_FONSTER        så här långt före elevens senaste k får en fråga ligga
//                       (de överhoppade måste finnas i fel[] – högst MS_FEL_TAK)
//   fragaFor(seed, uid, k, n) → frågeindex 0…n−1 för elevens k:te quizfråga
//   multFor(seed, uid, k)     → { a, b } – elevens k:te multiplikationsfråga
//
// QUIZFRÅGORNA ("kortleken"): eleven får frågorna i en egen ordning, en hel
// blandad kortlek i taget (varje fråga en gång per varv, aldrig samma två i
// rad över varvgränsen). Ordningen är bestämd av sessionens frö + elevens uid,
// så servern vet vilken fråga eleven ska svara på utan att spara något per
// svar (fel svar skriver ingenting – Elias 2026-10-21). k = elevens räknare
// (0, 1, 2 …), en per visad fråga; servern kräver att k växer och att varje
// överhoppat k finns bland de fel svaren (#821 F2).
//
// MULTIPLIKATIONEN (#821 F1): faktorerna delas ur en egen påse per elev på
// samma sätt – inte valfria – så att ingen kan svara 0 × 0 om och om igen.
// Påsen är src/mult/generator.js "shuffle-bag" (varje kombination 0–10 en
// gång per påse, ×0/×1 en gång och övriga två, aldrig samma fråga eller dess
// spegel två gånger i rad), här med fröets PRNG. Följden räknas från k = 0 och
// minns per frö + elev (en match ≈ 100 frågor per elev).
// ============================================================================

import { HANDLINGAR } from "./ms-balans.js";
import { skapaPrng } from "./ms-prng.js";

export const MS_MIN_GAP_MS = 1000;
export const MS_FEL_TAK = 40;
export const MS_FEL_SKICKA = 25;
export const MS_STATUS_MS = 10_000;
export const MS_EFTER_SLUT_MS = 60_000;
export const MS_AVSLUTA_VANTA_MS = 4000;
export const MS_TYPER = HANDLINGAR;
export const MS_K_FONSTER = MS_FEL_TAK + 1;

function kortlek(seed, uid, varv, n) {
  const rng = skapaPrng(`${seed}|${uid}`, `fragor:${varv}`);
  const lek = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng.tal() * (i + 1));
    [lek[i], lek[j]] = [lek[j], lek[i]];
  }
  return lek;
}

/** Frågeindex för elevens k:te quizfråga (n frågor i ögonblicksbilden). */
export function fragaFor(seed, uid, k, n) {
  const antal = Math.floor(Number(n) || 0);
  const nr = Math.floor(Number(k));
  if (antal <= 1 || !(nr >= 0)) return 0;
  // Två frågor: bara växling går (bytet nedan skulle flytta varvets sista kort).
  if (antal === 2) return (kortlek(seed, uid, 0, 2)[0] + nr) % 2;
  const varv = Math.floor(nr / antal);
  const lek = kortlek(seed, uid, varv, antal);
  if (varv > 0 && lek[0] === kortlek(seed, uid, varv - 1, antal)[antal - 1]) [lek[0], lek[1]] = [lek[1], lek[0]];
  return lek[nr % antal];
}

// ---- Multiplikationens påse -------------------------------------------------

const MULT_MIN = 0;
const MULT_MAX = 10;
const MULT_MINNE = 400;
const multMinne = new Map();
const vikt = (a, b) => (a <= 1 || b <= 1 ? 1 : 2);
const krock = (p, q) => !!p && ((p.a === q.a && p.b === q.b) || (p.a === q.b && p.b === q.a));

function nyPase(rng) {
  const ut = [];
  for (let a = MULT_MIN; a <= MULT_MAX; a++) for (let b = MULT_MIN; b <= MULT_MAX; b++) for (let i = 0; i < vikt(a, b); i++) ut.push({ a, b });
  for (let i = ut.length - 1; i > 0; i--) {
    const j = Math.floor(rng.tal() * (i + 1));
    [ut[i], ut[j]] = [ut[j], ut[i]];
  }
  return ut;
}

function multFoljd(seed, uid) {
  const nyckel = `${seed}|${uid}`;
  let f = multMinne.get(nyckel);
  if (f) {
    multMinne.delete(nyckel);
  } else {
    f = { rng: skapaPrng(`${seed}|${uid}`, "mult"), pase: [], lista: [] };
    if (multMinne.size >= MULT_MINNE) multMinne.delete(multMinne.keys().next().value);
  }
  multMinne.set(nyckel, f);
  return f;
}

function multNasta(f) {
  if (!f.pase.length) f.pase = nyPase(f.rng);
  const forra = f.lista[f.lista.length - 1];
  let i = f.pase.length - 1;
  while (i >= 0 && krock(forra, f.pase[i])) i--;
  if (i < 0) {
    const rest = f.pase;
    f.pase = nyPase(f.rng);
    for (const q of rest) f.pase.splice(Math.floor(f.rng.tal() * (f.pase.length + 1)), 0, q);
    i = f.pase.length - 1;
    while (i >= 0 && krock(forra, f.pase[i])) i--;
  }
  const sist = f.pase.length - 1;
  [f.pase[i], f.pase[sist]] = [f.pase[sist], f.pase[i]];
  f.lista.push(f.pase.pop());
}

/** Elevens k:te multiplikationsfråga { a, b } (k ≥ 0). */
export function multFor(seed, uid, k) {
  const nr = Math.floor(Number(k));
  if (!(nr >= 0)) return { a: 0, b: 0 };
  const f = multFoljd(seed, uid);
  while (f.lista.length <= nr) multNasta(f);
  return { ...f.lista[nr] };
}
