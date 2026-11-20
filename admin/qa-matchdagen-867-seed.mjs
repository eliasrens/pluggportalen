// ============================================================================
// QA-seed för Matchdagen 1a (#867) – BARA mot emulatorn. Körs EFTER
// admin/qa-larkonton-seed.mjs + admin/qa-larkonton-roller-seed.mjs (klasser,
// qaadmin, qaarskurs4 = 4A + 4B, elever 4a01–4a04 = Alva, Bilal, Cleo, Dante)
// och lägger till två Räkna-områden (generator) i Matematik. Ingen elev har
// Matchdagen från början – läraren slår på den i Mina klasser → Elever →
// Anpassningar per elev. MD_PA=1 slår på den för Alva (4a01) direkt, med
// tabellerna 3 och 7. Lösenord lilla123 (emulator). Används av
// admin/qa-matchdagen-867-preview.sh.
// MD_TRUPP=1 (#871, kräver MD_PA=1): två omgångar spelade, 3 000 kr – köp och träningsläger direkt.
// MD_KVAL=1 (#870, kräver MD_PA=1): Alva har redan vunnit Division 6 – kvalmatchen
// till Division 5 väntar (karriären byggd med de riktiga, rena modulerna).
// MD_VANSKAP=1 (#874): Alva (4a01) OCH Bilal (4a02) har Matchdagen och var sin klubb – för
// vänskapsmatcherna (två webbläsare, admin/qa-matchdagen-874-preview.sh). Bilal: tabell 6 och Räkna: addition, klocka 30 s.
// ============================================================================

import { db, isEmulator } from "./_shared.mjs";

if (!isEmulator) {
  console.error("✗ Bara mot emulatorn (sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

const rakna = [
  ["md-addition", "Räkna: addition", { topic: "addition", variants: ["enkel", "uppstallning"] }],
  ["md-blandat", "Räkna: plus och minus", { topics: [{ topic: "addition", variants: ["enkel"] }, { topic: "subtraktion", variants: ["enkel"] }] }],
];
for (const [i, [id, name, generator]] of rakna.entries()) {
  await db.doc(`subjects/matte/areas/${id}`).set({ name, order: 50 + i, coverEmoji: "🔢", exerciseTypes: ["generator"], generator });
}
if (process.env.MD_PA === "1") {
  const alva = (await db.collection("students").where("username", "==", "4a01").get()).docs[0]?.id;
  if (alva) {
    await db.doc("classes/4a").update({ elevModuler: { [alva]: ["matchdagen"] } });
    await db.doc(`matchdagenInst/${alva}`).set({ omraden: [], tabeller: [3, 7], rakna: [], svarssatt: "flerval",
      klocka: 0, lugnt: false, paus: 60, updatedAt: new Date(), updatedBy: "qa-seed" });
    if (process.env.MD_KVAL === "1" || process.env.MD_TRUPP === "1") {
      const { matchKlar, nastaMatch, nyKarriar } = await import("../src/matchdagen/delat/md-sasong.js");
      const { skapaPrng } = await import("../src/matchdagen/delat/md-prng.js");
      const r = skapaPrng("qa-kval-870").tal;
      const stat = { skott: 6, skottPaMal: 4, pass: 14, passOk: 11, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
        fragor: 28, ratt: 21, perKalla: { "tabell:7": { fragor: 28, ratt: 21 } }, sekunder: 430 };
      let K = nyKarriar({ namn: "Alvas Blixtar", farg: "#2f6fe8", rng: r });
      // MD_TRUPP=1 (#871): två spelade omgångar (marknaden och lägret är öppna) och 3 000 kr i kassan.
      const omg = process.env.MD_TRUPP === "1" ? 2 : 99;
      for (let i = 0; i < omg && nastaMatch(K); i++) {
        K = matchKlar(K, { res: { oss: 3, dem: 1, utfall: "vinst", mal: [], stat }, rng: r, nu: Date.now() - (5 - i) * 86400000, matchId: `qa${i}` }).K;
      }
      if (process.env.MD_TRUPP === "1") K = { ...K, kassa: 3000 };
      // Marknaden sparas som rader "id|namn|pos|nr|st" (md-data.js, #871 F1).
      const { marknadTillDok } = await import("../src/matchdagen/delat/md-trupp.js");
      await db.doc(`matchdagen/${alva}`).set({ ...K, marknad: marknadTillDok(K.marknad), senast: new Date() });
    }
  }
}
if (process.env.MD_VANSKAP === "1") {
  const uid = async (u) => (await db.collection("students").where("username", "==", u).get()).docs[0]?.id;
  const [alva, bilal] = [await uid("4a01"), await uid("4a02")];
  const { nyKarriar } = await import("../src/matchdagen/delat/md-sasong.js");
  const { skapaPrng } = await import("../src/matchdagen/delat/md-prng.js");
  const { marknadTillDok } = await import("../src/matchdagen/delat/md-trupp.js");
  await db.doc("classes/4a").update({ elevModuler: { [alva]: ["matchdagen"], [bilal]: ["matchdagen"] } });
  const inst = { omraden: [], rakna: [], svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60, updatedAt: new Date(), updatedBy: "qa-seed" };
  await db.doc(`matchdagenInst/${alva}`).set({ ...inst, tabeller: [3, 7] });
  await db.doc(`matchdagenInst/${bilal}`).set({ ...inst, tabeller: [6], rakna: ["matte/md-addition"], klocka: 30 });
  for (const [u, namn, farg] of [[alva, "Alvas Blixtar", "#2f6fe8"], [bilal, "FC Bilal", "#e8473f"]]) {
    const K = nyKarriar({ namn, farg, rng: skapaPrng(`qa-874-${u}`).tal });
    await db.doc(`matchdagen/${u}`).set({ ...K, marknad: marknadTillDok(K.marknad), senast: new Date() });
  }
}
console.log(`✓ Matchdagen: Räkna-områden i Matematik${process.env.MD_PA === "1" ? ", Matchdagen på för Alva (4a01)" : ""}${process.env.MD_KVAL === "1" ? ", kvalet väntar" : ""}${process.env.MD_TRUPP === "1" ? ", två omgångar och 3 000 kr" : ""}${process.env.MD_VANSKAP === "1" ? ", Alva och Bilal med var sin klubb (vänskap)" : ""}.`);
process.exit(0);
