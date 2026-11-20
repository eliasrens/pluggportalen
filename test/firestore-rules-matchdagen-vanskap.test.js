// ============================================================================
// Regel-tester: Matchdagen 4 (#874) – vänskapsmatcherna (spec §11.5, §15 "Regler"):
//   • klienten skriver ingenting i duellsamlingarna (mdLobby, mdVanskap + privat/facit, mdVanskapElev)
//     – inte eleven, inte läraren, inte admin; allt går via callables
//   • spelarna läser matchdokumentet och sitt EGET privata dokument – aldrig motståndarens fråga,
//     aldrig facit; läraren med hasClass läser allt
//   • lobbyn läses bara av klassens elever som har Matchdagen (och läraren)
//   • matchdagen/{uid}.inbordes skrivs bara av servern: eleven kan inte skapa, ändra eller ta bort
//     det, men en sparning som lämnar det orört (match, nytt namn med hela dokumentet) går igenom
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { nyKarriar, matchKlar, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
import { marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const ID = "vanskap1";
const K0 = nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: skapaPrng("vanskap-regler").tal });
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const KLAR = matchKlar(K0, { res: { oss: 2, dem: 1, utfall: "vinst", mal: [{ min: 12, lag: "oss" }], stat: STAT },
  rng: skapaPrng("vanskap-regler-2").tal, nu: Date.UTC(2026, 10, 20, 9), matchId: "s1-d0-o1-x" });
const kopia = (v) => JSON.parse(JSON.stringify(v));
const dok = (K) => ({ ...kopia(K), marknad: marknadTillDok(K.marknad || []), pokaler: pokalerTillDok(K.pokaler || []) });
const INB = { kompis: { v: 2, o: 1, f: 0, namn: "FC Omar" } };
const KREF = (db, uid = "e4a") => doc(db, "matchdagen", uid);

const elev = (uid = "e4a") => env.as(uid, {});
const SPEL = {
  lobby: (db) => doc(db, "mdLobby", "4a"),
  match: (db) => doc(db, "mdVanskap", ID),
  privatEgen: (db) => doc(db, "mdVanskap", ID, "privat", "e4a"),
  privatKompis: (db) => doc(db, "mdVanskap", ID, "privat", "kompis"),
  facitEgen: (db) => doc(db, "mdVanskap", ID, "facit", "e4a"),
  facitKompis: (db) => doc(db, "mdVanskap", ID, "facit", "kompis"),
  elevEgen: (db) => doc(db, "mdVanskapElev", "e4a"),
};

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-874");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "kompis", "ingen"], elevModuler: { e4a: ["matchdagen"], kompis: ["matchdagen"] } }, { merge: true });
    await setDoc(SPEL.lobby(db), { utmaningar: { u1: { fran: "e4a", franNamn: "Anna", franLag: "Blixtarna IF", till: "kompis", sedan: 1 } }, matcher: {} });
    await setDoc(SPEL.match(db), { classId: "4a", a: "e4a", b: "kompis", spelare: ["e4a", "kompis"], status: "pagar", V: { stallning: { a: 0, b: 0 } }, fas: { nr: 1, start: 1 } });
    for (const uid of ["e4a", "kompis"]) {
      await setDoc(doc(db, "mdVanskap", ID, "privat", uid), { classId: "4a", sida: uid === "e4a" ? "a" : "b", fas: 1, fraga: { text: "7 × 3 = ?", typ: "skriv" }, svar: null });
      await setDoc(doc(db, "mdVanskap", ID, "facit", uid), { classId: "4a", sida: uid === "e4a" ? "a" : "b", bank: [{ pub: { text: "7 × 3 = ?" }, r: { s: "mult", facit: "21" } }] });
      await setDoc(doc(db, "mdVanskapElev", uid), { aktiv: ID, dag: "2026-11-20", antal: 0 });
    }
  });
});

describe("duellsamlingarna (#874, §11.5): klienten skriver ingenting", () => {
  it("eleven, kompisen, läraren med klassen och admin kan inte skapa, ändra eller ta bort något", async () => {
    for (const [vem, db] of [["e4a", elev()], ["kompis", elev("kompis")], ["ak4", env.ak4()], ["admin", env.admin()]]) {
      for (const [namn, r] of Object.entries(SPEL)) {
        await assertFails(setDoc(r(db), { classId: "4a", x: 1 }), `${vem} set ${namn}`);
        await assertFails(updateDoc(r(db), { x: 1 }), `${vem} update ${namn}`);
        await assertFails(deleteDoc(r(db)), `${vem} delete ${namn}`);
      }
      await assertFails(setDoc(doc(db, "mdVanskap", "ny"), { classId: "4a", a: "e4a", b: "kompis", spelare: ["e4a", "kompis"] }), `${vem} ny match`);
    }
  });
});

describe("läsningarna (#874, §11.5)", () => {
  it("spelaren läser matchdokumentet och sitt eget privata dokument – aldrig motståndarens fråga eller facit", async () => {
    await assertSucceeds(getDoc(SPEL.match(elev())));
    await assertSucceeds(getDoc(SPEL.privatEgen(elev())));
    await assertFails(getDoc(SPEL.privatKompis(elev())));
    await assertFails(getDoc(SPEL.facitEgen(elev())));
    await assertFails(getDoc(SPEL.facitKompis(elev())));
    await assertSucceeds(getDoc(SPEL.privatKompis(elev("kompis"))));
    await assertFails(getDoc(SPEL.privatEgen(elev("kompis"))));
    await assertSucceeds(getDoc(SPEL.elevEgen(elev())));
    await assertFails(getDoc(SPEL.elevEgen(elev("kompis"))));
  });
  it("en klasskamrat utan Matchdagen och elever i andra klasser läser varken match, frågor eller lobby", async () => {
    for (const db of [elev("ingen"), elev("e4b"), elev("e5a")]) {
      await assertFails(getDoc(SPEL.match(db)));
      await assertFails(getDoc(SPEL.privatEgen(db)));
      await assertFails(getDoc(SPEL.lobby(db)));
      await assertFails(getDoc(SPEL.elevEgen(db)));
    }
    await assertFails(getDoc(SPEL.match(env.testEnv.unauthenticatedContext().firestore())));
  });
  it("lobbyn: klassens elever med Matchdagen läser den", async () => {
    await assertSucceeds(getDoc(SPEL.lobby(elev())));
    await assertSucceeds(getDoc(SPEL.lobby(elev("kompis"))));
  });
  it("läraren med hasClass läser allt (lobby, match, båda frågorna, båda facit, spärren); utan klassen inget", async () => {
    for (const [namn, r] of Object.entries(SPEL)) {
      await assertSucceeds(getDoc(r(env.ak4())), `ak4 ${namn}`);
      await assertSucceeds(getDoc(r(env.admin())), `admin ${namn}`);
    }
    for (const [namn, r] of Object.entries(SPEL)) await assertFails(getDoc(r(env.ak5())), `ak5 ${namn}`);
  });
  it("en match som inte finns går att fråga efter (tomt svar) – ett gammalt id ger inget fel", async () => {
    await assertSucceeds(getDoc(doc(elev("e5a"), "mdVanskap", "finnsinte")));
  });
});

describe("matchdagen/{uid}.inbordes skrivs bara av servern (#874, §11.4)", () => {
  const medInb = (K, inbordes = INB) => ({ ...dok(K), inbordes, senast: serverTimestamp() });
  const seedK = (K, over = {}) => env.seed((db) => setDoc(KREF(db), { ...dok(K), senast: new Date(), ...over }));

  it("eleven kan inte skapa sin klubb med inbördes möten", async () => {
    await assertFails(setDoc(KREF(elev()), medInb(K0)));
    await assertSucceeds(setDoc(KREF(elev()), { ...dok(K0), senast: serverTimestamp() }));
  });
  it("eleven kan inte lägga till, ändra eller ta bort inbördes möten", async () => {
    await seedK(K0);
    await assertFails(updateDoc(KREF(elev()), { inbordes: INB, senast: serverTimestamp() }), "lägga till");
    await seedK(K0, { inbordes: INB });
    await assertFails(updateDoc(KREF(elev()), { "inbordes.kompis.v": 9, senast: serverTimestamp() }), "ändra");
    await assertFails(updateDoc(KREF(elev()), { "inbordes.ny": { v: 1, o: 0, f: 0 }, senast: serverTimestamp() }), "ny motståndare");
    await assertFails(setDoc(KREF(elev()), { ...dok(K0), senast: serverTimestamp() }), "ta bort (hela dokumentet utan inbordes)");
  });
  it("en sparning som lämnar inbördes orörda går igenom: matchen (mergeFields) och hela dokumentet (nytt namn)", async () => {
    await seedK(K0, { inbordes: INB });
    const data = { ...dok(KLAR.K), senast: serverTimestamp() };
    delete data.klubb;
    await assertSucceeds(setDoc(KREF(elev()), data, { mergeFields: Object.keys(data) }));
    await assertSucceeds(setDoc(KREF(elev()), medInb({ ...KLAR.K, klubb: { ...KLAR.K.klubb, namn: "Nya Namnet IF" } })));
  });
  it("läraren rör fortfarande bara lagnamnet – inte de inbördes mötena", async () => {
    await seedK(K0, { inbordes: INB });
    await assertFails(updateDoc(KREF(env.ak4()), { "inbordes.kompis.v": 0 }));
    await assertSucceeds(updateDoc(KREF(env.ak4()), { "klubb.namn": "Pluggporten FC" }));
  });
});
