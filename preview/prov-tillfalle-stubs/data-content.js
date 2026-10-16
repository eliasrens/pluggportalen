// Stubb för src/data-content.js (#740-preview).
import { S } from "./state.js";
export const getStudentsByIds = async (ids) => ids.map((id) => ({ id, namn: S.namn[id] }));
