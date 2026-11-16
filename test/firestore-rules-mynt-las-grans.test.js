// ============================================================================
// Gränstest för myntlåset (#855, docs/SAKERHET-MYNT.md §6 B3), som
// firestore-rules-schack-uttryck-792.test.js: Firestore avbryter en regel efter
// 1000 utvärderade uttryck och en batch efter 20 dokumentåtkomster (get/
// exists/getAfter). En FULLT fylld elev (schack, drake, köpt avatar, stora
// listor, agdaDjur, största myntDag med alla källor och många gåvor) ska kunna
// tjäna mynt + xp – även ihop med schackskrivningar i SAMMA skrivning –
// hämta en gåva och svara rätt i Mattematchen (hela MM-batchen). Fusket nekas
// fortfarande i samma tillstånd. Varulåset (#856): samma fulla elev skriver alla
// varufält (möbler, djur, äpplen, frö, kläder, hus, lada) ihop med mynt + schack.
// Körs av `npm run test:rules`.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, writeBatch, increment, serverTimestamp, Timestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { MYNT_DAG_KVITTON, PER_DAG, XP_PER_DAG, myntDag, planTjana } from "../src/mynt-dag.js";
import { planMathAnswerWrites } from "../src/tavling/answer-writes.js";
import { defaultStudentData } from "../src/klass-membership.js";

let testEnv, elev;
const H = 3600 * 1000;
const IDAG = myntDag(Date.now());
const fv = { increment, serverTimestamp };
const ALLA = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

const GARD = range(30, (i) => `g${i}`);
const FULL = {
  ...defaultStudentData("hw-av-mumie"),
  coins: 4321, xp: 2500, appleCount: 12, husLast: false, avatarChosen: true, kcDonation: "4b/d0", husSkalId: "sak-7", lastFro: "mobel-0",
  floorApples: range(8, (i) => ({ id: `a${i}`, x: i, y: 80, room: i % 3 })),
  ownedItems: ["hw-av-mumie", ...range(300, (i) => `sak-${i}`)],
  ownedCounts: Object.fromEntries(range(100, (i) => [`mobel-${i}`, 3])),
  avatarItems: range(10, (i) => `sak-${i}`),
  pets: range(20, (i) => ({ id: `p${i}`, speciesId: "katt", feedCount: 9, name: `Djur ${i}`, x: i, y: i })),
  roomAnimals: range(30, (i) => ({ uid: `r${i}`, id: "fisk", x: i, y: i, room: i % 3 })),
  agdaDjur: Object.fromEntries([...GARD.map((u) => [u, "animal_horse"]), ...range(30, (i) => [`r${i}`, "fisk"]),
    ...range(20, (i) => [`p${i}`, "mystery-egg"])]),
  farm: {
    barnLevel: 3, gardenTier: 3, inventoryHarvest: { morot: 40, pumpa: 9 },
    barnSkin: "sak-8",
    gardenSlots: range(12, (i) => ({ crop: "morot", stage: i % 4 })), placedAnimals: [],
    animals: GARD.map((uid) => ({ uid, id: "animal_horse", lastGiftAt: 1 })),
  },
  progress: Object.fromEntries(range(40, (i) => [`omr${i}`, { quiz: { stars: 3, plays: 9, cat: { a: 1, b: 2 } }, match: { stars: 2 } }])),
  lasresa: { level: 7, level10: 70, totalTexts: 200, moneyEarned: 900, seenTextIds: range(200, (i) => `t${i}`) },
  brakdrake: { id: "d1", level: 3, name: "Glöd", stage: 1, pos: { x: 1, y: 2 }, room: 0, stowed: false },
  schack: {
    datorPartier: 7, aktivtParti: "p9",
    lektioner: Object.fromEntries(ALLA.map((k) => [k, 2])),
    pussel: { ett: { losta: 40, senast: 52 }, tva: { losta: 9, senast: 11 } },
  },
};
// Största myntDag: alla källor nära dagstaket, xp nära taket, 29 av 30 gåvor tagna.
const KVITTO = {
  dag: IDAG, kalla: "ovning", lastAt: Timestamp.fromMillis(Date.now() - H), senastMynt: 5, senastXp: 5,
  ovning: PER_DAG.ovning - 100, lasresa: PER_DAG.lasresa - 50, amnes: PER_DAG.amnes - 50, ekv: PER_DAG.ekv - 10,
  gard: 8 * 29, xp: XP_PER_DAG - 100, gardUid: GARD[28], gavor: Object.fromEntries(GARD.slice(0, 29).map((u) => [u, true])),
};

async function las(path) {
  let out;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), ...path));
    out = s.exists() ? s.data() : null;
  });
  return out;
}
const seed = (path, data) => testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), ...path), data));
const sd = () => doc(elev("full"), "studentData", "full");

async function tjana(kalla, mynt, { xp = 0, gardUid = null, extra = {} } = {}) {
  const p = planTjana({ kalla, mynt, xp, sd: await las(["studentData", "full"]), kvitto: await las(["studentData", "full", MYNT_DAG_KVITTON, IDAG]), gardUid });
  assert.ok(p.kvitto, "planen ska betala något");
  const db = elev("full");
  const b = writeBatch(db);
  b.set(doc(db, "studentData", "full", MYNT_DAG_KVITTON, IDAG), { ...p.kvitto, dag: IDAG, lastAt: serverTimestamp() }, { merge: true });
  b.update(doc(db, "studentData", "full"), { ...p.sd, ...extra });
  return b.commit();
}

before(async () => {
  ({ testEnv, elev } = await createRulesEnv("pluggportalen-rules-test-mynt-las-grans"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(["classes", "4b"], { name: "4B", studentIds: ["full"] });
  await seed(["students", "full"], { namn: "Full" });
  await seed(["studentData", "full"], FULL);
  await seed(["studentData", "full", MYNT_DAG_KVITTON, IDAG], KVITTO);
  await seed(["mathCompetitions", "mm1"], {
    name: "Mattematchen", participatingClassIds: ["4b"],
    startAt: Timestamp.fromMillis(Date.now() - H), endAt: Timestamp.fromMillis(Date.now() + H),
    status: "active", counterShards: 5, createdBy: "larare1", createdAt: Timestamp.fromMillis(Date.now() - 2 * H),
  });
});

describe("myntlåset (#855) med fullt tillstånd – inom 1000 uttryck och 20 åtkomster", () => {
  it("övning: mynt + xp, även ihop med schackskrivningar i samma skrivning", async () => {
    await assertSucceeds(tjana("ovning", 40, { xp: 30 }));
    await assertSucceeds(tjana("ovning", 1, { xp: 1, extra: { "schack.lektioner.12": 3, "schack.datorPartier": increment(1) } }));
    await assertSucceeds(tjana("ovning", 1, { xp: 1, extra: {
      "schack.pussel.ett.losta": increment(1), "schack.pussel.ett.senast": 53,
      "schack.lektioner.11": 3, "schack.lektioner.10": 3, "schack.lektioner.9": 3,
    } }));
    const d = await las(["studentData", "full"]);
    assert.deepEqual([d.coins, d.xp, d.schack.lektioner["12"], d.schack.pussel.ett.losta], [4321 + 42, 2532, 3, 41]);
  });
  it("schackens värsta fall (12 lektioner + båda pusslen + datorPartier) går igenom utan mynt", async () => {
    // Ihop med mynt i SAMMA skrivning når det värsta schackfallet + myntDag-
    // regeln taket på 1000 uttryck (nekas – ingen klient gör så: schacket
    // skriver aldrig mynt, mynten betalas av servern, functions/schack-mynt.js).
    const extra = { "schack.datorPartier": increment(1) };
    for (const k of ALLA) extra[`schack.lektioner.${k}`] = 3;
    for (const s of ["ett", "tva"]) {
      extra[`schack.pussel.${s}.losta`] = increment(1);
      extra[`schack.pussel.${s}.senast`] = FULL.schack.pussel[s].senast + 1;
    }
    await assertSucceeds(updateDoc(sd(), extra));
  });
  it("Läsresan, Ämnesläsning och Ekvationsresan (mynt utan xp)", async () => {
    await assertSucceeds(tjana("lasresa", 27));
    await assertSucceeds(tjana("amnes", 35));
    await assertSucceeds(tjana("ekv", 7));
    assert.equal((await las(["studentData", "full"])).coins, 4321 + 69);
  });
  it("gåvan för det 30:e ägda gårdsdjuret (läser agdaDjur via getAfter)", async () => {
    const extra = { "farm.animals": FULL.farm.animals.map((a) => (a.uid === GARD[29] ? { ...a, lastGiftAt: 2 } : a)) };
    await assertSucceeds(tjana("gard", 8, { gardUid: GARD[29], extra }));
    assert.equal((await las(["studentData", "full"])).coins, 4329);
  });
  it("Mattematchen: hela svarsbatchen med mynt går igenom", async () => {
    const db = elev("full");
    const b = writeBatch(db);
    const writes = planMathAnswerWrites({
      competitionId: "mm1", attemptId: `grans${Date.now().toString(36)}`, uid: "full", classId: "4b", name: "Full",
      record: { factorA: 7, factorB: 8, answer: 56, correctAnswer: 56 }, isCorrect: true, shard: 0, fv, mynt: { dag: IDAG },
    });
    for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
    await assertSucceeds(b.commit());
    assert.equal((await las(["studentData", "full"])).coins, 4322);
  });
  it("varufälten (#856) – möbler, djur, äpplen, frö, kläder, hus och lada – ihop med mynt + schack", async () => {
    // Allt eleven själv kan ändra bland varorna i EN skrivning, med en utbetalning
    // och schackskrivningar: varje varugren i elevVardeOk körs.
    const varor = {
      "room.placements.sak-1": { x: 1, y: 2 },
      roomAnimals: [...FULL.roomAnimals.map((a) => ({ ...a, x: a.x + 1 })), { uid: "hund", id: "hund", x: 1, y: 1 }],
      pets: FULL.pets.map((p) => ({ ...p, feedCount: p.feedCount + 1 })),
      "farm.animals": FULL.farm.animals.map((a) => ({ ...a, trivsel: 90 })),
      "farm.gardenSlots": [...FULL.farm.gardenSlots, { crop: "mobel-0", stage: 0 }],
      "farm.inventoryHarvest": { morot: 39, pumpa: 9 },
      "farm.barnSkin": "sak-9",
      "ownedCounts.mobel-0": 2,
      appleCount: 11, floorApples: [...FULL.floorApples.slice(1), { id: "a9", x: 1, y: 1 }, { id: "a10", x: 2, y: 2 }],
      avatarItems: range(10, (i) => `sak-${i + 20}`),
      husSkalId: "sak-11",
    };
    await assertSucceeds(tjana("ovning", 1, { xp: 1, extra: { ...varor, "schack.lektioner.12": 3, "schack.datorPartier": increment(1) } }));
    const d = await las(["studentData", "full"]);
    assert.deepEqual([d.coins, d.appleCount, d.ownedCounts["mobel-0"], d.husSkalId, d.farm.barnSkin], [4322, 11, 2, "sak-11", "sak-9"]);
    // Utan mynt, ihop med schackets värsta fall (alla lektioner + båda pusslen).
    const schack = { "schack.datorPartier": increment(1) };
    for (const k of ALLA) schack[`schack.lektioner.${k}`] = 3;
    for (const p of ["ett", "tva"]) {
      schack[`schack.pussel.${p}.losta`] = increment(1);
      schack[`schack.pussel.${p}.senast`] = FULL.schack.pussel[p].senast + 2;
    }
    await assertSucceeds(updateDoc(sd(), {
      ...schack, "ownedCounts.mobel-1": 2, lastFro: "mobel-1", appleCount: 10, floorApples: varor.floorApples.slice(1),
      avatarItems: range(10, (i) => `sak-${i + 30}`), husSkalId: "sak-12", "farm.barnSkin": null,
      pets: FULL.pets, roomAnimals: FULL.roomAnimals, "farm.animals": FULL.farm.animals,
    }));
    // Fusket bland varorna nekas i samma tillstånd, också bredvid en giltig utbetalning.
    await assertFails(tjana("ovning", 1, { xp: 1, extra: { ...varor, appleCount: 12 } }));
    await assertFails(tjana("ovning", 1, { xp: 1, extra: { "agdaDjur.dino": "dinosaurie" } }));
    await assertFails(updateDoc(sd(), { avatarItems: ["cape"] }));
    await assertFails(updateDoc(sd(), { "ownedCounts.mobel-2": 4, lastFro: "mobel-2" }));
    await assertFails(updateDoc(sd(), { "farm.barnLevel": 4 }));
  });
  it("orelaterade skrivningar och fusket i samma tillstånd", async () => {
    await assertSucceeds(updateDoc(sd(), { "progress.omr1.quiz.stars": 3, "roomAnimals": FULL.roomAnimals }));
    const hela = await las(["studentData", "full"]);
    await assertSucceeds(setDoc(sd(), { ...hela, husLast: true }), "hela dokumentet, samma saldo");
    await assertFails(updateDoc(sd(), { coins: increment(1) }));
    await assertFails(setDoc(sd(), { ...hela, coins: 99999 }));
    await assertFails(updateDoc(sd(), { xp: increment(1) }));
    await assertFails(tjana("ovning", 10, { extra: { coins: 99999 } }));
  });
});
