// ============================================================================
// Matchdagen 4 (#874): testrigg för vänskapsmatchernas serverkärna (functions/md-vanskap-*.js)
// direkt mot Firestore-emulatorn med Admin SDK, STYRD klocka (ctl.clock = serverns tid) och
// styrd slump (ctl.rng). Klassen mv-4a: mv-anna och mv-bo har Matchdagen (elevModuler), mv-cia
// inte. mv-5a: mv-dan med Matchdagen. Anna: tabell 7 (flerval); Bo: ett Plugga-område, klocka 30 s.
// Egna id-prefix (mv-) – krockar inte med andra tester i samma emulator.
// ============================================================================

import admin from "firebase-admin";

export const KLASS = "mv-4a";
export const KLASS_B = "mv-5a";
export const ANNA = "mv-anna";
export const BO = "mv-bo";
export const CIA = "mv-cia";
export const DAN = "mv-dan";
export const OMRADE = {
  name: "Vikingatiden",
  quiz: [
    { question: "Vad hette vikingarnas gud för åska?", options: ["Tor", "Oden", "Frej"], answerIndex: 0 },
    { question: "Vilket år brukar vikingatiden börja?", options: ["793", "1066", "1520"], answerIndex: 0 },
  ],
  pairs: [{ term: "runsten", definition: "en sten med runor" }, { term: "långskepp", definition: "vikingarnas stora skepp" }],
};
const trupp = (st = 2) => ["MV", "FÖR", "FÖR", "MIT", "MIT", "ANF", "ANF"].map((pos, i) => ({ id: `g${i + 1}`, namn: `Spelare ${i + 1}`, pos, nr: i + 1, st, xp: 0 }));
export const karriar = (namn, farg) => ({ version: 1, klubb: { namn, farg }, div: 0, sasong: 1, kassa: 600, trupp: trupp(), liga: {}, summa: {} });

export function createMvRig(name) {
  const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
  const app = admin.initializeApp({ projectId: PROJECT_ID }, `${name}-${process.pid}`);
  const db = app.firestore();
  const { FieldValue } = admin.firestore;
  const ctl = { clock: Date.parse("2026-11-20T09:00:00Z"), rng: 0.25, ids: 0 };
  const deps = { db, FieldValue, now: () => ctl.clock, rng: () => ctl.rng, randomId: () => `${name}-${++ctl.ids}` };
  const tick = (ms) => { ctl.clock += ms; };
  const las = async (p) => (await db.doc(p).get()).data() ?? null;

  async function seed({ lock = null } = {}) {
    await db.doc(`classes/${KLASS}`).set({
      name: "4A", studentIds: [ANNA, BO, CIA], elevModuler: { [ANNA]: ["matchdagen"], [BO]: ["matchdagen"] }, ...(lock ? { lock } : {}),
    });
    await db.doc(`classes/${KLASS_B}`).set({ name: "5A", studentIds: [DAN], elevModuler: { [DAN]: ["matchdagen"] } });
    await db.doc(`classProjections/${KLASS}`).set({ members: { [ANNA]: { namn: "Anna" }, [BO]: { namn: "Bo" }, [CIA]: { namn: "Cia" } } });
    await db.doc(`matchdagenInst/${ANNA}`).set({ tabeller: [7], svarssatt: "flerval" });
    await db.doc(`matchdagenInst/${BO}`).set({ omraden: ["mvso/vikingar"], klocka: 30 });
    await db.doc(`matchdagenInst/${DAN}`).set({ tabeller: [3] });
    await db.doc("subjects/mvso/areas/vikingar").set(OMRADE);
    await db.doc(`matchdagen/${ANNA}`).set(karriar("Blixtarna IF", "#e53935"));
    await db.doc(`matchdagen/${BO}`).set(karriar("FC Omar", "#1e88e5"));
    await db.doc(`matchdagen/${DAN}`).set(karriar("Dans BK", "#43a047"));
  }

  async function rensaColl(ref) {
    const s = await ref.get();
    for (const d of s.docs) {
      for (const sub of await d.ref.listCollections()) await rensaColl(sub);
      await d.ref.delete();
    }
  }
  async function rensa() {
    for (const coll of ["mdLobby", "mdVanskap", "mdVanskapElev", "classes", "classProjections", "matchdagenInst", "matchdagen"]) {
      const s = await db.collection(coll).get();
      for (const d of s.docs.filter((x) => x.id.startsWith("mv-") || x.id.startsWith(name))) {
        for (const sub of await d.ref.listCollections()) await rensaColl(sub);
        await d.ref.delete();
      }
    }
    await db.doc("subjects/mvso/areas/vikingar").delete();
  }

  return {
    app, db, FieldValue, ctl, deps, tick, las, seed, rensa,
    lobby: () => las(`mdLobby/${KLASS}`),
    match: (id) => las(`mdVanskap/${id}`),
    privat: (id, uid) => las(`mdVanskap/${id}/privat/${uid}`),
    facit: (id, uid) => las(`mdVanskap/${id}/facit/${uid}`),
    elev: (uid) => las(`mdVanskapElev/${uid}`),
    karriar: (uid) => las(`matchdagen/${uid}`),
    matchDok: (uid, id) => las(`matchdagen/${uid}/matcher/${id}`),
  };
}
