// Stubb för src/prov/prov-tillfalle-data.js (#742-preview): bara läsningarna.
import { PROV, S } from "./state.js";

const vanta = () => new Promise((r) => setTimeout(r, 120));
const nej = async () => { throw new Error("Inte i den här förhandsvisningen (se preview-prov-tillfallen.html)."); };
export async function listaProv() { return [{ id: "p1", ...PROV }]; }
export async function hamtaProv() { return { id: "p1", ...PROV }; }
export async function hamtaTillfalle(t) { await vanta(); S.lasningar++; return t === S.tf.id ? structuredClone(S.tf) : null; }
export async function listaTillfallen(classIds) { await vanta(); return classIds.includes(S.tf.classId) ? [structuredClone(S.tf)] : []; }
export async function hamtaSvar() { await vanta(); return structuredClone(S.svar); }
export const skapaTillfalle = nej;
export const oppnaTillfalle = nej;
export const stangTillfalle = nej;
export const raderaTillfalle = nej;
export const sparaExtraTid = nej; // #748
export const sparaHelskarm = nej; // #810
export const slappIn = nej;
export const lyssnaPausade = () => () => {};
