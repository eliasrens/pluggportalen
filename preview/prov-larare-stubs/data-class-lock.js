// Stubb för src/data-class-lock.js (#740-preview): låset i minnet.
import { S } from "./state.js";
export const serverNow = () => Date.now();
export const syncServerClock = async () => 0;
export async function setClassLock(classId, lock) { S.las[classId] = lock; S.logg(`🔒 ${classId} låst till ${lock.mal.namn}`); return lock; }
export async function clearClassLock(classId) { delete S.las[classId]; S.logg(`🔓 ${classId} upplåst`); }
export async function getClassLock(classId) { return S.las[classId] || null; }
