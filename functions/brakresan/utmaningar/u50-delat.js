// ============================================================================
// 50. Mästarkluringarna – delade byggstenar (utmaningar/u50-delat.js) · #712 G
// ----------------------------------------------------------------------------
// Svarsdelar och regler som alla tio problemfamiljerna (u50-familjer.js,
// u50-resonemang.js) använder: ett tal-/bråksvar och högst ett val.
// ============================================================================

import { formatForm, mixedFormOf } from "../math/index.js";
import { nd } from "./delat-g.js";

export const NAMN = ["Ella", "Omar", "Sara", "Leo", "Maja", "Ali", "Nora", "Elias"];

export const bt = (v) => formatForm(mixedFormOf(v)); // värde som text: 3/4, 1 1/2, 3
export const tal = (v) => ({ type: "number", value: nd(v), requirement: { kind: "value" } });
export const heltal = (v) => ({ type: "number", value: v, requirement: { kind: "integer" } });
export const NUM = { type: "number", input: "mixed" };
export const INT = { type: "number", input: "integer" };
/** Svarskort (ja/nej, vem …) som en del i en sammansatt vy. */
export const valDel = (cards, rubrik) => ({ view: { component: "kort", cards: cards.map((c) => ({ id: c.id, face: { text: c.text } })), lista: true }, svar: "val", rubrik, label: "Välj ett svar" });
export const svarDel = (expr) => ({ view: { component: "notation", expr: [...expr] }, svar: "svar" });
/** Ett enkelt svar (bara tal) – eller multi med ett val. */
export const ettSvar = (spec, regel) => ({ answer: { type: "multi", parts: { svar: spec } }, key: { type: "multi", parts: { svar: regel } } });
