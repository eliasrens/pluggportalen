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
//   fragaFor(seed, uid, k, n) → frågeindex 0…n−1 för elevens k:te quizfråga
//
// QUIZFRÅGORNA ("kortleken"): eleven får frågorna i en egen ordning, en hel
// blandad kortlek i taget (varje fråga en gång per varv, aldrig samma två i
// rad över varvgränsen). Ordningen är bestämd av sessionens frö + elevens uid,
// så servern vet vilken fråga eleven ska svara på utan att spara något per
// svar (fel svar skriver ingenting – Elias 2026-10-21). k = elevens räknare
// (0, 1, 2 …), en per visad fråga; servern kräver att k växer.
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
