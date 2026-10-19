// ============================================================================
// Schack slut-QA Etapp 2 (#782): gemensamt för qa.mjs – flera användare i varsin
// origin (en räknande proxy per användare, rigg.sh), Admin-SDK mot emulatorn för
// att läsa facit och fejka tid, och elev-/lärarhandlingar via riktiga CDP-händelser.
// ============================================================================
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { skapaElev } from "../qa-schack/elev.mjs";

const require = createRequire(new URL("../../package.json", import.meta.url));
const admin = require("firebase-admin");
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("source /tmp/qa-schack-2/env först");
if (!admin.apps.length) admin.initializeApp({ projectId: "pluggportalen-so-2026" });
export const db = admin.firestore();
export const auth = admin.auth();
export const vila = (ms) => new Promise((r) => setTimeout(r, ms));
let framst = null; // fliken som ligger överst (Page.bringToFront)
const j = JSON.stringify;

export const uidFor = async (anv) => (await auth.getUserByEmail(`${anv}@elev.pluggportalen.local`)).uid;
export const parti = async (id) => (await db.doc(`schackPartier/${id}`).get()).data();
export const klass = async (id = "4a") => (await db.doc(`schackKlass/${id}`).get()).data() || {};

export function skapaRapport() {
  const rader = [];
  const ok = (namn, villkor, info = "") => {
    rader.push(`${villkor ? "OK " : "FEL"}  ${namn}${info ? ` – ${info}` : ""}`);
    console.log(rader.at(-1));
    return villkor;
  };
  return { rader, ok, fel: () => rader.filter((r) => r.startsWith("FEL")).length };
}

/** En användare = en sida i webbläsaren på sin egen proxy (origin). */
export async function anvandare(br, port, { bredd = 1280, hojd = 900, mobil = false, host = "127.0.0.1" } = {}) {
  const p = await br.nySida();
  // Headless: inmatning till en flik som inte ligger överst väntar på en bildruta (~5 s per
  // mushändelse). Varje användare har sitt eget fönster i verkligheten – lägg fliken överst först.
  const s0 = p.s;
  p.s = async (m, par) => {
    if (m.startsWith("Input.") && framst !== p) { await s0("Page.bringToFront"); framst = p; }
    return s0(m, par);
  };
  const origin = `http://${host}:${port}`; // egen host (t.ex. t3.localhost) = egen inloggning + egen anslutningspool
  await p.s("Emulation.setDeviceMetricsOverride", { width: bredd, height: hojd, deviceScaleFactor: 1, mobile: mobil });
  const e = skapaElev(p, origin);
  const u = { p, e, origin, port };
  u.ev = (x, o) => p.ev(x, o);
  u.vanta = (x, ms) => p.vanta(x, ms);
  u.rakna = (nolla = false) => p.ev(`fetch("/__qa/rakna${nolla ? "?nollstall" : ""}").then((r) => r.json())`);
  u.bild = async (dir, namn) => {
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    const r = await p.s("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${dir}/${namn}.png`, Buffer.from(r.data, "base64"));
  };
  u.storlek = (b, h, m = false) => p.s("Emulation.setDeviceMetricsOverride", { width: b, height: h, deviceScaleFactor: 1, mobile: m });
  u.text = (sel) => p.ev(`(document.querySelector(${j(sel)})?.textContent || "").replace(/\\s+/g, " ").trim()`);
  u.finns = (sel) => p.ev(`[...document.querySelectorAll(${j(sel)})].some((e) => !e.closest("[hidden]") && e.getClientRects().length > 0)`);
  /** Klick på första SYNLIGA träffen (lägesraden finns både under brädet och i panelen). */
  u.klick = async (sel) => {
    const s = await p.ev(`(() => { const e = [...document.querySelectorAll(${j(sel)})].find((e) => e.getClientRects().length && !e.closest("[hidden]"));
      if (!e) return null; e.dataset.qaKlick = String(Math.random()); return '[data-qa-klick="' + e.dataset.qaKlick + '"]'; })()`);
    if (!s) throw new Error("ingen synlig: " + sel);
    return e.klick(s);
  };
  /** Knapp med en viss text (synlig) */
  u.klickText = async (text, inom = "body") => {
    const sel = await p.ev(`(() => { const b = [...document.querySelectorAll(${j(inom)} + " button")].find((b) => b.textContent.trim().includes(${j(text)}) && b.getClientRects().length && !b.closest("[hidden]"));
      if (!b) return null; b.dataset.qaKlick = String(Math.random()); return '[data-qa-klick="' + b.dataset.qaKlick + '"]'; })()`);
    if (!sel) throw new Error("ingen knapp: " + text);
    await e.klick(sel);
  };
  return u;
}

export async function loggaInElev(u, anv) {
  await u.e.loggaIn(anv);
  u.anv = anv;
  u.uid = await uidFor(anv);
}

export async function loggaInLarare(u, anv = "qaarskurs4", hash = "#/larare/klasser?klass=4a&sektion=schack") {
  await u.p.gaTill(`${u.origin}/${hash}`);
  await u.vanta(`!!document.querySelector("#username")`, 20000);
  await u.ev(`(() => { const set = (e, v) => { e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
    set(document.querySelector("#username"), ${j(anv)}); set(document.querySelector("#p"), "lilla123");
    document.querySelector("#submit").click(); })()`);
  await u.vanta(`location.hash.startsWith("#/larare/") && !document.querySelector("#username")`, 20000);
  await vila(1500);
  if (!(await u.ev(`location.hash`)).includes("sektion=schack")) {
    await u.ev(`location.hash = ${j(hash)}`);
  }
  await u.vanta(`!!document.querySelector(".sl")`, 20000);
}

export const tillLobby = async (u) => {
  await u.ev(`location.hash = "#/elev/schack?vy=kompis"`);
  await u.vanta(`!!document.querySelector(".schack-lobby .schack-lobby-ny, .schack-lobby .schack-lobby-vantar-du, .schack-lobby .schack-lobby-utmanat")`, 20000);
};
/** Partiet är öppet hos u: partiId ur hashen, 64 rutor. */
export async function vantaParti(u, inte = "", ms = 20000) {
  await u.vanta(`/[?&]parti=/.test(location.hash) && !location.hash.includes("parti=${inte || "-"}") && document.querySelectorAll(".schack-kompis .schack-bradet [data-ruta]").length === 64`, ms);
  await vila(300);
  return u.ev(`new URLSearchParams(location.hash.split("?")[1]).get("parti")`);
}
/** Ett drag med tryck–tryck i u:s webbläsare; väntar tills servern har det (n halvdrag). */
export async function drag(u, partiId, from, to, promo) {
  const fore = (await parti(partiId)).drag.length;
  await u.e.tryck(from);
  await u.e.tryck(to);
  if (promo) await u.e.klick(`.schack-forvandling [data-pjas="${promo}"]`);
  const t = Date.now();
  while (Date.now() - t < 15000) {
    const pt = await parti(partiId);
    if (pt.drag.length > fore || pt.status !== "pagar") return pt;
    await vila(60);
  }
  throw new Error(`draget ${from}-${to} kom inte fram`);
}
/** Uttryck: antal halvdrag som brädet under `rot` visar (draglistans SAN-tokens), -1 utan bräde. */
export const ANTAL_DRAG = (rot = ".schack-kompis") =>
  `(() => { const e = document.querySelector(${j(rot + " .schack-draglista")}); if (!e) return -1;
    return [...e.querySelectorAll("span")].flatMap((s) => s.textContent.trim().split(/\\s+/)).filter((t) => t && !/^\\d+\\.+$/.test(t)).length; })()`;
/** Vänta tills u:s bräde visar minst n halvdrag (lyssnaren har levererat). */
export const bradeHar = (u, n, rot = ".schack-kompis", ms = 10000) => u.vanta(`${ANTAL_DRAG(rot)} >= ${n}`, ms);
