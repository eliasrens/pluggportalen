// Preview-stub för firebase-functions.js (#714): bara brakresaRenameDragon
// finns (namnbytet i drakpanelen) – den skriver som servern: state.dragon.name
// + studentData.brakdrake.name. Övriga callables svarar med ett fel.
import { doc, getDoc, updateDoc } from "./fb-firestore.js";

export function getFunctions() { return {}; }
export function httpsCallable(_f, namn) {
  return async (data) => {
    if (namn === "brakresaRenameDragon") {
      const name = String(data?.name || "").replace(/[<>&"'\u0000-\u001f]/g, "").trim().slice(0, 16);
      if (!name) throw Object.assign(new Error("Skriv ett namn."), { code: "invalid-argument" });
      const state = (await getDoc(doc(null, "studentData/elev1/brakresa/state"))).data();
      await updateDoc(doc(null, "studentData/elev1/brakresa/state"), { dragon: { ...state.dragon, name } });
      await updateDoc(doc(null, "studentData/elev1"), { "brakdrake.name": name });
      return { data: { name } };
    }
    throw Object.assign(new Error(`callable ${namn} finns inte i previewn`), { code: "unavailable" });
  };
}
