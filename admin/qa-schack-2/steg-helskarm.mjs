// Schack slut-QA Etapp 2 (#782), steget "helskarm" – se qa.mjs. 2E: helskärmsknappen mot en
// kompis och mot datorn, brädet + klockorna fyller skärmen (mobil, surfplatta, Chromebook,
// stående/liggande), ut med knappen och Esc, ingen knapp utan Fullscreen API, och att Live/
// Datakuppens helskärm (samma delade src/helskarm.js) fungerar som förut.
import { vila, anvandare, loggaInElev } from "./lib.mjs";
import { farger, vantaMed, spelaMot, callFran, nollaKlass } from "./spel.mjs";

const STORLEKAR = [
  ["mobil-staende", 390, 844, true], ["mobil-liggande", 844, 390, true], ["surfplatta", 820, 1180, true],
  ["chromebook", 1366, 768, false], ["liten-chromebook", 1280, 650, false],
];
/** Mått i helskärm: brädet, klockorna/spelarraderna, statusraden och knapparna inom skärmen. */
const MATT = (rot) => `(() => {
  const fs = document.fullscreenElement; const vw = innerWidth, vh = innerHeight;
  const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect() : null;
  const inne = (b) => !!b && b.left >= -1 && b.top >= -1 && b.right <= vw + 1 && b.bottom <= vh + 1;
  const q = (s) => [...document.querySelectorAll(${JSON.stringify(rot)} + " " + s)].map(r).filter(Boolean);
  const brade = r(document.querySelector(${JSON.stringify(rot)} + " .schack-bradet"));
  const spelare = q(".schack-spelare"), knappar = q(".schack-knappar button, .schack-helskarm-knapp");
  return { fs: !!fs, klass: !!fs && fs.classList.contains("schack-helskarm-pa"), vw, vh,
    sida: brade ? Math.round(Math.min(brade.width, brade.height)) : 0,
    andel: brade ? +(Math.min(brade.width, brade.height) / Math.min(vw, vh)).toFixed(2) : 0,
    braderInne: inne(brade), spelareInne: spelare.length > 0 && spelare.every(inne), knapparInne: knappar.every(inne),
    sidled: fs ? fs.scrollWidth > fs.clientWidth + 1 : false };
})()`;

async function provaHelskarm(u, rot, namn, ok, BILDER) {
  for (const [stl, b, h, mobil] of STORLEKAR) {
    await u.storlek(b, h, mobil);
    await vila(400);
    await u.klick(`${rot} .schack-helskarm-knapp`);
    await u.vanta(`!!document.fullscreenElement`, 5000).catch(() => {});
    await vila(600);
    const m = await u.ev(MATT(rot));
    ok(`${namn} ${stl} ${b}×${h}: helskärm på, brädet ${m.sida} px (${Math.round(m.andel * 100)} % av kortsidan), spelarrader/klockor och knappar på skärmen`,
      m.fs && m.klass && m.andel >= 0.6 && m.braderInne && m.spelareInne && m.knapparInne && !m.sidled, JSON.stringify(m));
    await u.bild(BILDER, `helskarm-${namn}-${stl}`);
    if (stl === "chromebook") {
      // Esc hanteras av webbläsaren (inte sidan) och når inte fram via CDP i headless –
      // det sidan ska klara är webbläsarens utgång: fullscreenchange utan knapptryck.
      await u.e.tangent("Escape");
      await vila(400);
      const viaEsc = !(await u.ev("!!document.fullscreenElement"));
      if (!viaEsc) await u.ev("document.exitFullscreen()");
      await vila(500);
      const efter = await u.ev(`({ fs: !!document.fullscreenElement, klass: !!document.querySelector(".schack-helskarm-pa"),
        aria: document.querySelector(${JSON.stringify(rot + " .schack-helskarm-knapp")}).getAttribute("aria-label") })`);
      ok(`${namn}: webbläsarens utgång (Esc${viaEsc ? "" : " → exitFullscreen, headless"}) – klassen bort, knappen säger Helskärm igen`,
        !efter.fs && !efter.klass && efter.aria === "Helskärm", JSON.stringify(efter));
    } else {
      await u.klick(`${rot} .schack-helskarm-knapp`);
      await vila(500);
      ok(`${namn} ${stl}: knappen lämnar helskärm (klassen borta)`, !(await u.ev(`!!document.fullscreenElement || !!document.querySelector(".schack-helskarm-pa")`)));
    }
  }
  await u.storlek(1280, 900, false);
}

export default async function helskarm({ br, PORTAR, BILDER, ok }) {
  const [PA, PB] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await nollaKlass();
  // mot kompis (med klocka)
  await vantaMed(A, "10");
  const id = await spelaMot(B, A);
  const { vit } = await farger(id, A, B);
  ok("kompispartiet har helskärmsknappen (verktygsraden)", await vit.finns(".schack-kompis .schack-parti-verktyg .schack-helskarm-knapp"));
  await provaHelskarm(vit, ".schack-kompis", "kompis", ok, BILDER);
  // i helskärm: drag + slutruta syns kvar
  await vit.klick(".schack-kompis .schack-helskarm-knapp");
  await vila(500);
  await callFran(vit === A ? B : A, "schackGeUpp", { partiId: id });
  await vit.vanta(`(() => { const e = document.querySelector(".schack-kompis .schack-slut"); return e && !e.hidden; })()`, 10000);
  const slut = await vit.ev(`(() => { const b = document.querySelector(".schack-kompis .schack-slut-kort").getBoundingClientRect();
    return { fs: !!document.fullscreenElement, inne: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth }; })()`);
  ok("slutrutan syns i helskärm", slut.fs && slut.inne, JSON.stringify(slut));
  await vit.bild(BILDER, "helskarm-kompis-slutruta");
  // Till lobbyn i helskärm → helskärmen avslutas (vyn byts)
  await vit.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await vila(800);
  ok("Till lobbyn lämnar helskärm", !(await vit.ev("!!document.fullscreenElement")));
  // lämna schacksidan i helskärm → ut
  await vantaMed(A, "");
  const id2 = await spelaMot(B, A, id);
  await A.klick(".schack-kompis .schack-helskarm-knapp");
  await vila(500);
  await A.ev(`location.hash = "#/elev/hem"`);
  await vila(1000);
  ok("byte till annan sida lämnar helskärm", !(await A.ev("!!document.fullscreenElement")));
  await callFran(A, "schackGeUpp", { partiId: id2 });

  // mot datorn
  await A.e.startaParti("bonden", "w");
  ok("datorpartiet har helskärmsknappen", await A.finns(".schack-panel .schack-helskarm-knapp, .schack-parti .schack-helskarm-knapp"));
  const rotDator = await A.ev(`(() => { const k = document.querySelector(".schack-helskarm-knapp"); let e = k; while (e && !e.classList.contains("schack-parti")) e = e.parentElement; return e ? ".schack-parti" : "body"; })()`);
  await provaHelskarm(A, rotDator, "dator", ok, BILDER);

  // utan Fullscreen API (t.ex. Safari på iPhone): ingen knapp
  const U = await anvandare(br, PA);
  await U.p.s("Page.addScriptToEvaluateOnNewDocument", { source: `
    for (const o of [Element.prototype, HTMLElement.prototype]) { delete o.requestFullscreen; delete o.webkitRequestFullscreen; }
    Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false });` });
  await U.p.gaTill(`${U.origin}/#/elev/schack?vy=dator`);
  await U.vanta(`document.querySelectorAll(".schack-bradet [data-ruta]").length === 64`, 30000);
  await vila(800);
  ok("utan Fullscreen API: ingen helskärmsknapp mot datorn", !(await U.ev(`!!document.querySelector(".schack-helskarm-knapp")`)));
  await vantaMed(B, "");
  await U.e.oppna("#/elev/schack?vy=kompis");
  await U.vanta(`!!document.querySelector('.schack-vantar-kort [data-uid="${B.uid}"]')`);
  await U.klick(`.schack-vantar-kort [data-act="spela"][data-uid="${B.uid}"]`);
  await U.vanta(`document.querySelectorAll(".schack-kompis .schack-bradet [data-ruta]").length === 64`);
  ok("utan Fullscreen API: ingen helskärmsknapp mot kompis (verktygsraden dold)", !(await U.ev(`!!document.querySelector(".schack-helskarm-knapp")`)) &&
    !(await U.finns(".schack-parti-verktyg")));
  const pid = await U.ev(`new URLSearchParams(location.hash.split("?")[1]).get("parti")`);
  await callFran(B, "schackGeUpp", { partiId: pid });

  // Live: Datakuppens elevvy (förhandsvisningen) och elevskärmens ⛶ – samma delade helper
  const D = await anvandare(br, PA, { bredd: 390, hojd: 844, mobil: true });
  await D.p.gaTill(`${D.origin}/preview/preview-datakuppen-elev.html`);
  await D.vanta(`!!document.querySelector(".dk-helskarm")`, 20000).catch(() => {});
  if (await D.ev(`!!document.querySelector(".dk-helskarm")`)) {
    await D.klick(".dk-helskarm");
    await vila(500);
    const dk = await D.ev(`({ fs: !!document.fullscreenElement, aria: document.querySelector(".dk-helskarm").getAttribute("aria-label") })`);
    ok("Datakuppen (elev): ⛶ går in i helskärm, knappen byter till 'Lämna helskärm'", dk.fs && dk.aria === "Lämna helskärm", JSON.stringify(dk));
    await D.bild(BILDER, "datakuppen-helskarm");
    await D.klick(".dk-helskarm");
    await vila(500);
    ok("Datakuppen (elev): knappen lämnar helskärm", !(await D.ev("!!document.fullscreenElement")));
  } else ok("Datakuppen-förhandsvisningen visar helskärmsknappen", false, await D.text("body"));
  await D.ev(`(async () => { const { createScreenChrome } = await import("/src/live/elevskarm-skarm.js");
    const root = document.createElement("div"); root.id = "qa-es"; root.style.cssText = "position:fixed;inset:0;background:#123";
    document.body.append(root); window.__qaEs = createScreenChrome(root, { sound: { unlock() {}, setMuted() {} } }); })()`);
  await D.klick(".lp-es-fs");
  await vila(500);
  ok("Live-elevskärmen: ⛶ går in i helskärm (roten)", await D.ev(`document.fullscreenElement?.id === "qa-es"`));
  await D.klick(".lp-es-fs");
  await vila(500);
  ok("Live-elevskärmen: ⛶ igen lämnar helskärm", !(await D.ev("!!document.fullscreenElement")));
  const konsol = [A, B, U].flatMap((u) => u.p.konsol.filter((x) => /^(error|EXCEPTION)/.test(x)));
  ok("inga konsolfel", !konsol.length, konsol.slice(0, 4).join(" | "));
}
