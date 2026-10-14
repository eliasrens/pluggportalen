import { S } from "./state.js";
const klass = { id: "4a", name: "4A", studentIds: ["alva"], hiddenModules: S.dolda, enabledModules: S.enabled };
export const getSession = () => ({ role: "student", id: "alva", namn: S.namn });
export const currentStudentId = () => "alva";
export function logout() { window.__pvUtloggad = true; }
export async function getStudentData() { return { coins: S.coins, avatarItems: [] }; }
export async function getStats() { return { stars: S.stars }; }
export async function getClasses() { return [klass]; }
