// ============================================================================
// QA-seed för Matchdagen topplistan (#880, Tester) – BARA mot emulatorn. Körs efter
// admin/qa-matchdagen-867-preview.sh (4A: 4a01 Alva … 4a04 Dante). Lägger till 3A (7 elever, hela
// klassen på, delad 5:e plats), 6A (6 elever, en utan matcher, ett namn ur classProjections), i 4A
// en fuskare (Cleo) och en utan Matchdagen (Dante) – karriärerna byggda med de riktiga modulerna –
// och kör byggTopplista. Elever 3a01–3a07 / 6a01–6a06, lösenord lilla123.
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… node admin/qa-matchdagen-880-seed.mjs
// ============================================================================
import { auth, db, isEmulator, usernameToEmail } from "./_shared.mjs";
import { matchKlar, nyKarriar, nySasong, sasongFro, nastaMatch } from "../src/matchdagen/delat/md-sasong.js";
import { kvalKlar, kvalMatch } from "../src/matchdagen/delat/md-kval.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
import { LAGANTAL } from "../src/matchdagen/delat/md-config.js";
import { marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
if (!isEmulator) { console.error("emulator only"); process.exit(1); }

const stat = (fragor = 28, ratt = 20) => ({ skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor, ratt, perKalla: { "tabell:7": { fragor, ratt } }, sekunder: 420 });
const res = (oss, dem) => ({ oss, dem, utfall: "", mal: [], stat: stat() });
const NU = Date.now() - 86400000;

/** div = divisions to climb (fast path, all 6–0 wins), then extra = [[oss,dem],...] in current season. */
function karriar(seed, namn, farg, div, extra = []) {
  const r = skapaPrng(seed).tal;
  let k = nyKarriar({ namn, farg, rng: r });
  let nr = 0;
  for (let s = 0; s < div; s++) {
    for (let i = 0; i < LAGANTAL[k.div] - 1; i++) k = matchKlar(k, { res: res(6, 0), rng: r, nu: NU - nr * 60000, matchId: `${seed}m${nr++}` }).K;
    if (!kvalMatch(k)) throw new Error("no kval " + seed);
    k = kvalKlar(k, { res: res(2, 1), nu: NU, matchId: `${seed}k${s}` }).K;
    k = nySasong(k, skapaPrng(sasongFro(k, "u")).tal);
  }
  for (const [o, d] of extra) {
    if (!nastaMatch(k)) break;
    k = matchKlar(k, { res: res(o, d), rng: r, nu: NU, matchId: `${seed}x${nr++}` }).K;
  }
  return { ...k, marknad: marknadTillDok(k.marknad), senast: new Date() };
}

async function elev(cid, username, namn) {
  let u;
  try { u = await auth.getUserByEmail(usernameToEmail(username)); } catch { u = await auth.createUser({ email: usernameToEmail(username), password: "lilla123" }); }
  await db.doc(`students/${u.uid}`).set({ namn, username, avatarId: "fox", classIds: [cid] });
  await db.doc(`studentData/${u.uid}`).set({ progress: {}, avatarId: "fox", coins: 0 }, { merge: true });
  return u.uid;
}
const uidOf = async (u) => (await db.collection("students").where("username", "==", u).get()).docs[0].id;

// 3A: whole class on, 7 students; tie at the 5th place (3a05,3a06 identical), 3a07 below.
const tre = [];
const treNamn = ["Ali", "Bo", "Cia", "Dan", "Eli", "Fia", "Gus"];
for (const [i, n] of treNamn.entries()) tre.push(await elev("3a", `3a0${i + 1}`, n));
await db.doc("classes/3a").set({ name: "3A", studentIds: tre, enabledModules: ["matchdagen"] });
const W = (n) => Array.from({ length: n }, () => [2, 1]);
await db.doc(`matchdagen/${tre[0]}`).set(karriar("t3a", "Ali United", "#2f6fe8", 2));
await db.doc(`matchdagen/${tre[1]}`).set(karriar("t3b", "Bo Bollar", "#e8473f", 1, W(3)));
await db.doc(`matchdagen/${tre[2]}`).set(karriar("t3c", "Cia City", "#2fa84f", 1, W(1)));
await db.doc(`matchdagen/${tre[3]}`).set(karriar("t3d", "Dan FC", "#f2b632", 0, W(4)));
await db.doc(`matchdagen/${tre[4]}`).set(karriar("t3e", "Eli IF", "#8e44ad", 0, W(2)));
await db.doc(`matchdagen/${tre[5]}`).set(karriar("t3f", "Fia BK", "#16a085", 0, W(2)));
await db.doc(`matchdagen/${tre[6]}`).set(karriar("t3g", "Gus AIK", "#d35400", 0, W(1)));

// 4A (Alva..Dante) per-student on; Dante has a top career but Matchdagen OFF -> excluded.
const [alva, bilal, cleo, dante] = await Promise.all(["4a01", "4a02", "4a03", "4a04"].map(uidOf));
await db.doc("classes/4a").update({ elevModuler: { [alva]: ["matchdagen"], [bilal]: ["matchdagen"], [cleo]: ["matchdagen"] } });
await db.doc(`matchdagen/${alva}`).set(karriar("t4a", "Alvas Blixtar", "#2f6fe8", 0, [[3, 1], [0, 2], [1, 1]]));
await db.doc(`matchdagen/${bilal}`).set(karriar("t4b", "FC Bilal", "#e8473f", 1, W(2)));
// Cleo: cheater – Superligan with 10 matches written by hand.
const fusk = karriar("t4c", "Fusk FC", "#2fa84f", 0, W(5));
await db.doc(`matchdagen/${cleo}`).set({ ...fusk, div: 7, sasong: 8 });
await db.doc(`matchdagen/${dante}`).set(karriar("t4d", "Dante Dunder", "#f2b632", 3));

// 6A: whole class on, 6 students incl. one with a club but 0 matches; names via classProjections for some.
const sex = [];
for (const [i, n] of ["Hanna", "Ivar", "Jonna", "Kim", "Liv", "Max"].entries()) sex.push(await elev("6a", `6a0${i + 1}`, n));
await db.doc("classes/6a").set({ name: "6A", studentIds: sex, enabledModules: ["matchdagen"] });
await db.doc("classProjections/6a").set({ members: { [sex[0]]: { namn: "Hanna P" } } }, { merge: true });
await db.doc(`matchdagen/${sex[0]}`).set(karriar("t6a", "Hannas Hjältar", "#2f6fe8", 4));
await db.doc(`matchdagen/${sex[1]}`).set(karriar("t6b", "Ivar <b>X</b>", "#e8473f", 2, [[5, 0]]));
await db.doc(`matchdagen/${sex[2]}`).set(karriar("t6c", "Jonna J", "#2fa84f", 2, [[1, 0]]));
await db.doc(`matchdagen/${sex[3]}`).set(karriar("t6d", "Kim K", "#f2b632", 1));
await db.doc(`matchdagen/${sex[4]}`).set(karriar("t6e", "Liv L", "#8e44ad", 0, W(6)));
await db.doc(`matchdagen/${sex[5]}`).set(karriar("t6f", "Max Noll", "#16a085", 0));

await db.doc("mdTopplista/skolan").delete();
const { byggTopplista } = await import("../functions/md-topplista-bygg.js");
console.log(JSON.stringify(await byggTopplista({ db })));
const d = (await db.doc("mdTopplista/skolan").get()).data();
for (const [ak, rader] of Object.entries(d.arskurser)) {
  console.log(`Åk ${ak} (antal ${d.antal[ak]}):`);
  for (const r of rader) console.log(`  ${r.plats}. ${r.n} | ${r.lag} | ${r.k} | d${r.d} ls${r.ls} v${r.v} ${r.gm}-${r.im} m${r.m}`);
}
console.log("skip-run:", JSON.stringify(await byggTopplista({ db })));
process.exit(0);
