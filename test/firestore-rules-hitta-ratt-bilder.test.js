// ============================================================================
// Regel-tester: bilderna till lärarens egna pack i Hitta rätt! (#637, arkitektur §11.2/§11.8).
// ----------------------------------------------------------------------------
// hittaRattBilder/{packId}--{8 tecken}: inloggade läser, BARA lärare skapar –
// eget ownerUid, packId = id-prefixet, WebP/JPEG, Bytes ≤ 150 000, bredd/höjd
// heltal ≤ 800, skapad = serverns tid, inga andra fält. Ingen uppdatering
// (nytt id per bild). Bara ägaren raderar. Körs av `npm run test:rules`.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { Bytes, deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher, annanLarare;
const PACK = "e-k3f9q0z1m2xa";
const ID = `${PACK}--a8d0c2kq`;
const FINNS = `${PACK}--finns000`;

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-hitta-ratt-bilder"));
  annanLarare = () => testEnv.authenticatedContext("larare2", { teacher: true }).firestore();
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

const bytes = (n) => Bytes.fromUint8Array(new Uint8Array(n).fill(7));
const bild = (over = {}) => ({
  ownerUid: "larare1", packId: PACK, mime: "image/webp", bredd: 800, hojd: 533, data: bytes(55_000), skapad: serverTimestamp(), ...over,
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "hittaRattBilder", FINNS), { ...bild(), skapad: Timestamp.now() });
  });
});

describe("hittaRattBilder: läsning", () => {
  it("inloggade elever och lärare läser, utloggade inte", async () => {
    await assertSucceeds(getDoc(doc(elev("omar"), "hittaRattBilder", FINNS)));
    await assertSucceeds(getDoc(doc(annanLarare(), "hittaRattBilder", FINNS)));
    await assertFails(getDoc(doc(unauth(), "hittaRattBilder", FINNS)));
  });
});

describe("hittaRattBilder: skapa", () => {
  it("läraren skapar en egen bild (WebP och JPEG, upp till 150 000 byte, 800 px)", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "hittaRattBilder", ID), bild()));
    await assertSucceeds(setDoc(doc(teacher(), "hittaRattBilder", `${PACK}--jpeg0000`), bild({ mime: "image/jpeg", data: bytes(150_000), bredd: 533, hojd: 800 })));
  });

  it("elev och utloggad kan inte skapa", async () => {
    await assertFails(setDoc(doc(elev("omar"), "hittaRattBilder", ID), bild({ ownerUid: "omar" })));
    await assertFails(setDoc(doc(unauth(), "hittaRattBilder", ID), bild()));
  });

  it("fel ägare eller packId som inte matchar id:t nekas", async () => {
    await assertFails(setDoc(doc(teacher(), "hittaRattBilder", ID), bild({ ownerUid: "larare2" })));
    await assertFails(setDoc(doc(teacher(), "hittaRattBilder", ID), bild({ packId: "e-annatpack001" })));
  });

  it("ogiltigt id nekas (officiellt pack, versaler, fel längd)", async () => {
    for (const id of ["sverige-stader--a8d0c2kq", `${PACK}--A8D0C2KQ`, `${PACK}--a8d0c2k`, `${PACK}-a8d0c2kq`, PACK]) {
      await assertFails(setDoc(doc(teacher(), "hittaRattBilder", id), bild({ packId: id.split("--")[0] })));
    }
  });

  it("för stor, fel mime, fel typ på data och för stora mått nekas", async () => {
    const t = teacher();
    await assertFails(setDoc(doc(t, "hittaRattBilder", ID), bild({ data: bytes(150_001) })));
    for (const mime of ["image/png", "image/svg+xml", "text/html"]) await assertFails(setDoc(doc(t, "hittaRattBilder", ID), bild({ mime })));
    await assertFails(setDoc(doc(t, "hittaRattBilder", ID), bild({ data: "data:image/webp;base64,AAAA" })));
    await assertFails(setDoc(doc(t, "hittaRattBilder", ID), bild({ bredd: 801 })));
    await assertFails(setDoc(doc(t, "hittaRattBilder", ID), bild({ hojd: 1200 })));
    await assertFails(setDoc(doc(t, "hittaRattBilder", ID), bild({ bredd: 640.5 })));
    await assertFails(setDoc(doc(t, "hittaRattBilder", ID), bild({ bredd: 0 })));
  });

  it("extra fält eller klientens egen tid nekas", async () => {
    await assertFails(setDoc(doc(teacher(), "hittaRattBilder", ID), bild({ fotograf: "x" })));
    await assertFails(setDoc(doc(teacher(), "hittaRattBilder", ID), bild({ skapad: Timestamp.fromMillis(Date.now() - 60_000) })));
  });
});

describe("hittaRattBilder: uppdatera och radera", () => {
  it("ingen får uppdatera – inte ens ägaren", async () => {
    await assertFails(updateDoc(doc(teacher(), "hittaRattBilder", FINNS), { data: bytes(10) }));
    await assertFails(setDoc(doc(teacher(), "hittaRattBilder", FINNS), bild()));
  });

  it("bara ägaren raderar", async () => {
    await assertFails(deleteDoc(doc(elev("omar"), "hittaRattBilder", FINNS)));
    await assertFails(deleteDoc(doc(annanLarare(), "hittaRattBilder", FINNS)));
    await assertSucceeds(deleteDoc(doc(teacher(), "hittaRattBilder", FINNS)));
  });
});
