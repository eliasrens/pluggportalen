// ============================================================================
// Kontrollpanel för preview-pixi-hus.html (#419) – ligger UTANFÖR appen
// ----------------------------------------------------------------------------
// Appen är den riktiga (router, pages-varld, kamera, Pixi-motor) mot stubbat
// Firebase. Panelen (nere i mitten, fällbar) visar och styr:
//   • Pixi-flaggor (normal / av = CSS / debug-HUD / frys) – sätts och laddar om;
//   • "Jämför": i frys-läget visar canvasen (Pixi:s vilo-bild) i stället för DOM;
//   • status: niva, pixiSpel, senaste övergången, profilen, stub-läsningar;
//   • spegel-nyckeln för #ute-lager (ändras vid palett/husskal/kläder/trädgård);
//   • "Alla husskal": speglar husScen med VARJE husskal ur alla art-hus-*-
//     register (+ art-mystery) med hus-profilen → fo=0, ingen extern URL,
//     ingen taint, unik nyckel – och visar bilderna i ett rutnät.
// Test-API: window.__ppHus = { status(), nyckel(), skalVarv() }.
// ============================================================================

import { speglaLager } from "../../src/varld-spegel.js";
import profil from "../../src/varld-profil-hus.js";
import { husScen, listHusSkal } from "../../src/art-hus-ute.js";
import { avatarMarkup } from "../../src/avatars.js";
import { LYX_HUS_SKAL } from "../../src/art-hus-lyx.js";
import { NATUR_HUS_SKAL } from "../../src/art-hus-natur.js";
import { RETRO_HUS_SKAL } from "../../src/art-hus-retro.js";
import { NOJE_HUS_SKAL } from "../../src/art-hus-noje.js";
import { LEGEND_SHOP_HUS_SKAL } from "../../src/art-hus-legend-shop.js";
import { LEGENDARY_HUS_SKAL } from "../../src/art-hus-legendary.js";
import { MYSTERY_HUS_SKAL } from "../../src/art-mystery.js";

const REGISTER = { lyx: LYX_HUS_SKAL, natur: NATUR_HUS_SKAL, retro: RETRO_HUS_SKAL, noje: NOJE_HUS_SKAL,
  "legend-shop": LEGEND_SHOP_HUS_SKAL, legendary: LEGENDARY_HUS_SKAL, mystery: MYSTERY_HUS_SKAL };
const registerFor = (id) => Object.entries(REGISTER).find(([, r]) => id in r)?.[0] || "ute";

const stage = () => document.querySelector("#varld-stage");
const flagga = (n) => { try { return localStorage.getItem(`pp:pixi:${n}`) === "1"; } catch { return false; } };

/** Allt klick-testet läser per steg. */
export function status() {
  const s = stage();
  const m = window.__ppPixi?.motor;
  const ute = document.querySelector("#ute-lager");
  return {
    route: location.hash,
    niva: s?.dataset.niva ?? null,
    pixiSpel: s?.dataset.pixiSpel ?? null,
    profil: ute?.dataset.spegelProfil ?? null,
    profilId: profil.id,
    spelar: m?.spelar ?? null,
    senaste: m?.senaste ?? null,
    flaggor: ["av", "debug", "frys", "tvinga"].filter(flagga),
    firestore: { las: window.__ppStub?.rakna.las, skriv: window.__ppStub?.rakna.skriv },
    stagePalett: s ? ["--hus-house", "--hus-roof"].map((v) => getComputedStyle(s).getPropertyValue(v).trim()).join(" ") : null,
  };
}

/** Innehålls-nyckeln (hash av speglad SVG) för ett hus-lager – som motorn speglar det. */
export async function nyckel(sel = "#ute-lager") {
  const l = document.querySelector(sel);
  if (!l || !stage()) return null;
  const sp = await speglaLager(l, stage(), profil);
  return { nyckel: sp.nyckel, kB: Math.round(sp.svg.length / 1024), fo: (sp.svg.match(/<foreignObject/g) || []).length,
    // kronans tagg-path (art-wearables-hatt.js)
    krona: sp.svg.includes("L17 21 L28 4"), ms: Math.round(sp.ms), ambient: sp.ambient.length };
}

async function rastra(svg, w, h) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = Math.round(w / 3); c.height = Math.round(h / 3);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    let taint = false;
    try { ctx.getImageData(0, 0, 1, 1); } catch { taint = true; }
    return { url: taint ? "" : c.toDataURL("image/png"), taint };
  } finally { URL.revokeObjectURL(url); }
}

/** Spegla husScen med varje husskal (sandlåda utanför skärmen, stagets palett). */
export async function skalVarv() {
  const s = stage();
  const bred = s?.clientWidth || 960, hog = s?.clientHeight || 600;
  const lada = document.createElement("div");
  lada.className = "varld-stage";
  lada.style.cssText = `${s?.getAttribute("style") || ""};position:fixed;left:-20000px;top:0;width:${bred}px;height:${hog}px;overflow:hidden`;
  const lager = document.createElement("div");
  lager.className = "varld-lager varld-ute";
  lager.dataset.spegelProfil = "hus";
  lada.appendChild(lager);
  document.body.appendChild(lada);
  const rader = [];
  const nycklar = new Set();
  try {
    for (const { id, namn } of listHusSkal()) {
      lager.innerHTML = husScen(avatarMarkup("fox", ["krona"]), { skalId: id, skylt: { rad1: "Klass 4B" } });
      await new Promise((r) => requestAnimationFrame(r));
      const sp = await speglaLager(lager, lada, profil);
      const r = await rastra(sp.svg, sp.w, sp.h);
      rader.push({ id, namn, register: registerFor(id), ms: Math.round(sp.ms), kB: Math.round(sp.svg.length / 1024),
        fo: (sp.svg.match(/<foreignObject/gi) || []).length, extern: /href="(https?:|\/\/)/.test(sp.svg),
        taint: r.taint, unik: !nycklar.has(sp.nyckel), nyckel: sp.nyckel, bild: r.url });
      nycklar.add(sp.nyckel);
    }
  } finally { lada.remove(); }
  visaRutnat(rader);
  return rader.map(({ bild, ...r }) => r);
}

function visaRutnat(rader) {
  document.querySelector("#pv-rutnat")?.remove();
  const d = document.createElement("div");
  d.id = "pv-rutnat";
  const fel = rader.filter((r) => r.fo || r.extern || r.taint || !r.unik).length;
  d.innerHTML = `<div class="pv-rut-topp"><b>${rader.length} husskal speglade med hus-profilen</b> ·
    ${fel ? `<span class="pv-fel">${fel} med fel</span>` : "alla: fo 0, ingen extern URL, ingen taint, unik nyckel"}
    <button type="button" id="pv-rut-stang">Stäng</button></div>
    <div class="pv-rut">${rader.map((r) => `<figure${r.fo || r.extern || r.taint || !r.unik ? ' class="pv-fel"' : ""}>
      ${r.bild ? `<img src="${r.bild}" alt="${r.namn}">` : "<div>taint!</div>"}
      <figcaption>${r.namn} <i>${r.register}</i><br>${r.ms} ms · ${r.kB} kB · ${r.nyckel.slice(0, 8)}</figcaption></figure>`).join("")}</div>`;
  document.body.appendChild(d);
  d.querySelector("#pv-rut-stang").addEventListener("click", () => d.remove());
}

// ---- Panelen -------------------------------------------------------------------
function satFlagga(namn) {
  try {
    for (const f of ["av", "debug", "frys", "tvinga"]) localStorage.removeItem(`pp:pixi:${f}`);
    if (namn !== "normal") localStorage.setItem(`pp:pixi:${namn}`, "1");
  } catch { /* blockerad */ }
  // Utan ?pixi= (urlFlaggor i motorn skulle annars skriva över valet).
  if (location.search) location.href = location.pathname + location.hash;
  else location.reload();
}

function montera() {
  const p = document.createElement("aside");
  p.id = "pv-panel";
  p.innerHTML = `<button type="button" id="pv-fall" aria-expanded="true">S1 · hus ▾</button>
    <div id="pv-kropp">
      <div class="pv-rad">${["normal", "av", "debug", "frys"].map((f) => `<button type="button" data-flagga="${f}">${f}</button>`).join("")}</div>
      <div class="pv-rad"><button type="button" id="pv-jamfor" aria-pressed="false">Jämför: DOM</button>
        <button type="button" id="pv-nyckel">Nyckel</button><button type="button" id="pv-skal">Alla husskal</button></div>
      <pre id="pv-status"></pre>
    </div>`;
  document.body.appendChild(p);
  for (const f of ["normal", "av", "debug", "frys"]) {
    const b = p.querySelector(`[data-flagga="${f}"]`);
    b.setAttribute("aria-pressed", String(f === "normal" ? !["av", "debug", "frys"].some(flagga) : flagga(f)));
    b.addEventListener("click", () => satFlagga(f));
  }
  p.querySelector("#pv-fall").addEventListener("click", (e) => {
    const oppen = e.currentTarget.getAttribute("aria-expanded") !== "true";
    e.currentTarget.setAttribute("aria-expanded", String(oppen));
    p.querySelector("#pv-kropp").hidden = !oppen;
  });
  const jamfor = p.querySelector("#pv-jamfor");
  jamfor.addEventListener("click", () => {
    const pa = jamfor.getAttribute("aria-pressed") !== "true";
    window.__ppPixi?.motor?.jamfor(pa);
    jamfor.setAttribute("aria-pressed", String(pa));
    jamfor.textContent = pa ? "Jämför: CANVAS" : "Jämför: DOM";
  });
  let senasteNyckel = "–";
  p.querySelector("#pv-nyckel").addEventListener("click", async () => {
    const n = await nyckel();
    senasteNyckel = n ? `${n.nyckel.slice(0, 10)} (${n.kB} kB, fo ${n.fo}, ${n.ms} ms)` : "–";
  });
  p.querySelector("#pv-skal").addEventListener("click", () => skalVarv());
  const ut = p.querySelector("#pv-status");
  setInterval(() => {
    const s = status();
    const sen = s.senaste;
    ut.textContent = [
      `niva      ${s.niva}   profil ${s.profil}`,
      `pixiSpel  ${s.pixiSpel}${s.spelar ? `  (${s.spelar})` : ""}`,
      sen ? `senaste   ${sen.yttre}→${sen.inre} ${sen.riktning} ${sen.vag}${sen.orsak ? `:${sen.orsak}` : ""}` : "senaste   –",
      sen?.vag === "pixi" ? `          förb ${sen.forberedMs} ms · max dt ${sen.maxDt ?? "–"} · omsp ${(sen.omspeglade || []).join(",") || "–"}${sen.inaktuella?.length ? ` · INAKTUELL ${sen.inaktuella}` : ""}` : "",
      `nyckel    ${senasteNyckel}`,
      `firestore läs ${s.firestore.las} · skriv ${s.firestore.skriv}`,
    ].filter(Boolean).join("\n");
  }, 250);
}

window.__ppHus = { status, nyckel, skalVarv };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montera);
else montera();
