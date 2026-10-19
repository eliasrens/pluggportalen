// Schack slut-QA Etapp 2 (#782), steget "layout" – se qa.mjs. 320/360 px, surfplatta och
// Chromebook: lobbyn, partiet mot en kompis (med klocka och §7.3-raden), slutrutan, lärarens
// sektion och åskådarläge – ingen sidledsskroll, brädet stort nog, knapparna nåbara.
import { db, vila, parti, anvandare, loggaInElev, loggaInLarare, tillLobby } from "./lib.mjs";
import { farger, vantaMed, spelaMot, callFran, nollaKlass } from "./spel.mjs";

const STORLEKAR = [["320", 320, 640, true], ["360", 360, 740, true], ["surfplatta", 820, 1180, true], ["chromebook", 1366, 768, false]];
const MATT = (bradeSel) => `(() => {
  const vw = innerWidth; const sidled = document.documentElement.scrollWidth > vw + 1;
  const b = document.querySelector(${JSON.stringify(bradeSel)})?.getBoundingClientRect();
  const utanfor = [...document.querySelectorAll("button, .schack-klocka, .schack-topplista, .sl-tbl")].filter((e) => e.getClientRects().length && !e.closest("[hidden]"))
    .map((e) => [e, e.getBoundingClientRect()]).filter(([e, r]) => r.width && (r.left < -1 || r.right > vw + 1) && !e.closest(".table-scroll"))
    // helt utanför = utfällbar meny som är stängd; delvis utanför i en skrollbar rad (flikar) = avsiktligt
    .filter(([e, r]) => r.right > 0 && r.left < vw && !(() => { for (let a = e.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if ((o === "auto" || o === "scroll") && a.scrollWidth > a.clientWidth) return true; } return false; })())
    .map(([e]) => (e.className || e.tagName) + ":" + e.textContent.trim().slice(0, 20));
  return { vw, sidled, brade: b ? Math.round(b.width) : null, utanfor: utanfor.slice(0, 4) };
})()`;

async function matt(u, vad, bradeSel, ok, BILDER, minBrade = 0) {
  for (const [namn, b, h, mobil] of STORLEKAR) {
    await u.storlek(b, h, mobil);
    await vila(500);
    const m = await u.ev(MATT(bradeSel || "#ingen"));
    const bradeOk = !bradeSel || (m.brade >= Math.min(minBrade || 280, b - 24));
    ok(`${vad} ${namn} (${b}×${h}): ingen sidledsskroll, inget utanför${bradeSel ? `, brädet ${m.brade} px` : ""}`, !m.sidled && !m.utanfor.length && bradeOk, JSON.stringify(m));
    if (namn === "320" || namn === "chromebook" || namn === "surfplatta") await u.bild(BILDER, `layout-${vad}-${namn}`);
  }
  await u.storlek(1280, 900, false);
}

export default async function layout({ br, PORTAR, BILDER, ok }) {
  const [PA, PB, PT] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB), T = await anvandare(br, PT);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await nollaKlass();
  await loggaInLarare(T);
  // lobbyn med en väntan, en topplista och ett pågående parti (seedat)
  await db.doc("schackKlass/4a").set({ tabell: { [A.uid]: { poang: 1032, vinster: 3, forluster: 1, remier: 1, partier: 5 }, [B.uid]: { poang: 977, vinster: 1, forluster: 3, remier: 1, partier: 5 } } }, { merge: true });
  await vantaMed(A, "10");
  await tillLobby(B);
  await B.vanta(`!!document.querySelector(".schack-vantar-kort")`);
  await matt(B, "lobby", null, ok, BILDER);
  // partiet med klocka
  const id = await spelaMot(B, A);
  const { vit, svart } = await farger(id, A, B);
  // §7.2: aldrig Ångra, Tips eller "Varna mig" mot en klasskompis (hos båda, även efter ett drag)
  for (const u of [vit, svart]) {
    const finns = await u.ev(`(() => { const r = document.querySelector(".schack-kompis");
      return { knappar: [...r.querySelectorAll("[data-act]")].map((b) => b.dataset.act).filter((a) => /angra|tips|varna/.test(a)),
        varna: !!r.querySelector('[class*="varna"], input[type=checkbox]'), text: /Ångra|Tips|Varna mig/.test(r.textContent) }; })()`);
    ok(`inga Ångra/Tips/Varna mig mot kompis (${u.anv})`, !finns.knappar.length && !finns.varna && !finns.text, JSON.stringify(finns));
  }
  await matt(vit, "parti", ".schack-kompis .schack-bradet", ok, BILDER);
  // §7.3-raden (Kräv vinsten) under brädet på smal skärm
  const pt = await parti(id);
  await db.doc(`schackPartier/${id}`).update({ klocka: { ...pt.klocka, vitMs: 1500, senastDragAt: Date.now() } });
  await svart.storlek(320, 640, true);
  await svart.vanta(`[...document.querySelectorAll('.schack-kompis [data-act="krava"]')].some((e) => e.getClientRects().length)`, 10000);
  await vila(500);
  const krav = await svart.ev(`(() => { const e = [...document.querySelectorAll('.schack-kompis [data-act="krava"]')].find((e) => e.getClientRects().length).getBoundingClientRect();
    return { inne: e.bottom <= innerHeight && e.right <= innerWidth && e.left >= 0, sidled: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
  ok("320 px: 'Kräv vinsten' syns på skärmen utan sidledsskroll", krav.inne && !krav.sidled, JSON.stringify(krav));
  await svart.bild(BILDER, "layout-krav-320");
  await svart.storlek(1280, 900, false);
  // lärarens sektion + åskådarläge
  await T.vanta(`!!document.querySelector("[data-titta]")`, 15000);
  await matt(T, "larare-sektion", null, ok, BILDER);
  await T.klick("[data-titta]");
  await T.vanta(`document.querySelectorAll(".sl-ask .schack-bradet [data-ruta]").length === 64`);
  // lärarsidans två panellager tar ~80 px på 320 px (rapportens iakttagelse) – 230 px räcker för att titta
  await matt(T, "larare-askadare", ".sl-ask .schack-bradet", ok, BILDER, 230);
  // slutrutan
  await callFran(svart, "schackKravaVinst", { partiId: id }).catch(() => {});
  await callFran(vit, "schackGeUpp", { partiId: id });
  await svart.vanta(`(() => { const e = document.querySelector(".schack-kompis .schack-slut"); return e && !e.hidden; })()`, 10000);
  await matt(svart, "slutruta", ".schack-kompis .schack-bradet", ok, BILDER);
  const konsol = [A, B].flatMap((u) => u.p.konsol.filter((x) => /^(error|EXCEPTION)/.test(x)));
  ok("inga konsolfel (eleverna)", !konsol.length, konsol.slice(0, 4).join(" | "));
}
