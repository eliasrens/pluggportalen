// ============================================================================
// Unikt försöks-id per visad fråga (#457) – skydd mot dubbla svar.
// ----------------------------------------------------------------------------
// Id:t skapas när frågan VISAS och blir svarsdokumentets dokument-id
// (…/answers/{attemptId}). firestore.rules tillåter bara CREATE av ett
// svarsdokument (aldrig update), så en omsändning av samma försök (dubbel-
// ENTER, nätverksretry, offline-kö) kan aldrig räknas två gånger.
//
// API
//   newAttemptId()          → "a" + 20 tecken [0-9a-z] (matchar ATTEMPT_ID_RE)
//   ATTEMPT_ID_RE           → /^[A-Za-z0-9_-]{8,64}$/ (samma som reglerna)
// ============================================================================

export const ATTEMPT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** @returns {string} slumpat, URL-/doc-id-säkert försöks-id */
export function newAttemptId() {
  const bytes = new Uint8Array(20);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = "a";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
