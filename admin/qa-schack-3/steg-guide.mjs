// Schack slut-QA Etapp 3 (#792), steget "guide" – se qa.mjs. Alla 12 lektioner i riktiga appen:
// klaras med riktiga mus-/tryckhändelser, stjärnor efter antal drag, felsvar, EN skrivning per
// förbättring, framstegen kvar efter omladdning, inga mynt.
import { Chess } from "../../src/schack/vendor/chess.js";
import { LEKTIONER, stjarnorEfterDrag, minFor } from "../../src/schack/schack-lektioner.js";
import { db, vila, anvandare, loggaInElev, uidFor } from "../qa-schack-2/lib.mjs";
import { lös, lösMedOmväg } from "./jakt.mjs";

const TITLAR = ["Brädet", "Tornet", "Löparen", "Damen", "Kungen", "Springaren", "Bonden", "Ta pjäser", "Schack", "Schack matt och patt", "Specialdragen", "Ditt första parti"];
const sd = async (uid) => (await db.doc(`studentData/${uid}`).get()).data() || {};
const stjarnorDom = (u) => u.ev(`document.querySelector(".schack-lektion-klar [role=img]")?.getAttribute("aria-label") || ""`);
const skriv = async (u) => (await u.rakna()).skrivningar || {};
const sumSkriv = (o) => Object.entries(o).filter(([k]) => k.startsWith("studentData")).reduce((a, [, v]) => a + v, 0);

export async function oppnaLektion(u, nr) {
  await u.ev(`location.hash = "#/elev/schack?vy=lar&lektion=${nr}"`);
  await u.vanta(`!!document.querySelector(".schack-lektion") && document.querySelectorAll(".schack-bradet [data-ruta]").length === 64 || !!document.querySelector(".schack-lektion-yta .schack-dator-vy, .schack-lektion-parti .schack-bradet")`, 20000);
  await vila(250);
}
const raknare = (u) => u.text(".schack-lektion-raknare");
const svar = (u) => u.text(".schack-lektion-svar");
const klarSynlig = (u) => u.ev(`(() => { const e = document.querySelector(".schack-lektion-klar"); return !!e && !e.hidden && e.getClientRects().length > 0; })()`);
const klarText = (u) => u.text(".schack-lektion-klar");

/** Spela jaktväg: tryck på pjäsen, sedan på målrutan, för varje drag. */
async function spelaVag(u, fran, vag) {
  let pos = fran;
  for (const t of vag) { await u.e.tryck(pos); await u.e.tryck(t); pos = t; }
}

/** Klara en jakt-lektion (2–8) med givna vägar per uppgift. Returnerar antal drag. */
async function jaktLektion(u, l, { omvag = false, ok, namn }) {
  let totalt = 0;
  for (let i = 0; i < l.uppgifter.length; i++) {
    const up = l.uppgifter[i];
    const mig = lös(up);
    ok(`${namn}: egen BFS ger samma minsta antal som lektionens min (uppgift ${i + 1})`, mig.min === up.min, `egen ${mig.min}, app ${up.min}`);
    let vag = mig.vag;
    if (omvag && i === 0) { const o = lösMedOmväg(up); if (o) vag = o.vag; }
    await spelaVag(u, up.fran, vag);
    totalt += vag.length;
    if (i < l.uppgifter.length - 1) {
      await u.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000);
      ok(`${namn}: uppgift ${i + 1} klar visar "Alla tagna" + Nästa uppgift, Börja om dold`, /Alla tagna/.test(await svar(u)) && !(await u.ev(`getComputedStyle(document.querySelector('[data-act="om"]')).display !== "none" && !document.querySelector('[data-act="om"]').hidden`)), await svar(u));
      await u.klick('[data-act="nasta"]');
      await vila(150);
    }
  }
  return totalt;
}

export default async function guide({ br, PORTAR, BILDER, ok }) {
  const [PA, PB] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  for (const u of [A, B]) await db.doc(`studentData/${u.uid}`).update({ schack: { aktivtParti: null } });
  const coins0 = (await sd(A.uid)).coins ?? null;
  const mynt0 = JSON.stringify(Object.fromEntries(Object.entries(await sd(A.uid)).filter(([k]) => /coin|mynt|pluggmynt|rewards/i.test(k))));

  // --- startsidan + översikten ---------------------------------------------------------
  await A.ev(`location.hash = "#/elev/schack"`);
  await A.vanta(`!!document.querySelector(".schack-sida")`, 20000);
  const start = await A.ev(`document.body.innerText`);
  ok("schacksidan har kort för Lär dig schack och Pussel", /Lär dig schack/.test(start) && /Pussel/i.test(start), start.slice(0, 200).replace(/\s+/g, " "));
  await A.bild(BILDER, "guide-start");
  await A.ev(`location.hash = "#/elev/schack?vy=lar"`);
  await A.vanta(`document.querySelectorAll(".schack-lektion-kort").length === 12`, 15000);
  const namn = await A.ev(`[...document.querySelectorAll(".schack-lektion-namn")].map((e) => e.firstChild.nextSibling?.textContent ?? e.textContent)`);
  const titlar = await A.ev(`[...document.querySelectorAll(".schack-lektion-namn")].map((e) => e.textContent.replace(/^Lektion \\d+: /, "").replace(/(Börja här|Fortsätt här)$/, "").trim())`);
  ok("översikten: 12 lektioner i spec-ordningen (§12)", JSON.stringify(titlar) === JSON.stringify(TITLAR), JSON.stringify(titlar));
  ok("översikten: ingen lektion är låst (alla öppna) och 0 av 36 stjärnor", /0 av 36/.test(await A.text(".schack-guide-summa")) && !(await A.ev(`!!document.querySelector(".schack-lektion-kort[disabled]")`)), await A.text(".schack-guide-summa"));
  ok("översikten: Börja här på lektion 1", /Börja här/.test(await A.text(".schack-lektion-kort.nasta")));
  await A.bild(BILDER, "guide-oversikt");

  // --- lektion 1: frågorna --------------------------------------------------------------
  let w = await skriv(A);
  await A.rakna(true);
  await oppnaLektion(A, 1);
  const l1 = LEKTIONER[0];
  // ett fel tryck på första frågan
  await A.e.tryck("a1");
  ok("lektion 1: fel ruta ger 'Prova igen' och räknas som ett tryck", /Prova igen/.test(await svar(A)) && /Tryck: 1/.test(await raknare(A)), `${await svar(A)} | ${await raknare(A)}`);
  for (const [i, f] of l1.uppgifter.entries()) await A.e.tryck(f.svar[0]);
  await A.vanta(`!document.querySelector(".schack-lektion-klar").hidden`, 5000);
  const lk1 = await klarText(A);
  // 8 tryck, min 7: tolerans 2 -> 2 stjärnor
  ok("lektion 1: 7 rätt + 1 fel = 8 tryck → 2 stjärnor (min 7, tolerans 2)", /2 av 3/.test(await stjarnorDom(A)) && /8 drag|8 /.test(lk1), `${await stjarnorDom(A)} | ${lk1}`);
  await A.bild(BILDER, "guide-lektion1-klar");
  await vila(1200);
  let s = await sd(A.uid);
  ok("lektion 1: studentData.schack.lektioner.1 = 2 efter EN skrivning", s.schack?.lektioner?.["1"] === 2 && sumSkriv((await A.rakna()).skrivningar) === 1, `${JSON.stringify(s.schack)} skriv ${JSON.stringify((await A.rakna()).skrivningar)}`);

  // gör om lektionen utan fel → 3 stjärnor, rekord, EN ny skrivning
  await A.klickText("Gör om lektionen");
  await vila(300);
  for (const f of l1.uppgifter) await A.e.tryck(f.svar[0]);
  await A.vanta(`!document.querySelector(".schack-lektion-klar").hidden`, 5000);
  ok("lektion 1: 7 rätt på 7 tryck → 3 stjärnor + Nytt rekord", /3 av 3/.test(await stjarnorDom(A)) && /Nytt rekord/.test(await klarText(A)), await klarText(A));
  await vila(1200);
  s = await sd(A.uid);
  ok("lektion 1: sparat 3; två skrivningar totalt (2 → 3)", s.schack?.lektioner?.["1"] === 3 && sumSkriv((await A.rakna()).skrivningar) === 2, JSON.stringify((await A.rakna()).skrivningar));
  // sämre resultat sänker aldrig
  await A.klickText("Gör om lektionen");
  await vila(300);
  for (const f of l1.uppgifter) { await A.e.tryck("h1"); await A.e.tryck("h1"); await A.e.tryck("h1"); await A.e.tryck(f.svar[0]); }
  await A.vanta(`!document.querySelector(".schack-lektion-klar").hidden`, 5000);
  ok("lektion 1: 28 tryck → 1 stjärna, inget 'Nytt rekord'", /1 av 3/.test(await stjarnorDom(A)) && !/Nytt rekord/.test(await klarText(A)), `${await stjarnorDom(A)} ${await klarText(A)}`);
  await vila(1200);
  s = await sd(A.uid);
  ok("lektion 1: sparade 3 sänks aldrig (ingen skrivning)", s.schack?.lektioner?.["1"] === 3 && sumSkriv((await A.rakna()).skrivningar) === 2, JSON.stringify(s.schack?.lektioner));

  // --- lektion 2–8: jakterna -----------------------------------------------------------
  const sparat = { 1: 3 };
  for (const l of LEKTIONER.filter((x) => x.typ === "jakt")) {
    await oppnaLektion(A, l.nr);
    ok(`lektion ${l.nr}: texten ${l.titel} stämmer (intro i panelen)`, (await A.text(".schack-lektion-intro")).startsWith(l.intro.slice(0, 40)), (await A.text(".schack-lektion-intro")).slice(0, 80));
    const antal = await jaktLektion(A, l, { ok, namn: `lektion ${l.nr}` });
    await A.vanta(`!document.querySelector(".schack-lektion-klar").hidden`, 5000);
    const min = minFor(l);
    ok(`lektion ${l.nr} ${l.titel}: ${antal} drag (min ${min}) → 3 stjärnor`, antal === min && /3 av 3/.test(await stjarnorDom(A)) && /minsta möjliga/.test(await klarText(A)), `${await stjarnorDom(A)} | ${await klarText(A)}`);
    sparat[l.nr] = 3;
    if (l.nr === 2) await A.bild(BILDER, "guide-lektion2-klar");
  }
  // omväg: stjärnor efter antal drag (2 / 1)
  for (const l of [LEKTIONER[1], LEKTIONER[2]]) {
    await oppnaLektion(B, l.nr);
    const o = lösMedOmväg(l.uppgifter[0]);
    // Endast uppgift 1 får omvägen; resten minsta
    let totalt = 0;
    for (let i = 0; i < l.uppgifter.length; i++) {
      const up = l.uppgifter[i];
      const vag = i === 0 ? o.vag : lös(up).vag;
      await spelaVag(B, up.fran, vag);
      totalt += vag.length;
      if (i < l.uppgifter.length - 1) { await B.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000); await B.klick('[data-act="nasta"]'); await vila(150); }
    }
    await B.vanta(`!document.querySelector(".schack-lektion-klar").hidden`, 5000);
    const fv = stjarnorEfterDrag(totalt, minFor(l));
    const dom = await stjarnorDom(B);
    ok(`lektion ${l.nr}: omväg, ${totalt} drag mot min ${minFor(l)} → ${fv} stjärnor i UI:t`, dom.startsWith(String(fv)) && !/minsta möjliga/.test(await klarText(B)), `${dom} | ${await klarText(B)}`);
  }

  // --- börja om i jakt ------------------------------------------------------------------
  await oppnaLektion(A, 2);
  await A.e.tryck("a1"); await A.e.tryck("a5");
  ok("lektion 2: Börja om nollställer dragen", /Drag: 1/.test(await raknare(A)));
  await A.klick('[data-act="om"]');
  await vila(200);
  ok("lektion 2: efter Börja om visas Drag: 0, 3 kvar", /Drag: 0/.test(await raknare(A)) && /3 kvar/.test(await raknare(A)), await raknare(A));

  // --- lektion 9–11: ställningar ---------------------------------------------------------
  const lagligt = (fen) => new Chess(fen).moves({ verbose: true });
  const sq = (m) => [m.from, m.to];
  const gor = async (u, from, to, promo) => {
    await u.e.tryck(from); await u.e.tryck(to);
    if (promo) { await u.vanta(`!!document.querySelector(".schack-forvandling")`, 3000); await u.e.klick(`.schack-forvandling [data-pjas="${promo}"]`); }
    await vila(250);
  };
  const piece = (u, r) => u.e.etikett(r);
  for (const l of LEKTIONER.filter((x) => x.typ === "stallning")) {
    await oppnaLektion(A, l.nr);
    let drag = 0;
    for (let i = 0; i < l.uppgifter.length; i++) {
      const up = l.uppgifter[i];
      const c = new Chess(up.fen);
      const alla = c.moves({ verbose: true });
      const bra = alla.filter((m) => {
        const t = new Chess(up.fen); const r = t.move(m);
        return ({ kung: () => m.piece === "k", ta: () => !!m.captured, emellan: () => m.piece !== "k" && !m.captured, matt: () => t.isCheckmate(),
          rockad: () => /[kq]/.test(m.flags), enpassant: () => m.flags.includes("e"), forvandling: () => m.flags.includes("p") })[up.krav]();
      });
      const fel = alla.filter((m) => !bra.includes(m));
      const patt = alla.filter((m) => { const t = new Chess(up.fen); t.move(m); return t.isStalemate(); });
      ok(`lektion ${l.nr}.${i + 1} (${up.krav}): finns minst ett rätt drag (${bra.map((m) => m.san).join(",")})`, bra.length > 0);
      if (fel.length) {
        const f = (up.krav === "matt" && patt[0]) || fel[0];
        await gor(A, f.from, f.to, f.promotion);
        drag++;
        const sv = await svar(A);
        const kvar = await piece(A, f.from);
        const till = await piece(A, f.to);
        ok(`lektion ${l.nr}.${i + 1}: fel drag ${f.san} hoppar tillbaka med förklaring`, sv.length > 5 && /Prova|prova|inte|Oj|Kungen är räddad|Flytta|Det var/.test(sv) && !/Rätt!/.test(sv) && !/tomt/i.test(kvar),
          `${sv} | ${f.from}:${kvar} ${f.to}:${till}`);
        if (up.krav === "matt" && patt[0]) ok(`lektion ${l.nr}.${i + 1}: patt får egen text`, /patt/i.test(sv), sv);
      }
      const r = bra[0];
      await gor(A, r.from, r.to, r.promotion);
      drag++;
      const sv2 = await svar(A);
      ok(`lektion ${l.nr}.${i + 1}: rätt drag ${r.san} → "Rätt"/matt-text`, /Rätt|Schack matt/.test(sv2), sv2);
      if (i < l.uppgifter.length - 1) { await A.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000); await A.klick('[data-act="nasta"]'); await vila(200); }
    }
    await A.vanta(`!document.querySelector(".schack-lektion-klar").hidden`, 5000);
    const fv = stjarnorEfterDrag(drag, minFor(l));
    ok(`lektion ${l.nr} ${l.titel}: ${drag} drag (min ${minFor(l)}) → ${fv} stjärnor`, (await stjarnorDom(A)).startsWith(String(fv)), `${await stjarnorDom(A)} | ${await klarText(A)}`);
    sparat[l.nr] = fv;
    if (l.nr === 9) await A.bild(BILDER, "guide-lektion9-klar");
  }

  // --- lektion 12: partiet mot Bonden ---------------------------------------------------------
  await oppnaLektion(A, 12);
  await A.vanta(`document.querySelectorAll(".schack-bradet [data-ruta]").length === 64`, 15000);
  await A.bild(BILDER, "guide-lektion12-start");
  const t12 = await A.ev(`document.body.innerText`);
  ok("lektion 12: bara Bondens parti – ingen nivåval, texten stämmer §12 (Ditt första parti mot Bonden)", /Ditt första parti/.test(t12) && /Bonden/.test(t12) && !/Nivå|Välj nivå|Välj färg/.test(t12), t12.slice(0, 160).replace(/\s+/g, " "));
  ok("lektion 12: Varna mig finns (mot datorn)", /Varna/.test(t12));
  // spela första draget och se att Bonden svarar
  await A.e.tryck("e2"); await A.e.tryck("e4");
  await A.vanta(`(document.querySelector(".schack-draglista")?.textContent || "").trim().split(/\\s+/).filter((t) => t && !/^\\d+\\./.test(t)).length >= 2`, 15000);
  ok("lektion 12: Bonden svarar på 1.e4", true, await A.text(".schack-draglista"));
  // lämna lektionen, fortsätt det sparade partiet
  await A.ev(`location.hash = "#/elev/schack?vy=lar"`);
  await A.vanta(`document.querySelectorAll(".schack-lektion-kort").length === 12`, 10000);
  await oppnaLektion(A, 12);
  await A.vanta(`document.querySelectorAll(".schack-bradet [data-ruta]").length === 64`, 15000);
  await vila(500);
  ok("lektion 12: partiet sparas och fortsätter vid återbesök (2 halvdrag kvar)", (await A.text(".schack-draglista")).includes("e4"), await A.text(".schack-draglista"));
  // ge upp → inte klarad, inga stjärnor sparas
  await A.klickText("Ge upp").catch(async () => A.klick('[data-act="geupp"]'));
  await vila(300);
  if (await A.finns('[data-act="geupp-ja"]')) await A.klick('[data-act="geupp-ja"]');
  await A.vanta(`!document.querySelector(".schack-lektion-klar").hidden`, 8000);
  ok("lektion 12: att ge upp = 'Inte klarad', inga stjärnor", /Inte klarad/.test(await klarText(A)) && (await stjarnorDom(A)) === "", await klarText(A));
  await vila(1000);
  s = await sd(A.uid);
  ok("lektion 12: ingen stjärna sparad efter att ha gett upp", !s.schack?.lektioner?.["12"], JSON.stringify(s.schack?.lektioner));
  await A.bild(BILDER, "guide-lektion12-gav-upp");

  // --- sparat och kvar efter omladdning ------------------------------------------------------------
  await vila(800);
  s = await sd(A.uid);
  const fa = s.schack?.lektioner || {};
  const vantat = Object.fromEntries(Object.entries(sparat).map(([k, v]) => [k, v]));
  ok("studentData.schack.lektioner = förväntade stjärnor (1–11)", JSON.stringify(Object.keys(vantat).sort()) === JSON.stringify(Object.keys(fa).sort()) && Object.entries(vantat).every(([k, v]) => fa[k] === v), `facit ${JSON.stringify(fa)} förväntat ${JSON.stringify(vantat)}`);
  const w2 = (await A.rakna()).skrivningar;
  ok("skrivningar: en per FÖRBÄTTRAD lektion (11 lektioner + rekordet i lektion 1 = 12)", sumSkriv(w2) === 12, JSON.stringify(w2));
  await A.laddaOmFull?.();
  await A.p.laddaOm();
  await A.vanta(`!!document.querySelector(".schack-sida, .schack-lektion")`, 20000);
  await A.ev(`location.hash = "#/elev/schack?vy=lar"`);
  await A.vanta(`document.querySelectorAll(".schack-lektion-kort").length === 12`, 15000);
  const stjDom = await A.ev(`[...document.querySelectorAll(".schack-lektion-kort")].map((k) => +((k.querySelector("[role=img]")?.getAttribute("aria-label") || "").match(/^(\\d)/)?.[1] || 0))`);
  ok("efter omladdning visar översikten samma stjärnor", stjDom.every((v, i) => v === (fa[String(i + 1)] || 0)), JSON.stringify(stjDom));
  ok("översikten: summa stämmer", (await A.text(".schack-guide-summa")).includes(`${Object.values(fa).reduce((a, b) => a + b, 0)} av 36`), await A.text(".schack-guide-summa"));
  await A.bild(BILDER, "guide-oversikt-efter");

  // --- inga mynt -----------------------------------------------------------------------------------------
  const sdSlut = await sd(A.uid);
  const mynt1 = JSON.stringify(Object.fromEntries(Object.entries(sdSlut).filter(([k]) => /coin|mynt|pluggmynt|rewards/i.test(k))));
  ok("inga mynt: coin-/mynt-fält i studentData oförändrade efter hela guiden", mynt1 === mynt0 && (sdSlut.coins ?? null) === coins0, `${mynt0} → ${mynt1}`);
  const klientCoin = await A.ev(`(async () => { const t = document.body.innerText; return /mynt|🪙|belöning/i.test(t); })()`);
  ok("inga mynt: ingen mynt-/belöningstext i guidens översikt", !klientCoin);
}
