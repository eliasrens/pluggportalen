#!/usr/bin/env node
// ============================================================================
// Schack slut-QA (#777): riktiga appen mot emulatorerna (admin/qa-emulator-proxy.mjs),
// en elev i klass 4A som har schack påslaget, riktiga CDP-inmatningar.
//
//   node admin/qa-schack-app.mjs <origin> <steg> [elev] [bildmapp]
//   steg: nivaer  – alla 4 nivåer × vit/svart/slumpa: vänt bräde, Varna mig-standard,
//                   status, senaste draget, tid elevdrag → datorns svar
//         bradet  – tryck/dra (mus+touch)/tangentbord/aria, animation + reduced-motion,
//                   rockad, en passant, förvandling, olagliga drag, schack-glöd, draglista
//         hjalp   – Varna mig, Ångra, Tips, matt/slutrutor, omladdning, Fortsätt partiet, Ge upp
//         layout  – 320 px, 360 px och surfplatta: brädet ≥ 320 px, ingen sidledsskroll
//         kvot    – Firestore-läsningar/-skrivningar under ett parti (proxyn med QA_RAKNA=1)
// Skriver OK/FEL-rader; skärmdumpar till [bildmapp] (standard: ingen).
// ============================================================================
import { writeFileSync, mkdirSync } from "node:fs";
import { startaChromium } from "./qa-schack/cdp.mjs";
import { skapaElev } from "./qa-schack/elev.mjs";

const [ORIGIN, STEG = "nivaer", ANV = "4a02", BILDER = ""] = process.argv.slice(2);
if (!ORIGIN) {
  console.error("Användning: node admin/qa-schack-app.mjs <origin> <nivaer|bradet|hjalp|layout|kvot> [elev] [bildmapp]");
  process.exit(2);
}
const rader = [];
const ok = (namn, villkor, info = "") => {
  rader.push(`${villkor ? "OK " : "FEL"}  ${namn}${info ? ` – ${info}` : ""}`);
  console.log(rader.at(-1));
};

const br = await startaChromium();
const p = await br.nySida();
await p.s("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
const skarm = async (namn) => {
  if (!BILDER) return;
  mkdirSync(BILDER, { recursive: true });
  const r = await p.s("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${BILDER}/${namn}.png`, Buffer.from(r.data, "base64"));
};
const e = skapaElev(p, ORIGIN);

try {
  await e.loggaIn(ANV);
  ok(`inloggad som ${ANV}`, true, await p.ev("location.hash"));
  const steg = await import(`./qa-schack/steg-${STEG}.mjs`);
  await steg.default({ p, e, ok, skarm, ORIGIN });
} catch (err) {
  ok("körningen", false, err.stack);
} finally {
  const fel = rader.filter((r) => r.startsWith("FEL")).length;
  console.log(`\n${rader.length - fel} OK, ${fel} FEL`);
  const konsol = p.konsol.filter((k) => /^(error|warning|EXCEPTION)/.test(k));
  if (konsol.length) console.log("Konsolen (fel/varningar):\n" + konsol.slice(0, 30).join("\n"));
  br.stang();
  process.exit(fel ? 1 : 0);
}
