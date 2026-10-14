// ============================================================================
// Delad rigg för rolltesterna (#678, test/firestore-rules-roller-*.test.js).
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_LARARKONTON.md §7. Testanvändarna:
//   admin()   admin1  claims { teacher, admin }            allt
//   ak4()     ak4     claims { teacher, role:"arskurs" }   klasserna 4a, 4b
//   ak5()     ak5     claims { teacher, role:"arskurs" }   klassen 5a
//   gammal()  gammal  claims { teacher } (utan roll)       övergången = admin
//   ak4av()   ak4av   årskurskonto med active:false        nekas allt
// Klasser 4a/4b/5a/6a med en elev var (e4a, e4b, e5a, e6a). Varje elev har
// studentData (100 mynt, en påbörjad Läsresa – utom e4b som inte börjat) och
// sparade inloggningsuppgifter. Ämnet "so" har ett område utan createdBy
// (admins), ett av Årskurs 4 och ett av Årskurs 5.
// ============================================================================

import { doc, setDoc } from "firebase/firestore";
import { createRulesEnv } from "./rules-env.js";

export const ELEVER = { e4a: "4a", e4b: "4b", e5a: "5a", e6a: "6a" };

// En påbörjad Läsresa i sparad form (levelScale 10 → level10 + spegel).
export const LASRESA = {
  level: 4, level10: 7, pendingLevel: null, pendingLevel10: null, highStreak: 1, lowStreak: 0,
  worldId: "skogen", stepInWorld: 3, completedWorlds: [], totalTexts: 3, totalQuestions: 18,
  totalCorrect: 12, totalIncorrect: 6, moneyEarned: 36, seenTextIds: ["a", "b", "c"], catStats: {},
  currentTextId: null, lastTextId: "c", levelSetAt: null, levelSetBy: null,
};

/** Riggen + rollkontexterna. projectId unikt per testfil. */
export async function createRollerEnv(projectId) {
  const env = await createRulesEnv(projectId);
  const as = (uid, claims) => env.testEnv.authenticatedContext(uid, claims).firestore();
  return {
    ...env,
    as,
    admin: () => as("admin1", { teacher: true, admin: true }),
    ak4: () => as("ak4", { teacher: true, role: "arskurs" }),
    ak5: () => as("ak5", { teacher: true, role: "arskurs" }),
    gammal: () => as("gammal", { teacher: true }),
    ak4av: () => as("ak4av", { teacher: true, role: "arskurs" }),
    seed: (fn) => env.testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore())),
  };
}

/** Grunddata (anropas i beforeEach efter clearFirestore). */
export async function seedRoller(env) {
  await env.seed(async (db) => {
    const konto = (uid, role, classIds, active = true) =>
      setDoc(doc(db, "teacherAccounts", uid), { username: uid, displayName: uid, role, classIds, active });
    await konto("admin1", "admin", []);
    await konto("ak4", "arskurs", ["4a", "4b"]);
    await konto("ak5", "arskurs", ["5a"]);
    await konto("ak4av", "arskurs", ["4a", "4b"], false);
    for (const [uid, classId] of Object.entries(ELEVER)) {
      await setDoc(doc(db, "students", uid), { namn: uid, username: uid, classIds: [classId] });
      await setDoc(doc(db, "studentCredentials", uid), { username: uid, password: "hemlig1" });
      await setDoc(doc(db, "studentData", uid), {
        coins: 100, xp: 0, ...(uid === "e4b" ? {} : { lasresa: { ...LASRESA } }),
      });
    }
    for (const classId of new Set(Object.values(ELEVER))) {
      const studentIds = Object.keys(ELEVER).filter((u) => ELEVER[u] === classId);
      await setDoc(doc(db, "classes", classId), { name: classId.toUpperCase(), studentIds, assignedAreas: [] });
    }
    await setDoc(doc(db, "subjects", "so"), { name: "SO" });
    await setDoc(doc(db, "subjects", "so", "areas", "admin-omr"), { title: "Vikingatiden" });
    await setDoc(doc(db, "subjects", "so", "areas", "ak4-omr"), { title: "Medeltiden", createdBy: "ak4", createdByName: "Årskurs 4" });
    await setDoc(doc(db, "subjects", "so", "areas", "ak5-omr"), { title: "Stenåldern", createdBy: "ak5", createdByName: "Årskurs 5" });
  });
}
