import { S } from "./state.js";
export const onMattematchChange = () => () => {};
export function stopMattematchWatch() {}
export async function mattematchForMe() { return S.mm ? { competition: { id: "mm" }, classId: "4a" } : null; }
