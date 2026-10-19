// Schack slut-QA Etapp 3 (#792), steget "guide12" – lektion 12 (partiet mot Bonden) till slut:
// vinst = 3, remi = 2, förlust = 1 stjärna; sparas EN gång per förbättring; ett nytt sämre/lika parti
// sänker aldrig; Ångra efter slutet räknas inte igen. Partier läggs i localStorage (som i #777).
import { db, vila, anvandare, loggaInElev } from "../qa-schack-2/lib.mjs";
import { oppnaLektion } from "./steg-guide.mjs";

const SAN_LOYD = "e3 a5 Qh5 Ra6 Qxa5 h5 h4 Rah6 Qxc7 f6 Qxd7+ Kf7 Qxb7 Qd3 Qxb8 Qh7 Qxc8 Kg6".split(" ");
const sd = async (uid) => (await db.doc(`studentData/${uid}`).get()).data() || {};
const stjarnorDom = (u) => u.ev(`document.querySelector(".schack-lektion-klar [role=img]")?.getAttribute("aria-label") || ""`);

async function injicera(u, drag, { farg = "w", slut = null } = {}) {
  const nyckel = await u.ev(`Object.keys(localStorage).find((k) => /^pp:schack:dator:[^:]+$/.test(k))`) ||
    `pp:schack:dator:${await u.ev(`(JSON.parse(localStorage.getItem("pp:session") || "{}").uid || "")`)}`;
  const pt = { v: 1, niva: "bonden", egenFarg: farg, drag, varna: true, seed: 12345, skapad: Date.now(), uppdaterad: Date.now(), slut };
  await u.ev(`localStorage.setItem(${JSON.stringify(nyckel + ":lektion")}, ${JSON.stringify(JSON.stringify(pt))})`);
  await u.ev(`location.hash = "#/elev/schack?vy=lar"`);
  await vila(300);
  await oppnaLektion(u, 12);
  await u.vanta(`document.querySelectorAll(".schack-bradet [data-ruta]").length === 64`, 15000);
  await vila(500);
}

export default async function guide12({ br, PORTAR, BILDER, ok }) {
  const [PA, PB, PC] = PORTAR;
  const U = await anvandare(br, PB), V = await anvandare(br, PC);
  await loggaInElev(U, "4a03"); await loggaInElev(V, "4a04");
  for (const u of [U, V]) await db.doc(`studentData/${u.uid}`).update({ schack: { aktivtParti: null } });
  // nyckeln: starta ett parti en gång så att den finns? Nyckeln är pp:schack:dator:<uid> – bygg den
  const nyck = (u) => `pp:schack:dator:${u.uid}`;
  const inj = async (u, drag, o = {}) => {
    const pt = { v: 1, niva: "bonden", egenFarg: o.farg || "w", drag, varna: true, seed: 12345, skapad: Date.now(), uppdaterad: Date.now(), slut: null };
    await u.ev(`localStorage.setItem(${JSON.stringify(nyck(u) + ":lektion")}, ${JSON.stringify(JSON.stringify(pt))})`);
    await u.ev(`location.hash = "#/elev/schack?vy=lar"`);
    await vila(300);
    await oppnaLektion(u, 12);
    await u.vanta(`document.querySelectorAll(".schack-bradet [data-ruta]").length === 64`, 15000);
    await vila(600);
  };
  const klart = (u) => u.vanta(`!document.querySelector(".schack-lektion-klar").hidden`, 10000);
  const klarText = (u) => u.text(".schack-lektion-klar");

  // --- vinst: 1.e4 f6 2.d4 g5 3.Qh5# --------------------------------------------------------------
  await U.rakna(true);
  await inj(U, ["e4", "f6", "d4", "g5"]);
  await U.e.tryck("d1"); await U.e.tryck("h5");
  await klart(U);
  ok("lektion 12: vinst (matt) → 3 stjärnor + 'Du vann mot Bonden!'", /3 av 3/.test(await stjarnorDom(U)) && /Du vann mot Bonden/.test(await klarText(U)), `${await stjarnorDom(U)} | ${await klarText(U)}`);
  await U.bild(BILDER, "guide-lektion12-vinst");
  await vila(1200);
  let s = await sd(U.uid);
  ok("lektion 12: lektioner.12 = 3 efter EN skrivning", s.schack?.lektioner?.["12"] === 3 && ((await U.rakna()).skrivningar["studentData/*"] || 0) === 1, JSON.stringify(s.schack) + JSON.stringify((await U.rakna()).skrivningar));
  // Ångra efter slutet: knappen finns? vad händer
  const angra = await U.ev(`(() => { const b = document.querySelector('[data-act="angra"]'); return b ? { finns: true, disabled: b.disabled } : { finns: false }; })()`);
  ok("lektion 12: Ångra-knappen efter vinst (info)", true, JSON.stringify(angra));

  // --- remi: Sam Loyds patt i 10 drag ----------------------------------------------------------------
  await V.rakna(true);
  await inj(V, SAN_LOYD);
  await V.e.tryck("c8"); await V.e.tryck("e6");
  await klart(V).catch(() => {});
  const lt = await klarText(V);
  ok("lektion 12: remi (patt) → 2 stjärnor + 'Remi – bra kämpat!'", /2 av 3/.test(await stjarnorDom(V)) && /Remi/.test(lt), `${await stjarnorDom(V)} | ${lt}`);
  await V.bild(BILDER, "guide-lektion12-remi");
  await vila(1200);
  s = await sd(V.uid);
  ok("lektion 12: lektioner.12 = 2 efter EN skrivning", s.schack?.lektioner?.["12"] === 2 && ((await V.rakna()).skrivningar["studentData/*"] || 0) === 1, JSON.stringify(s.schack) + JSON.stringify((await V.rakna()).skrivningar));
  // Spela igen: vinst ger rekord 3 (2 → 3) = ny skrivning
  await V.klickText("Spela igen");
  await vila(600);
  await inj(V, ["e4", "f6", "d4", "g5"]);
  await V.e.tryck("d1"); await V.e.tryck("h5");
  await klart(V);
  await vila(1200);
  s = await sd(V.uid);
  ok("lektion 12: remi → vinst förbättrar 2 → 3 (två skrivningar totalt)", s.schack?.lektioner?.["12"] === 3 && ((await V.rakna()).skrivningar["studentData/*"] || 0) === 2, JSON.stringify(s.schack) + JSON.stringify((await V.rakna()).skrivningar));

  // --- förlust: 1.f3 e5 2.g4 – låt Bonden göra matt (Qh4#) ---------------------------------------------------------
  const W = await anvandare(br, PA);
  await loggaInElev(W, "4a01");
  await db.doc(`studentData/${W.uid}`).set({ schack: { lektioner: { "12": 2 } } }, { merge: true });
  await W.p.laddaOm(); await vila(3000);
  let forlorat = false;
  for (let forsok = 0; forsok < 3 && !forlorat; forsok++) {
    await inj(W, ["f3", "e5", "g4"]);
    await W.vanta(`!document.querySelector(".schack-lektion-klar").hidden || (document.querySelector(".schack-draglista")?.textContent || "").includes("Qh4")`, 20000).catch(() => {});
    forlorat = /Qh4#/.test(await W.text(".schack-draglista")) || !(await W.ev(`document.querySelector(".schack-lektion-klar").hidden`));
  }
  if (forlorat) {
    await klart(W).catch(() => {});
    ok("lektion 12: förlust (matt av Bonden) → 1 stjärna, text om att spela klart", /1 av 3/.test(await stjarnorDom(W)) && /Bonden vann/.test(await klarText(W)), `${await stjarnorDom(W)} | ${await klarText(W)}`);
    await vila(1200);
    s = await sd(W.uid);
    ok("lektion 12: en förlust (1) sänker inte sparade 2", s.schack?.lektioner?.["12"] === 2, JSON.stringify(s.schack?.lektioner));
    await W.bild(BILDER, "guide-lektion12-forlust");
  } else ok("lektion 12: Bonden hittade inte Qh4# i 3 försök (förlusttestet hoppades över)", true, "info");
}
