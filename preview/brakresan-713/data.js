// Stubbe för src/brakresan/data.js i preview-brakresan-713.html (#713): elevens
// state ur ?s=… (samma lägen som preview-brakresan-huvudvy.html), namnbyte och
// ackDragon sparas i sessionStorage så att omladdning visar resultatet. Inga anrop.
import { createSaveStatus, createDrafts } from "../../src/brakresan/data-core.js";
import { CHALLENGE_IDS } from "../../src/brakresan/schema/katalog.js";
import { stockholmDate } from "../../src/brakresan/schema/regler.js";

export const saveStatus = createSaveStatus();
export const drafts = createDrafts(globalThis.sessionStorage);
const s = new URLSearchParams(location.search).get("s") || "mitt";
const idag = stockholmDate(Date.now());
const NYCKEL = `pv713:${s}`;
const sparat = () => JSON.parse(sessionStorage.getItem(NYCKEL) || "{}");
const spara = (p) => sessionStorage.setItem(NYCKEL, JSON.stringify({ ...sparat(), ...p }));

function bygg(stars, extra = {}) {
  const challenges = {};
  let kvar = stars;
  for (const id of CHALLENGE_IDS) {
    if (kvar <= 0) break;
    const n = Math.min(3, kvar);
    challenges[id] = { stars: n, firstTotal: 10 * n, last: 8 + (n % 3) };
    kvar -= n;
  }
  return { challenges, dragon: null, hunts: { count: 0, coins: 0, lastDate: null }, ...extra };
}
const drake = (levelShown, name = "Glöd") => ({ id: "drake-alva", levelShown, name });
const LAGEN = {
  ny: () => bygg(0),
  agg: () => bygg(7),
  klack: () => bygg(10, { dragon: drake(0, "Bråkis") }),
  mitt: () => {
    const st = bygg(33, { dragon: drake(3), hunts: { count: 6, coins: 97, lastDate: idag } });
    st.challenges["14"] = { stars: 0, firstTotal: 4, activeRoundId: "x", activeAnswered: 4 };
    st.challenges["19"] = { stars: 0, firstTotal: 10, last: 6 };
    st.challenges["21"] = { stars: 1, firstTotal: 10, last: 8 };
    return st;
  },
  evo: () => bygg(40, { dragon: drake(3), hunts: { count: 9, coins: 142, lastDate: "2026-01-01" } }),
  full: () => bygg(150, { dragon: drake(15, "Stjärnfall"), hunts: { count: 120, coins: 9876, lastDate: idag } }),
};

export async function getState() {
  const st = (LAGEN[s] || LAGEN.mitt)();
  st.totalStars = Object.values(st.challenges).reduce((a, c) => a + (c.stars || 0), 0);
  st.mastered = Object.values(st.challenges).filter((c) => c.stars === 3).length;
  const p = sparat();
  if (st.dragon && p.name) st.dragon.name = p.name;
  if (st.dragon && p.levelShown) st.dragon.levelShown = p.levelShown;
  return st;
}
export async function getRecommendations() {
  return s === "ny" || s === "mitt" ? [
    { active: true, studentId: "alva", challengeIds: ["03", "19"], comment: "Vi jobbar med tallinjen den här veckan." },
    { active: true, classId: "4a", challengeIds: ["12"] },
  ] : [];
}
export async function renameDragon(name) {
  await new Promise((r) => setTimeout(r, 250));
  spara({ name });
  return { name };
}
export async function ackDragon(level) {
  spara({ levelShown: level });
  return { levelShown: level };
}
