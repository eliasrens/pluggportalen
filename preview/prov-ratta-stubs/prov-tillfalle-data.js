// Stubb för src/prov/prov-tillfalle-data.js (#741-preview): bara det rättningen
// och fliken Provtillfällen läser. Öppna/stänga/radera görs inte här.
import { S } from "./state.js";
import { PROV } from "./state.js";

const vanta = () => new Promise((r) => setTimeout(r, 150));
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
