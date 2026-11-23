// ============================================================================
// Pluggporten – veckoschemats tid (#900, docs/VECKOSCHEMA.md §Tiden), REN logik
// ----------------------------------------------------------------------------
// Schemat gäller i svensk tid (Europe/Stockholm) oavsett datorns tidszon:
// veckodag och klockslag räknas med Intl på serverNow(), aldrig med getHours().
// Sommar- och vintertidsbytet hanteras av Intl (och rättas i nastaSvenskTid).
// Ingen Firebase, ingen DOM – laddas bara via klass-schema.js (import()).
// ============================================================================

/** Schemat gäller i svensk tid, oavsett datorns tidszon. */
export const SCHEMA_TZ = "Europe/Stockholm";

const TID = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:MM" → minuter efter midnatt (null om formatet är fel). */
export function tidTillMinuter(hhmm) {
  if (typeof hhmm !== "string" || !TID.test(hhmm)) return null;
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
}

let fmt = null;
const VECKODAG = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/**
 * Svensk väggtid för epoch-ms `now`: { dag 1–7 (måndag = 1), minut 0–1439, sekund }.
 * Räknas med Intl i Europe/Stockholm – datorns tidszon spelar ingen roll.
 */
export function svenskTid(now) {
  fmt ||= new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHEMA_TZ, weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  return { dag: VECKODAG[p.weekday], minut: (Number(p.hour) % 24) * 60 + Number(p.minute), sekund: Number(p.second) };
}

const VECKA = 7 * 1440;
const veckominut = (t) => (t.dag - 1) * 1440 + t.minut;

/**
 * Epoch-ms för början av den svenska väggtidsminuten dag/minut: den pågående
 * minuten (kan alltså vara ≤ now) eller nästa gång den inträffar inom en vecka.
 * Rättas mot Intl så att ett sommar-/vintertidsbyte emellan blir rätt.
 */
export function nastaSvenskTid(now, dag, minut) {
  const t = svenskTid(now);
  const borjan = now - t.sekund * 1000 - (((now % 1000) + 1000) % 1000); // början av den svenska minuten
  const mal = (dag - 1) * 1440 + minut;
  let kandidat = borjan + ((mal - veckominut(t) + VECKA) % VECKA) * 60_000;
  // En timmes sommar-/vintertid emellan: flytta med skillnaden i väggtid (inom ± ett halvt dygn).
  for (let i = 0; i < 2; i++) {
    const diff = ((mal - veckominut(svenskTid(kandidat)) + VECKA + 720) % VECKA) - 720;
    if (!diff) break;
    kandidat += diff * 60_000;
  }
  return kandidat;
}
