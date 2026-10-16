// ============================================================================
// Bråkresan – formkrav (src/brakresan/math/requirements.js) · #706
// ----------------------------------------------------------------------------
// Spec §6: "Skilj värdelikhet från krav på skrivform." 3/4 och 6/8 är båda rätt
// på "Hur mycket är det?", men bara 3/4 uppfyller "Skriv i enklaste form".
// Ett formkrav är ett JSON-objekt i uppgiftens bedömningsregel:
//
//   { kind: "value" }                       alla likvärdiga svar (standard)
//   { kind: "denominator", d }              bråk med just nämnaren d (utm. 14)
//   { kind: "simplest" }                    bråk i enklaste form (utm. 21)
//   { kind: "mixed", simplified = true }    blandad form, bråkdel < 1 (utm. 28)
//   { kind: "fraction", simplified = false } bråkform, inte blandad (28 åt andra hållet)
//   { kind: "decimal" } · { kind: "percent" } · { kind: "integer" }
//
// checkForm(form, expected, requirement) → { correct, valueOk, formOk, reason,
// message }. Ett likvärdigt men formmässigt ofullständigt svar är FEL
// (correct: false) men får en egen förklaring (reason ≠ "fel-varde").
// ============================================================================

import { toQ, eq, isInteger, lt, ONE, gcd } from "./rational.js";
import { valueOf, isForm } from "./form.js";

export const FORM_MESSAGES = Object.freeze({
  "ej-enklaste": "Rätt värde, men bråket går att förkorta mer. Skriv det i enklaste form.",
  "fel-namnare": (r) => `Rätt värde, men uppgiften ber om nämnaren ${r.d}.`,
  "ej-blandad": "Rätt värde, men skriv det i blandad form: hela och en bråkdel som är mindre än 1.",
  "ej-forkortad-del": "Rätt värde, men bråkdelen går att förkorta. Skriv den i enklaste form.",
  "ej-brakform": "Rätt värde, men skriv det som ett bråk, utan heltal framför.",
  "ej-decimal": "Rätt värde, men skriv det som ett decimaltal.",
  "ej-procent": "Rätt värde, men skriv det i procent.",
  "ej-heltal": "Rätt värde, men skriv det som ett heltal.",
});

const reduced = (n, d) => (n === 0 ? d === 1 : gcd(n, d) === 1);
const properMixed = (f) => f.kind === "mixed" && f.whole >= 1 && f.n >= 1 && f.n < f.d;

/** Uppfyller formen kravet, givet att värdet redan är rätt? Svarar en reason eller null. */
function formReason(f, expected, req) {
  switch (req?.kind ?? "value") {
    case "value":
      return null;
    case "denominator":
      return f.kind === "fraction" && f.d === req.d ? null : "fel-namnare";
    case "simplest":
      if (f.kind === "integer") return null;
      if (f.kind === "fraction" || f.kind === "mixed") return reduced(f.n, f.d) ? null : "ej-enklaste";
      return "ej-enklaste";
    case "mixed": {
      const simplified = req.simplified !== false;
      if (isInteger(expected)) return f.kind === "integer" ? null : "ej-heltal";
      if (lt(expected, ONE)) {
        if (f.kind !== "fraction") return "ej-brakform";
        return simplified && !reduced(f.n, f.d) ? "ej-enklaste" : null;
      }
      if (!properMixed(f)) return "ej-blandad";
      return simplified && !reduced(f.n, f.d) ? "ej-forkortad-del" : null;
    }
    case "fraction":
      if (f.kind === "integer" && isInteger(expected)) return null;
      if (f.kind !== "fraction") return "ej-brakform";
      return req.simplified && !reduced(f.n, f.d) ? "ej-enklaste" : null;
    case "decimal":
      return f.kind === "decimal" || (f.kind === "integer" && isInteger(expected)) ? null : "ej-decimal";
    case "percent":
      return f.kind === "percent" ? null : "ej-procent";
    case "integer":
      return f.kind === "integer" ? null : "ej-heltal";
    default:
      throw new TypeError(`Bråkresan: okänt formkrav ${req.kind}`);
  }
}

/**
 * Bedöm ett TOLKAT svar (form.js-form) mot förväntat värde och formkrav.
 * @param {object} form  elevens svar, t.ex. { kind: "fraction", n: 6, d: 8 }
 * @param {{n:number,d:number}|number} expected  rätt värde
 * @param {object} [requirement]  formkrav, standard { kind: "value" }
 */
export function checkForm(form, expected, requirement = { kind: "value" }) {
  if (!form || !["integer", "fraction", "mixed", "decimal", "percent"].includes(form.kind) ||
      (form.kind !== "mixed" && !isForm(form))) {
    throw new TypeError("Bråkresan: checkForm kräver en tolkad form (input.js)");
  }
  const want = toQ(expected);
  const valueOk = eq(valueOf(form), want);
  if (!valueOk) return { correct: false, valueOk: false, formOk: null, reason: "fel-varde", message: null };
  const reason = formReason(form, want, requirement);
  if (!reason) return { correct: true, valueOk: true, formOk: true, reason: null, message: null };
  const m = FORM_MESSAGES[reason];
  return { correct: false, valueOk: true, formOk: false, reason, message: typeof m === "function" ? m(requirement) : m };
}
