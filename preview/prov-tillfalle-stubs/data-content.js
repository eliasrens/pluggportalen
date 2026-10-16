// Stubb för src/data-content.js (#740-preview; ämnen/områden för #745).
import { S } from "./state.js";
import { AMNEN, OMRADEN } from "../prov-larare-stubs/omraden.js";
export const getStudentsByIds = async (ids) => ids.map((id) => ({ id, namn: S.namn[id] }));
export const getSubjects = async () => AMNEN;
export const getAreas = async (subjectId) => OMRADEN[subjectId] || [];
