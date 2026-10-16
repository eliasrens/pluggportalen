// Stubb för src/data-content.js (#742-preview): elevernas namn.
import { S } from "./state.js";
export const getStudentsByIds = async (ids) => { S.lasningar += ids.length; return ids.map((id) => ({ id, namn: S.namn[id] })); };
