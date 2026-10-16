// Stubb för src/prov/prov-watch.js (#740-preview): ett öppet tillfälle tills
// kontrollraden "Läraren stänger provet" trycks.
import { S } from "./state.js";

export function onProvChange(fn) {
  S.lyssnare.add(fn);
  return () => S.lyssnare.delete(fn);
}
export async function provForMe() {
  return { oppna: S.tf.status === "oppet" ? [{ ...S.tf }] : [], tillbaka: S.tillbaka, myClassIds: ["4a"] };
}
export function laraStanger() {
  S.tf.status = "stangt";
  if (S.svar && !S.svar.inlamnad) Object.assign(S.svar, { inlamnad: true, inlamnadNar: "stangt" });
  S.lyssnare.forEach((fn) => fn({ oppna: [], tillbaka: S.tillbaka, synligt: true, nyttOppet: false, andrat: false }));
}
