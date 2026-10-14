// ============================================================================
// Bråkresan – matematikmotorn (src/brakresan/math/) · #706
// ----------------------------------------------------------------------------
// Ren JS utan beroenden, delad med Cloud Functions (admin/sync-brakresan-
// functions.mjs → functions/brakresan/math/). Se docs/BRAKRESAN.md §3.
//   rational.js      exakta värden { n, d } – gcd-normaliserade, positiv nämnare
//   form.js          presentationsform (2/4, 2 3/4, 0,50, 25 %) skild från värdet
//   decimal.js       ändliga decimaler (bara 2/5-nämnare), svensk decimalkomma
//   percent.js       procent på samma exakta värde, procent av, rabatt
//   compare.js       <, =, >, sortering, unikhet
//   input.js         elevens fält → form, eller inmatningsfel (låser inte)
//   requirements.js  formkrav: angiven nämnare, enklaste form, blandad form …
//   words.js         uppläsning: "tre fjärdedelar"
// ============================================================================

export * from "./rational.js";
export * from "./form.js";
export * from "./decimal.js";
export * from "./percent.js";
export * from "./compare.js";
export * from "./input.js";
export * from "./requirements.js";
export * from "./words.js";
