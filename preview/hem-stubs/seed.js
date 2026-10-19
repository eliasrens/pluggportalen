// ============================================================================
// Sådd för preview/preview-hem.html (#807) – Mina klasser-sådden (#804) plus
// det Hem visar:
//   * prov att rätta: Vikingatiden i 4B (6 inlämnade, 2 rättade) och ett omprov
//     i 5A (admin) – räknarna på tillfället (rattStatus + attRatta)
//   * ett öppet prov i 4A (Bråk) och ett färdigrättat i 4A (syns inte)
//   * "Övat"-datum i classProjections (members.<uid>.ovat): 4A och 4B har
//     elever som övat i veckan och elever som inte övat på över 2 veckor
//   * en Live-match som pågår med 4B; 4A har fokusläge (ur #804-sådden)
//   * 4A har tilldelade områden (Kom igång steg 2 klart för årskurskontot)
// ============================================================================

import { seed as minaKlasser } from "../mina-klasser-stubs/seed.js";

const dag = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const ts = (msSedan) => {
  const ms = Date.now() - msSedan;
  return { seconds: Math.floor(ms / 1000), nanoseconds: 0, toMillis: () => ms };
};

/** @param {(path:string, data:object) => void} satt */
export function seed(satt) {
  const klasser = {};
  minaKlasser((path, data) => {
    if (path.startsWith("classes/")) klasser[path.slice(8)] = data;
    satt(path, data);
  });
  klasser["4a"].assignedAreas = [{ subjectId: "so", areaId: "vikingar" }, { subjectId: "so", areaId: "vasatiden" }];
  satt("classes/4a", klasser["4a"]);

  // classProjections: namn + ovat (dagar sedan; null = aldrig sedan datumen började sparas).
  const ovat = {
    "4a": { alva: 0, bilal: 1, cleo: 2, dante: 20, ebba: 0, fadi: 3, gry: null },
    "4b": { hugo: 1, ines: 16, jonas: 0, klara: 30, liam: 2, maja: 0 },
    "5a": { nils: 0, olivia: 4, pelle: 1, rut: 2 },
  };
  for (const [cid, elever] of Object.entries(ovat)) {
    const members = {};
    for (const [n, d] of Object.entries(elever)) {
      const namn = n[0].toUpperCase() + n.slice(1);
      members[`stub-${n}`] = { namn, username: n, avatarId: "fox", stars: 3, xp: 40, completed: 2, plays: 5, ...(d == null ? {} : { ovat: dag(d) }) };
    }
    satt(`classProjections/${cid}`, { members });
  }

  const fragor = [{ id: "q1", typ: "flerval", fraga: "Vem var Oden?", alternativ: ["En gud", "En kung"], poang: 1 }];
  satt("prov/p-vikingar", { namn: "Vikingatiden – avstämning", createdBy: "stub-admin", createdByName: "Elias", fragor });
  satt("prov/p-brak", { namn: "Bråk – diagnos", createdBy: "stub-admin", createdByName: "Elias", fragor });
  satt("provTillfallen/t-vik-4b", {
    provId: "p-vikingar", provNamn: "Vikingatiden – avstämning", classId: "4b", createdBy: "stub-admin", createdByName: "Elias",
    status: "stangt", fragor, installningar: {}, tidsgransMin: 40, skapad: ts(3 * 864e5), oppnad: ts(3 * 864e5), stangd: ts(3 * 864e5 - 40 * 6e4),
    fokus: { pa: false, doljOvrigt: true }, rattStatus: { antal: 6, rattade: 2, tillbaka: 0 }, attRatta: true,
  });
  satt("provTillfallen/t-brak-4a", {
    provId: "p-brak", provNamn: "Bråk – diagnos", classId: "4a", createdBy: "stub-admin", createdByName: "Elias",
    status: "oppet", fragor, installningar: {}, tidsgransMin: null, skapad: ts(20 * 6e4), oppnad: ts(20 * 6e4), fokus: { pa: true, doljOvrigt: true },
  });
  satt("provTillfallen/t-vik-4a", {
    provId: "p-vikingar", provNamn: "Vikingatiden – avstämning", classId: "4a", createdBy: "stub-admin", createdByName: "Elias",
    status: "stangt", fragor, installningar: {}, tidsgransMin: 40, skapad: ts(9 * 864e5), oppnad: ts(9 * 864e5),
    fokus: { pa: false, doljOvrigt: true }, rattStatus: { antal: 7, rattade: 7, tillbaka: 7 }, attRatta: false,
  });
  satt("provTillfallen/t-omprov-5a", {
    provId: "p-vikingar", provNamn: "Vikingatiden – avstämning", classId: "5a", createdBy: "stub-admin", createdByName: "Elias",
    status: "stangt", fragor, installningar: {}, tidsgransMin: 40, skapad: ts(864e5), oppnad: ts(864e5), elevIds: ["stub-nils", "stub-olivia"],
    fokus: { pa: false, doljOvrigt: true }, rattStatus: { antal: 2, rattade: 0, tillbaka: 0 }, attRatta: true,
  });

  satt("liveSessions/l-4b", {
    name: "Klassmatch: 4B mot 4A", status: "live", gameMode: "quiz", participatingClassIds: ["4b", "4a"],
    createdBy: "stub-admin", createdByName: "Elias", createdAt: ts(5 * 6e4),
  });
}
