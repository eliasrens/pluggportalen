// Förhandsvisningens stubbe för src/matchdagen/md-inst-data.js (#899) – ingen Firebase.
import { normalizeInst, nyaElevModuler, nyaEnabledModules } from "../../src/matchdagen/md-inst.js";

export async function lasInst() {
  return globalThis.__md899?.egen ? normalizeInst(globalThis.__md899.egen) : null;
}
export async function sparaAnpassning(cls, uid, { pa, inst }) {
  cls.elevModuler = nyaElevModuler(cls, uid, pa);
  if (inst) globalThis.__md899.egen = normalizeInst(inst);
  return inst ? normalizeInst(inst) : null;
}
export async function foljKlassen() {
  globalThis.__md899.egen = null;
}
export async function sparaKlass(cls, { pa, inst }) {
  cls.enabledModules = nyaEnabledModules(cls, pa);
  cls.matchdagenInst = normalizeInst(inst);
  return cls.matchdagenInst;
}
export async function sparaElevModuler(cls, uids, pa) {
  cls.elevModuler = nyaElevModuler(cls, uids, pa);
}
