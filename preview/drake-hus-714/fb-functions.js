// Preview-stub för firebase-functions.js (#714): bara brakresaRenameDragon
// finns (namnbytet i drakpanelen) – den skriver som servern: state.dragon.name
// + studentData.brakdrake.name. Övriga callables svarar med ett fel.
// #715: brakresaHunt – en jakt per dag (enhetens svenska datum här, servertid på riktigt),
// samma fynd igen vid omladdning, mynt + state.hunts som servern.
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
    if (namn === "brakresaHunt") {
      const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());
      const ref = doc(null, "studentData/elev1/brakresa/state");
      const state = (await getDoc(ref)).data() || {};
      const hunts = { count: 0, coins: 0, lastDate: null, ...(state.hunts || {}) };
      const level = Math.min(15, Math.floor((state.totalStars || 0) / 10));
      const max = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200][level];
      if (!state.dragon || level < 1) throw Object.assign(new Error("Ägget har inte kläckts ännu."), { code: "failed-precondition" });
      await new Promise((r) => setTimeout(r, 600));
      if (hunts.lastDate === date) {
        return { data: { huntId: date, date, level, max, amount: hunts.lastAmount, already: true, hunts } };
      }
      const amount = 1 + Math.floor(Math.random() * max);
      const ny = { count: hunts.count + 1, coins: hunts.coins + amount, lastDate: date, lastAmount: amount };
      await updateDoc(ref, { hunts: ny });
      const sd = (await getDoc(doc(null, "studentData/elev1"))).data() || {};
      await updateDoc(doc(null, "studentData/elev1"), { coins: (sd.coins || 0) + amount });
      return { data: { huntId: date, date, level, max, amount, coinsAfter: (sd.coins || 0) + amount, already: false, hunts: ny } };
    }
    throw Object.assign(new Error(`callable ${namn} finns inte i previewn`), { code: "unavailable" });
  };
}
