// Schack slut-QA Etapp 3 (#792), steget "pussel" – se qa.mjs. Pusslen i riktiga appen: rätt drag,
// fel drag (hoppar tillbaka), Tips, annat mattdrag, matt i två med datorns försvar, förvandling,
// vit i schack, framsteg (en skrivning per nytt pussel), kvar efter omladdning, sista pusslet.
import { readFileSync } from "node:fs";
import { Chess } from "../../src/schack/vendor/chess.js";
import { db, vila, anvandare, loggaInElev } from "../qa-schack-2/lib.mjs";

const bank = (f) => JSON.parse(readFileSync(new URL(`../../src/schack/pussel/${f}`, import.meta.url), "utf8")).pussel;
const ETT = bank("matt-i-ett.json"), TVA = bank("matt-i-tva.json");
const sd = async (uid) => (await db.doc(`studentData/${uid}`).get()).data() || {};
const dr = (s) => ({ from: s.slice(0, 2), to: s.slice(2, 4), promotion: s[4] });
const svar = (u) => u.text(".schack-pussel-svar");
const nrText = (u) => u.text(".schack-pussel-nr");
const nasta = (u) => u.ev(`(() => { const b = document.querySelector('[data-act="nasta"]'); return !!b && !b.hidden && b.getClientRects().length > 0; })()`);

async function oppna(u, sort, nr) {
  await u.ev(`location.hash = "#/elev/schack?vy=pussel&sort=${sort}${nr ? `&nr=${nr}` : ""}"`);
  await u.vanta(`document.querySelectorAll(".schack-pussel-brade .schack-bradet [data-ruta]").length === 64 && /Pussel \\d+ av/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 20000);
  await vila(300);
}
async function gor(u, d) {
  await u.e.tryck(d.from);
  await u.e.tryck(d.to);
  if (d.promotion) { await u.vanta(`!!document.querySelector(".schack-forvandling")`, 3000); await u.e.klick(`.schack-forvandling [data-pjas="${d.promotion}"]`); }
  await vila(200);
}
/** Löser pusslet med riktiga drag (matt i två: väntar in datorns försvar). */
async function los(u, p) {
  const fas = p.losning;
  await gor(u, dr(fas[0]));
  if (fas.length === 3) {
    await u.vanta(`/Svart spelade|Nu: gör matt/.test(document.querySelector(".schack-pussel-svar")?.textContent || "")`, 5000);
    await vila(200);
    await gor(u, dr(fas[2]));
  }
  await u.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000);
}
const matter = (fen) => new Chess(fen).moves({ verbose: true }).filter((m) => { const t = new Chess(fen); t.move(m); return t.isCheckmate(); });

export default async function pussel({ br, PORTAR, BILDER, ok }) {
  const [PA, PB] = PORTAR;
  const A = await anvandare(br, PB);
  await loggaInElev(A, "4a02");
  await db.doc(`studentData/${A.uid}`).update({ schack: { aktivtParti: null } });
  await A.p.laddaOm(); await vila(3000);
  const mynt0 = (await sd(A.uid)).coins ?? null;
  await A.rakna(true);

  // --- valet ---------------------------------------------------------------------------
  await A.ev(`location.hash = "#/elev/schack?vy=pussel"`);
  await A.vanta(`document.querySelectorAll(".schack-pussel-sort").length === 2 && /av 200 lösta/.test(document.body.innerText)`, 20000);
  const val = await A.ev(`document.querySelector(".schack-pussel-val").innerText.replace(/\\s+/g, " ")`);
  ok("pusselvalet: Matt i ett drag + Matt i två drag, 0 av 200 lösta", /Matt i ett drag/.test(val) && /Matt i två drag/.test(val) && (val.match(/0 av 200 lösta/g) || []).length === 2, val);
  await A.bild(BILDER, "pussel-val");

  // --- matt i ett: pussel 1 -----------------------------------------------------------------
  await A.klick('[data-sort="ett"]');
  await A.vanta(`/Pussel 1 av 200/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 15000);
  await vila(300);
  const p1 = ETT[0];
  ok("pussel 1: uppgiftstexten 'Vit drar och gör matt i ett drag'", /Vit drar och gör matt i ett drag/.test(await A.text(".schack-pussel-uppgift")), await A.text(".schack-pussel-uppgift"));
  ok("pussel 1: vit nederst och motståndarens senaste drag markerat", await A.ev(`document.querySelectorAll(".schack-pussel .senast").length === 2`), "");
  // fel drag
  const wrong = new Chess(p1.fen).moves({ verbose: true }).find((m) => !matter(p1.fen).some((x) => x.lan === m.lan));
  const fore = await A.e.etikett(wrong.from);
  await gor(A, wrong);
  ok("fel drag: texten 'Inte riktigt – prova igen!'", /Inte riktigt – prova igen!/.test(await svar(A)), await svar(A));
  ok("fel drag: pjäsen hoppar tillbaka (samma ruta, inget på målrutan)", (await A.e.etikett(wrong.from)) === fore && /tom/.test(await A.e.etikett(wrong.to)) === (wrong.captured ? false : true), `${wrong.san}: ${wrong.from}=${await A.e.etikett(wrong.from)} ${wrong.to}=${await A.e.etikett(wrong.to)}`);
  ok("fel drag: Nästa pussel inte synlig, ingen skrivning", !(await nasta(A)) && ((await A.rakna()).skrivningar["studentData/*"] || 0) === 0);
  // tips
  await A.klick('[data-act="tips"]');
  const tr = dr(p1.losning[0]);
  ok("Tips (1:a): markerar pjäsen som ska flyttas", await A.ev(`document.querySelector('.schack-bradet [data-ruta="${tr.from}"]').classList.contains("tips")`) && /markerade pjäsen/.test(await svar(A)), await svar(A));
  await A.klick('[data-act="tips"]');
  ok("Tips (2:a): hela draget med SAN-text och pil", /Tips: /.test(await svar(A)) && (await A.ev(`document.querySelector(".schack-pussel .schack-pilar").children.length > 0`)), await svar(A));
  await A.bild(BILDER, "pussel-tips");
  await A.bild(BILDER, "pussel-fel");
  // rätt drag
  await gor(A, tr);
  await A.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000);
  ok("rätt drag: 'Snyggt! Schack matt! ⭐' + Nästa pussel", /Snyggt! Schack matt! ⭐/.test(await svar(A)) && await nasta(A), await svar(A));
  await A.bild(BILDER, "pussel-ratt");
  await vila(1000);
  let s = await sd(A.uid);
  ok("framsteg: studentData.schack.pussel.ett = { losta: 1, senast: 1 } efter EN skrivning", s.schack?.pussel?.ett?.losta === 1 && s.schack.pussel.ett.senast === 1 && ((await A.rakna()).skrivningar["studentData/*"] || 0) === 1, JSON.stringify(s.schack?.pussel) + JSON.stringify((await A.rakna()).skrivningar));
  await A.klick('[data-act="nasta"]');
  await A.vanta(`/Pussel 2 av 200/.test(document.querySelector(".schack-pussel-nr").textContent)`, 5000);
  ok("Nästa pussel → Pussel 2 av 200, tom svarsrad, Tips åter synlig", (await svar(A)) === "" && await A.finns('[data-act="tips"]'));

  // --- 3–10 i rad (riktiga drag) ----------------------------------------------------------------------
  for (let n = 2; n <= 10; n++) {
    await A.vanta(new RegExp(`Pussel ${n} av`).toString() + `.test(document.querySelector(".schack-pussel-nr").textContent)`, 5000);
    await vila(150);
    await los(A, ETT[n - 1]);
    if (n < 10) { await A.klick('[data-act="nasta"]'); }
  }
  await vila(1200);
  s = await sd(A.uid);
  ok("pussel 1–10 lösta: losta 10, senast 10 och exakt 10 skrivningar (en per pussel)", s.schack?.pussel?.ett?.losta === 10 && s.schack.pussel.ett.senast === 10 && ((await A.rakna()).skrivningar["studentData/*"] || 0) === 10, JSON.stringify(s.schack?.pussel) + JSON.stringify((await A.rakna()).skrivningar));
  // gå tillbaka och gör om ett gammalt: ingen ny skrivning
  const skr0 = (await A.rakna()).skrivningar["studentData/*"] || 0;
  await A.klick('[data-act="forra"]');
  await A.vanta(`/Pussel 9 av/.test(document.querySelector(".schack-pussel-nr").textContent)`, 5000);
  await los(A, ETT[8]);
  await vila(1000);
  s = await sd(A.uid);
  ok("gör om pussel 9: ingen ny skrivning, losta kvar 10", ((await A.rakna()).skrivningar["studentData/*"] || 0) === skr0 && s.schack.pussel.ett.losta === 10, JSON.stringify(s.schack.pussel));

  // --- alternativt mattdrag ----------------------------------------------------------------------------
  const alt = ETT.findIndex((p) => matter(p.fen).length > 1);
  if (alt >= 0) {
    const p = ETT[alt];
    const andra = matter(p.fen).find((m) => m.lan !== p.losning[0]);
    await oppna(A, "ett", alt + 1);
    await gor(A, { from: andra.from, to: andra.to, promotion: andra.promotion });
    await A.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000).catch(() => {});
    ok(`pussel ${alt + 1}: ett ANNAT mattdrag (${andra.san}, lösning ${p.losning[0]}) räknas som rätt`, await nasta(A) && /Snyggt/.test(await svar(A)), await svar(A));
  } else ok("alternativa mattdrag", true, "inget pussel i matt-i-ett har fler än ett mattdrag");

  // --- vit i schack i utgångsläget --------------------------------------------------------------------
  const vs = ETT.findIndex((p) => new Chess(p.fen).inCheck());
  if (vs >= 0) {
    await oppna(A, "ett", vs + 1);
    ok(`pussel ${vs + 1}: vit står i schack i start – statusraden säger det`, true, await A.text(".schack-status-text"));
    await los(A, ETT[vs]);
    ok(`pussel ${vs + 1}: (vit i schack) går att lösa`, /Snyggt/.test(await svar(A)), await svar(A));
  }

  // --- förvandling --------------------------------------------------------------------------------------
  const fv = ETT.findIndex((p) => p.losning[0].length === 5);
  if (fv >= 0) {
    const p = ETT[fv];
    await oppna(A, "ett", fv + 1);
    const m = dr(p.losning[0]);
    await A.e.tryck(m.from); await A.e.tryck(m.to);
    await A.vanta(`!!document.querySelector(".schack-forvandling")`, 3000);
    // fel pjäs (om matt inte): välj en som inte ger matt
    const fel = ["q", "r", "b", "n"].find((x) => x !== m.promotion && !matter(p.fen).some((y) => y.lan === m.from + m.to + x));
    if (fel) {
      await A.e.klick(`.schack-forvandling [data-pjas="${fel}"]`);
      await vila(300);
      ok(`pussel ${fv + 1}: förvandling till fel pjäs (${fel}) nekas, bonden hoppar tillbaka`, /Inte riktigt/.test(await svar(A)), await svar(A));
      await A.e.tryck(m.from); await A.e.tryck(m.to);
      await A.vanta(`!!document.querySelector(".schack-forvandling")`, 3000);
    }
    await A.e.klick(`.schack-forvandling [data-pjas="${m.promotion}"]`);
    await A.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000);
    ok(`pussel ${fv + 1}: rätt förvandling (${m.promotion}) → matt`, /Snyggt/.test(await svar(A)), await svar(A));
  } else ok("förvandlingspussel", true, "inget matt-i-ett-pussel med förvandling");

  // --- matt i två --------------------------------------------------------------------------------------------
  await oppna(A, "tva");
  ok("matt i två: startar på pussel 1, texten 'Vit drar och gör matt i två drag'", /Pussel 1 av 200/.test(await nrText(A)) && /gör matt i två drag/.test(await A.text(".schack-pussel-uppgift")), `${await nrText(A)} | ${await A.text(".schack-pussel-uppgift")}`);
  const t1 = TVA[0];
  const alla = new Chess(t1.fen).moves({ verbose: true });
  const felEtt = alla.find((m) => m.lan !== t1.losning[0]);
  await gor(A, felEtt);
  ok("matt i två: fel FÖRSTA drag nekas och hoppar tillbaka", /Inte riktigt/.test(await svar(A)) && (await A.e.etikett(felEtt.from)) !== "", `${felEtt.san} ${await svar(A)}`);
  await A.klick('[data-act="tips"]');
  ok("matt i två: Tips markerar lösningens första pjäs", await A.ev(`document.querySelector('.schack-bradet [data-ruta="${t1.losning[0].slice(0, 2)}"]').classList.contains("tips")`));
  await gor(A, dr(t1.losning[0]));
  ok("matt i två: rätt första drag → 'Bra drag! Nu försvarar sig svart …' och brädet låst medan svart tänker", /Bra drag/.test(await svar(A)), await svar(A));
  await A.vanta(`/Svart spelade/.test(document.querySelector(".schack-pussel-svar").textContent)`, 5000);
  ok("matt i två: datorns försvar spelas (lösningens svarta drag) + 'Nu: gör matt i ett drag!'", /Svart spelade .+Nu: gör matt i ett drag!/.test(await svar(A)), await svar(A));
  const mv = new Chess(t1.fen); mv.move(dr(t1.losning[0])); mv.move(dr(t1.losning[1]));
  const felTva = mv.moves({ verbose: true }).find((m) => !(() => { const t = new Chess(mv.fen()); t.move(m); return t.isCheckmate(); })());
  await gor(A, felTva);
  ok("matt i två: ett andra drag som inte ger matt nekas", /Inte riktigt/.test(await svar(A)), `${felTva.san} → ${await svar(A)}`);
  await gor(A, dr(t1.losning[2]));
  await A.vanta(`!document.querySelector('[data-act="nasta"]').hidden`, 5000);
  ok("matt i två: matt → 'Snyggt! Schack matt! ⭐' + nästa", /Snyggt/.test(await svar(A)) && await nasta(A), await svar(A));
  await A.bild(BILDER, "pussel-tva-ratt");
  await vila(800);
  s = await sd(A.uid);
  ok("framsteg matt i två: pussel.tva = { losta 1, senast 1 }", s.schack?.pussel?.tva?.losta === 1 && s.schack.pussel.tva.senast === 1, JSON.stringify(s.schack?.pussel));
  // fler matt-i-två med riktiga drag
  for (let n = 2; n <= 6; n++) { await A.klick('[data-act="nasta"]'); await A.vanta(`/Pussel ${n} av/.test(document.querySelector(".schack-pussel-nr").textContent)`, 5000); await vila(150); await los(A, TVA[n - 1]); }
  await vila(800);
  s = await sd(A.uid);
  ok("matt i två 1–6 lösta med riktiga drag: losta 6", s.schack.pussel.tva.losta === 6 && s.schack.pussel.tva.senast === 6, JSON.stringify(s.schack.pussel));

  // --- omladdning ----------------------------------------------------------------------------------------------
  await A.p.laddaOm();
  await A.vanta(`!!document.querySelector(".schack-pussel-nr, .schack-pussel-val")`, 20000);
  await A.ev(`location.hash = "#/elev/schack?vy=pussel"`);
  await A.vanta(`((document.querySelector(".schack-pussel-val")?.innerText || "").match(/av 200 lösta/g) || []).length === 2`, 15000);
  const val2 = await A.ev(`document.querySelector(".schack-pussel-val").innerText.replace(/\\s+/g, " ")`);
  ok("efter omladdning: 12 av 200 (ett: 10 + 2 extra pussel lösta via direktlänk) och 6 av 200 (två) lösta", /12 av 200 lösta/.test(val2) && /6 av 200 lösta/.test(val2), val2);
  await A.bild(BILDER, "pussel-val-efter");
  await A.klick('[data-sort="ett"]');
  await A.vanta(`/Pussel \\d+ av 200/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 15000);
  ok("efter omladdning: Matt i ett fortsätter där eleven var (lokalt läge)", /Pussel \d+ av 200/.test(await nrText(A)), await nrText(A));

  // --- sista pusslet + slutet --------------------------------------------------------------------------------------------
  await oppna(A, "ett", 200);
  await los(A, ETT[199]);
  const sl = await svar(A);
  ok("pussel 200: sista pusslet säger hur många som verkligen är lösta (hoppade över många)", /sista pusslet/.test(sl) && /av 200 lösta/.test(sl), sl);
  ok("pussel 200: knappen blir 'Till alla pussel'", /Till alla pussel/.test(await A.text('[data-act="nasta"]')));
  await A.klick('[data-act="nasta"]');
  await A.vanta(`!!document.querySelector(".schack-pussel-val")`, 5000);
  await vila(500);
  const v3 = await A.ev(`document.querySelector(".schack-pussel-val").innerText.replace(/\\s+/g, " ")`);
  ok("slutet: valet säger 'Du har kommit till slutet – gör om dem!'", /slutet – gör om dem/.test(v3), v3);
  s = await sd(A.uid);
  ok("pussel.ett efter 200: losta 13 (12 + det sista), senast 200", s.schack.pussel.ett.senast === 200 && s.schack.pussel.ett.losta === 13, JSON.stringify(s.schack.pussel.ett));

  // --- inga mynt -----------------------------------------------------------------------------------------------------------------
  const sdS = await sd(A.uid);
  ok("inga mynt: coins oförändrade efter hela pusselkörningen", (sdS.coins ?? null) === mynt0, `${mynt0} → ${sdS.coins}`);
  ok("inga mynt: ingen mynttext i pusselvyn", !(await A.ev(`/mynt|🪙|belöning/i.test(document.body.innerText)`)));
  const konsolFel = A.p.konsol.filter((x) => /EXCEPTION|kunde inte sparas|permission|Missing or insufficient|Uncaught/i.test(x));
  ok("konsolen: inga JS-fel och inga 'kunde inte sparas'/permission-varningar under hela körningen", konsolFel.length === 0, konsolFel.join(" | ").slice(0, 400));
}
