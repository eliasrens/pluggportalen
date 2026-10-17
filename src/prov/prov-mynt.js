// ============================================================================
// Prov (#746, spec §11): Pluggmynt per prov – den rena logiken. Ingen
// Firebase/DOM (testas i test/prov-mynt.test.js). Utbetalningen:
// prov-mynt-pay.js (samma kvitto-mönster som Live-mynten), reglerna:
// firestore.rules "provMynt".
//
// Provets inställning (prov.installningar.mynt, kopieras till tillfället):
//   { typ: "inga" }                 standard – inga mynt
//   { typ: "fast",  antal: 1–200 }  fast summa för ett inlämnat prov
//   { typ: "poang", antal: 1–20 }   mynt per poäng – kräver att provet poängsätts
// Beloppet räknas FÖRST vid tillbakalämningen, ur rättningen, och är högst
// MYNT_TAK (200) per prov och elev.
//
// API
//   MYNT_TAK, MYNT_FAST_MAX, MYNT_PER_POANG_MAX, MYNT_TYPER, STANDARD_MYNT
//   tolkaMynt(raw)                    → { typ, antal } (okänt/ofullständigt = inga)
//   valideraMynt(raw, poang)          → { value, fel: string[] }
//   harMynt(installningar)            → bool (något att betala ut)
//   provMyntBelopp(installningar, r, svarDok) → heltal 0–MYNT_TAK
//   myntRegelText(mynt)               → "20 pluggmynt för inlämnat prov" ("" = inga)
//   myntText(n)                       → "+36 mynt" ("" för 0)
// ============================================================================

export const MYNT_TAK = 200;
export const MYNT_FAST_MAX = MYNT_TAK;
export const MYNT_PER_POANG_MAX = 20;
export const MYNT_TYPER = Object.freeze(["inga", "fast", "poang"]);
export const STANDARD_MYNT = Object.freeze({ typ: "inga" });

const heltal = (v) => {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return String(v ?? "").trim() !== "" && Number.isInteger(n) ? n : null;
};

/** Inställningen i sparbar form – allt som inte är ett giltigt val blir "inga". */
export function tolkaMynt(raw) {
  const typ = raw?.typ;
  const antal = heltal(raw?.antal);
  if (typ === "fast" && antal >= 1 && antal <= MYNT_FAST_MAX) return { typ, antal };
  if (typ === "poang" && antal >= 1 && antal <= MYNT_PER_POANG_MAX) return { typ, antal };
  return { ...STANDARD_MYNT };
}

/**
 * Lärarens val (redigeraren eller AI-JSON). `poang` = provet poängsätts.
 * @returns {{ value: { typ, antal? }, fel: string[] }}
 */
export function valideraMynt(raw, poang = true) {
  if (raw === undefined || raw === null) return { value: { ...STANDARD_MYNT }, fel: [] };
  if (typeof raw !== "object" || Array.isArray(raw) || !MYNT_TYPER.includes(raw.typ)) {
    return { value: { ...STANDARD_MYNT }, fel: ['Inställningar: "mynt" måste vara { "typ": "inga" | "fast" | "poang", "antal": … }.'] };
  }
  if (raw.typ === "inga") return { value: { ...STANDARD_MYNT }, fel: [] };
  const fel = [];
  const antal = heltal(raw.antal);
  if (raw.typ === "fast" && !(antal >= 1 && antal <= MYNT_FAST_MAX)) {
    fel.push(`Mynt: den fasta summan måste vara ett heltal 1–${MYNT_FAST_MAX}.`);
  }
  if (raw.typ === "poang") {
    if (!(antal >= 1 && antal <= MYNT_PER_POANG_MAX)) fel.push(`Mynt: mynt per poäng måste vara ett heltal 1–${MYNT_PER_POANG_MAX}.`);
    if (poang === false) fel.push("Mynt: mynt per poäng kräver att provet poängsätts.");
  }
  return { value: fel.length ? { ...STANDARD_MYNT } : { typ: raw.typ, antal }, fel };
}

/** Delar provet ut mynt alls? (per poäng bara om det poängsätts) */
export function harMynt(installningar) {
  const m = tolkaMynt(installningar?.mynt);
  return m.typ === "fast" || (m.typ === "poang" && installningar?.poang !== false);
}

/**
 * Vad eleven ska ha fått totalt för provet (inte skillnaden – den räknar
 * utbetalningen mot kvittot). 0 om provet inte är tillbakalämnat, eleven
 * inte lämnat in eller provet inte delar ut mynt. Per poäng avrundas nedåt.
 * @param {object} installningar  tillfällets
 * @param {object|null} r         elevens rättning
 * @param {object|null} svarDok   elevens svar-dokument
 */
export function provMyntBelopp(installningar, r, svarDok) {
  if (!harMynt(installningar) || r?.aterlamnad !== true || svarDok?.inlamnad !== true) return 0;
  const m = tolkaMynt(installningar.mynt);
  const summa = m.typ === "fast" ? m.antal : Math.floor(m.antal * Math.max(0, Number(r.totalPoang) || 0));
  return Math.max(0, Math.min(MYNT_TAK, summa));
}

/** Lärarens sammanfattning av valet ("" = inga mynt). */
export function myntRegelText(mynt) {
  const m = tolkaMynt(mynt);
  if (m.typ === "fast") return `${m.antal} pluggmynt för inlämnat prov`;
  if (m.typ === "poang") return `${m.antal} pluggmynt per poäng (högst ${MYNT_TAK})`;
  return "";
}

/** "+36 mynt" – det eleven faktiskt har fått. */
export function myntText(n) {
  const k = Math.max(0, Math.floor(Number(n) || 0));
  return k ? `+${k} mynt` : "";
}
