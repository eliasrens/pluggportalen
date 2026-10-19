// ============================================================================
// Schack 2A (#779): testrigg för serverkärnan (functions/schack-*.js) direkt
// mot Firestore-emulatorn med Admin SDK och STYRD klocka (ctl.clock = "serverns
// tid") och styrd slump (ctl.rng → färgen). Klassen sc-4a har tre elever
// (sc-anna, sc-bo, sc-cia) med schack påslaget; sc-5a (sc-dan) utan schack.
// Egna id-prefix (sc-) – krockar inte med andra tester i samma emulator.
// ============================================================================

import admin from "firebase-admin";

export const KLASS = "sc-4a";
export const KLASS_AV = "sc-5a";
export const KLASS_B = "sc-4b"; // Anna + Dan, schack på (F2: ett parti åt gången ÖVER klasser)
export const ANNA = "sc-anna";
export const BO = "sc-bo";
export const CIA = "sc-cia";
export const DAN = "sc-dan";
export const NAMN = { [ANNA]: "Anna", [BO]: "Bo", [CIA]: "Cia", [DAN]: "Dan" };

export function createScRig(name) {
  const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
  const app = admin.initializeApp({ projectId: PROJECT_ID }, `${name}-${process.pid}`);
  const db = app.firestore();
  const { FieldValue } = admin.firestore;
  const ctl = { clock: Date.parse("2026-10-18T10:00:00Z"), rng: 0.25, ids: 0 };
  const deps = {
    db, FieldValue,
    now: () => ctl.clock,
    rng: () => ctl.rng,
    randomId: () => `${name}-${++ctl.ids}`,
  };
  const tick = (ms) => { ctl.clock += ms; };

  const klass = async (classId = KLASS) => (await db.doc(`schackKlass/${classId}`).get()).data();
  const parti = async (id) => (await db.doc(`schackPartier/${id}`).get()).data();
  const aktivt = async (uid) => (await db.doc(`studentData/${uid}`).get()).data()?.schack?.aktivtParti ?? null;

  /** Grunddata: klasserna, projektionen med namn, läraren ak med sc-4a. */
  async function seed({ enabled = true, lock = null, hidden = false } = {}) {
    await db.doc(`classes/${KLASS}`).set({
      name: "4A", studentIds: [ANNA, BO, CIA],
      ...(enabled ? { enabledModules: ["schack"] } : {}),
      ...(hidden ? { hiddenModules: ["schack"] } : {}),
      ...(lock ? { lock } : {}),
    });
    await db.doc(`classes/${KLASS_AV}`).set({ name: "5A", studentIds: [DAN] });
    await db.doc(`classes/${KLASS_B}`).set({ name: "4B", studentIds: [ANNA, DAN], enabledModules: ["schack"] });
    await db.doc(`classProjections/${KLASS}`).set({ members: { [ANNA]: { namn: "Anna" }, [BO]: { namn: "Bo" } } });
    await db.doc(`students/${CIA}`).set({ namn: "Cia", classIds: [KLASS] });
    await db.doc("teacherAccounts/sc-ak").set({ role: "arskurs", classIds: [KLASS], active: true });
    await db.doc("teacherAccounts/sc-ak5").set({ role: "arskurs", classIds: [KLASS_AV], active: true });
  }

  async function rensa() {
    for (const coll of ["schackKlass", "schackPartier", "classes", "classProjections", "students", "teacherAccounts", "studentData"]) {
      const s = await db.collection(coll).get();
      await Promise.all(s.docs.filter((d) => d.id.startsWith("sc-") || d.id.startsWith(name)).map((d) => d.ref.delete()));
    }
  }

  /** Lärar-auth som index.js skickar till lärarkärnorna. */
  const auth = {
    admin: { uid: "sc-admin", token: { teacher: true, admin: true } },
    ak: { uid: "sc-ak", token: { teacher: true, role: "arskurs" } },
    ak5: { uid: "sc-ak5", token: { teacher: true, role: "arskurs" } },
    elev: { uid: ANNA, token: {} },
  };

  return { app, db, FieldValue, ctl, deps, tick, klass, parti, aktivt, seed, rensa, auth };
}

/** Felkoden ur ett löfte som ska avvisas med SchackFel – "ok" om det lyckades. */
export async function kod(p, Fel) {
  try {
    await p;
  } catch (e) {
    if (Fel && !(e instanceof Fel)) throw e;
    return e.code;
  }
  return "ok";
}
