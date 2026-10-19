// Schack slut-QA Etapp 2 (#782), steget "kvot" – se qa.mjs. Klientens Firestore-läsningar/
// -skrivningar per användare (räknande proxy per origin, QA_RAKNA=1) för ett parti med 80
// halvdrag och klocka spelat i UI:t (två spelare + lärarens åskådarläge), lobbyn med många
// öppna sidor, att lyssnarna stängs och att inget skrivs/läses per sekund.
// Serverns del: admin/qa-schack-2/kvot-server.mjs.
import { Chess } from "../../src/schack/vendor/chess.js";
import { db, vila, parti, anvandare, loggaInElev, loggaInLarare, tillLobby, drag, bradeHar } from "./lib.mjs";
import { farger, vantaMed, spelaMot, callFran, nollaKlass } from "./spel.mjs";

const kort = (r) => `läs ${r.summaLasningar} (${Object.entries(r.lasningar).map(([k, v]) => `${k}: ${v}`).join(", ") || "–"}), skriv ${r.summaSkrivningar}`;
const las = (r, monster) => Object.entries(r.lasningar).filter(([k]) => k.startsWith(monster)).reduce((a, [, v]) => a + v, 0);

/** Nästa drag: slumpat lagligt drag som inte avslutar partiet (även trefaldig upprepning) och inte är en förvandling. */
function nastaDrag(ch, slump) {
  const kandidater = ch.moves({ verbose: true }).filter((d) => {
    if (d.promotion) return false;
    const c = new Chess();
    for (const s of ch.history()) c.move(s);
    c.move(d);
    return !c.isGameOver();
  });
  return kandidater[Math.floor(slump() * kandidater.length)];
}

export default async function kvot({ br, PORTAR, BILDER, ok }) {
  const [PA, PB, PT] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB), T = await anvandare(br, PT);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await nollaKlass();
  await loggaInLarare(T);

  // --- ett parti med 40 drag per spelare och klocka ----------------------------------
  await vantaMed(A, "10");
  const id = await spelaMot(B, A);
  const { vit, svart } = await farger(id, A, B);
  await T.vanta(`!!document.querySelector("[data-titta]")`, 15000);
  await T.klick("[data-titta]");
  await T.vanta(`document.querySelectorAll(".sl-ask .schack-bradet [data-ruta]").length === 64`);
  await vila(3000); // lobbylyssnaren stängs 2 s efter att partiet öppnats
  for (const u of [A, B, T]) await u.rakna(true);
  const ch = new Chess();
  let seed = 11;
  const slump = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
  const t0 = Date.now();
  for (let i = 0; i < 80; i++) {
    const d = nastaDrag(ch, slump);
    const u = ch.turn() === "w" ? vit : svart;
    await bradeHar(u, i); // spelarens bräde har motståndarens senaste drag
    const pt = await drag(u, id, d.from, d.to);
    if (pt.status !== "pagar") throw new Error("partiet tog slut i förtid");
    ch.move(d);
  }
  await bradeHar(vit, 80); await bradeHar(svart, 80); await bradeHar(T, 80, ".sl-ask");
  await vila(1500);
  const sek = ((Date.now() - t0) / 1000).toFixed(0);
  const [ra, rb, rt] = [await A.rakna(), await B.rakna(), await T.rakna()];
  ok(`80 halvdrag i UI:t (${sek} s): vit ${vit.anv}`, true, kort(vit === A ? ra : rb));
  ok(`80 halvdrag: svart ${svart.anv}`, true, kort(svart === A ? ra : rb));
  ok("80 halvdrag: läraren (åskådare)", true, kort(rt));
  ok("spelarnas lyssnare: 80 läsningar var på partiet (1 per halvdrag), 0 på klassdokumentet",
    las(ra, "schackPartier") === 80 && las(rb, "schackPartier") === 80 && las(ra, "schackKlass") === 0 && las(rb, "schackKlass") === 0,
    `A ${las(ra, "schackPartier")}/${las(ra, "schackKlass")}, B ${las(rb, "schackPartier")}/${las(rb, "schackKlass")}`);
  ok("åskådaren: 80 läsningar på partiet", las(rt, "schackPartier") === 80, String(las(rt, "schackPartier")));
  ok("inga klientskrivningar i Firestore under partiet (allt via callables)", ra.summaSkrivningar + rb.summaSkrivningar + rt.summaSkrivningar === 0);

  // inget per sekund: 20 s utan drag med klockan igång
  for (const u of [A, B, T]) await u.rakna(true);
  const fore = await parti(id);
  await vila(20_000);
  const tyst = [await A.rakna(), await B.rakna(), await T.rakna()];
  const efter = await parti(id);
  ok("20 s med klockan igång: 0 läsningar och 0 skrivningar hos A, B och läraren",
    tyst.every((r) => r.summaLasningar === 0 && r.summaSkrivningar === 0), tyst.map(kort).join(" · "));
  ok("…och partidokumentet orört (ingen skrivning per sekund på servern)", efter.uppdaterad === fore.uppdaterad);
  ok("klockan räknas ned lokalt ändå", /\d:\d\d/.test(await (vit === A ? A : B).text(".schack-kompis .schack-klocka.aktiv")),
    await (ch.turn() === "w" ? vit : svart).text(".schack-kompis .schack-klocka.aktiv"));

  // slut (ge upp i UI:t) – klassdoc skrivs en gång
  for (const u of [A, B, T]) await u.rakna(true);
  await A.klick('[data-act="geupp"]');
  await A.klick('[data-act="geupp-ja"]');
  await vila(3000);
  const slut = [await A.rakna(), await B.rakna(), await T.rakna()];
  ok("partislut: läsningar i klienterna", true, slut.map(kort).join(" · "));

  // lyssnarna stängs när man lämnar
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await vantaMed(A, "");
  const id2 = await spelaMot(B, A, id);
  await T.vanta(`!!document.querySelector('[data-titta="${id2}"]')`, 15000).catch(() => {});
  if (await T.finns("[data-tillbaka]")) await T.klick("[data-tillbaka]");
  await T.vanta(`!!document.querySelector('[data-titta="${id2}"]')`, 15000);
  await T.klick(`[data-titta="${id2}"]`);
  await T.vanta(`document.querySelectorAll(".sl-ask .schack-bradet [data-ruta]").length === 64`);
  await A.ev(`location.hash = "#/elev/hem"`);
  await T.ev(`location.hash = "#/larare/klasser?klass=4a&sektion=fokus"`);
  await vila(3000);
  for (const u of [A, B, T]) await u.rakna(true);
  for (let i = 0; i < 3; i++) {
    await db.doc(`schackPartier/${id2}`).update({ uppdaterad: Date.now() });
    await db.doc("schackKlass/4a").update({ qaPing: i });
    await vila(1200);
  }
  const [la, lb, lt] = [await A.rakna(), await B.rakna(), await T.rakna()];
  ok("A lämnade schacksidan: 0 läsningar på partiet och klassdokumentet vid 3+3 ändringar",
    las(la, "schackPartier") + las(la, "schackKlass") === 0, kort(la));
  ok("läraren lämnade sektionen: 0 läsningar", las(lt, "schackPartier") + las(lt, "schackKlass") === 0, kort(lt));
  ok("kontroll: B (kvar i partiet) fick 3 läsningar på partiet, 0 på klassdokumentet", las(lb, "schackPartier") === 3 && las(lb, "schackKlass") === 0, kort(lb));
  await callFran(B, "schackGeUpp", { partiId: id2 });
  await db.doc("schackKlass/4a").update({ qaPing: null });

}
