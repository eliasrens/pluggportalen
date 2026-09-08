// ============================================================================
// Pluggportalen – LEGENDARY husskal (exklusiva mysterybox-drops)
// ----------------------------------------------------------------------------
// Riktigt flashiga husskal som BARA kan VINNAS ur mysteryboxarna (Mega/Epic) –
// de finns INTE i shoppens "hus"-kategori, så en legendary-vinst känns speciell.
// Ritas i ute-scenens koordinater precis som stugan/lyxhusen (art-hus-ute.js):
//   * huset kring x 300–660, marklinjen y≈512
//   * dörr centrerad ~x480 ner till marken, fönster i fasaden
//   * fasad/tak/vägg färgas via --hus-house/--hus-roof/--hus-wall/--hus-wall2 så
//     varje elevs palett slår igenom – guld/regnbågs-accenter är fasta ovanpå.
// Registret LEGENDARY_HUS_SKAL spreadas in i HUS_SKAL i art-hus-ute.js, så husen
// dyker upp i "🏠 Nytt hus"-panelen som alla andra skal när eleven äger dem.
// Id:na MÅSTE matcha mystery-items.js exakt (sparas i studentData.ownedItems).
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;

// Femuddig fylld stjärna kring (cx,cy) – glitter/sparkle-accenter.
function star5(cx, cy, R, c, r = R * 0.42) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (-90 * Math.PI) / 180 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<path d="M${pts.join(" L")} Z" fill="${c}" ${THIN}/>`;
}

// Krenelering (tinnar) centrerad över väggsegmentet [x, x+w], tänderna med
// basen y-16..y+6 så de överlappar väggens överkant (y) → ingen glipa.
function krona(x, w, y, fill = "var(--hus-house)") {
  const step = 26, tw = 15, gap = step - tw;
  const n = Math.max(2, Math.floor((w + gap) / step));
  const span = n * tw + (n - 1) * gap;
  const start = x + (w - span) / 2;
  let s = "";
  for (let i = 0; i < n; i++)
    s += `<rect x="${(start + i * step).toFixed(1)}" y="${y - 16}" width="${tw}" height="22" fill="${fill}" ${LINE}/>`;
  return s;
}

// ============================================================================
// 1. DRAKBORG 🐉 – mörk borg med drakhorn, tinnar och glödande drakögon.
// ============================================================================
function drakborgMarkup() {
  return `${shadow(480, 512, 196)}
      <!-- Sidotorn -->
      <rect x="300" y="296" width="64" height="216" rx="5" fill="var(--hus-house)" ${LINE}/>
      <rect x="596" y="296" width="64" height="216" rx="5" fill="var(--hus-house)" ${LINE}/>
      <!-- Mittkeep (högre) -->
      <rect x="372" y="250" width="216" height="262" rx="6" fill="var(--hus-house)" ${LINE}/>
      ${krona(300, 64, 296)}
      ${krona(596, 64, 296)}
      ${krona(372, 216, 250)}
      <!-- Drakhorn som svänger ut från keepens övre hörn -->
      <path d="M372 254 Q338 210 298 224 Q334 232 362 262 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M588 254 Q622 210 662 224 Q626 232 598 262 Z" fill="var(--hus-roof)" ${LINE}/>
      <!-- Mittspira mellan hornen -->
      <path d="M452 250 L480 172 L508 250 Z" fill="var(--hus-roof)" ${LINE}/>
      <circle cx="480" cy="196" r="6" fill="#EF6F6C" ${THIN}/>
      <!-- Glödande drakögon-fönster -->
      <circle cx="418" cy="336" r="16" fill="#EF6F6C" ${LINE}/>
      <path d="M410 336 L426 336" stroke="#FDE9A8" stroke-width="5" stroke-linecap="round"/>
      <circle cx="542" cy="336" r="16" fill="#EF6F6C" ${LINE}/>
      <path d="M534 336 L550 336" stroke="#FDE9A8" stroke-width="5" stroke-linecap="round"/>
      <!-- Spetsig borgport -->
      <path d="M432 512 L432 384 Q432 344 480 344 Q528 344 528 384 L528 512 Z" fill="var(--hus-wall)" ${LINE}/>
      <path d="M480 344 L480 512 M436 424 L524 424" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="510" cy="436" r="5" fill="#F7C948" ${THIN}/>
      <!-- Tornfönster -->
      <rect x="316" y="332" width="30" height="42" rx="15" fill="var(--hus-wall)" ${LINE}/>
      <rect x="614" y="332" width="30" height="42" rx="15" fill="var(--hus-wall)" ${LINE}/>`;
}

// ============================================================================
// 2. REGNBÅGSPALATS 🌈 – luftigt palats med lökkupoler och regnbågsvalv bakom.
// ============================================================================
function regnbagspalatsMarkup() {
  const rainbow = ["#EF6F6C", "#F7A948", "#F7C948", "#6FC66F", "#7FC7E8", "#B79BE0"];
  const bage = rainbow
    .map(
      (c, i) =>
        `<path d="M${250 + i * 16} 320 A${230 - i * 16} ${230 - i * 16} 0 0 1 ${710 - i * 16} 320"
          fill="none" stroke="${c}" stroke-width="14" opacity="0.9"/>`
    )
    .join("");
  // Lökkupol centrerad på cx, med bas-bredd bw vid basY och spets på toppY.
  const kupol = (cx, bw, basY, toppY, knopp) =>
    `<path d="M${cx - bw / 2} ${basY} Q${cx - bw * 0.7} ${(basY + toppY) / 2} ${cx} ${toppY}
       Q${cx + bw * 0.7} ${(basY + toppY) / 2} ${cx + bw / 2} ${basY} Z" fill="var(--hus-roof)" ${LINE}/>
     ${limb(`M${cx} ${toppY} L${cx} ${toppY - 18}`, "#F7C948", 3)}
     <circle cx="${cx}" cy="${knopp}" r="6" fill="#F7C948" ${THIN}/>`;
  return `${shadow(480, 512, 190)}
      ${bage}
      <!-- Sidotorn -->
      <rect x="320" y="330" width="52" height="182" rx="6" fill="var(--hus-house)" ${LINE}/>
      <rect x="588" y="330" width="52" height="182" rx="6" fill="var(--hus-house)" ${LINE}/>
      <!-- Palatskropp -->
      <rect x="360" y="300" width="240" height="212" rx="14" fill="var(--hus-house)" ${LINE}/>
      <!-- Fasett-glitterlinjer -->
      <path d="M360 372 L600 372 M480 300 L480 512" stroke="${O}" stroke-width="2.2" opacity="0.3" fill="none"/>
      <!-- Lökkupoler -->
      ${kupol(346, 60, 330, 240, 232)}
      ${kupol(614, 60, 330, 240, 232)}
      ${kupol(480, 130, 300, 190, 176)}
      <!-- Portal -->
      <path d="M436 512 L436 376 Q436 340 480 340 Q524 340 524 376 L524 512 Z" fill="var(--hus-wall)" ${LINE}/>
      <path d="M480 340 L480 512 M440 416 L520 416" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="508" cy="426" r="5" fill="#F7C948" ${THIN}/>
      <!-- Rundfönster -->
      <circle cx="404" cy="416" r="22" fill="var(--hus-wall)" ${LINE}/>
      <path d="M404 394 L404 438 M382 416 L426 416" stroke="${O}" stroke-width="3.4"/>
      <circle cx="556" cy="416" r="22" fill="var(--hus-wall)" ${LINE}/>
      <path d="M556 394 L556 438 M534 416 L578 416" stroke="${O}" stroke-width="3.4"/>
      ${star5(346, 262, 5, "#fff", 2.2)}
      ${star5(614, 262, 5, "#fff", 2.2)}`;
}

// ============================================================================
// 3. RYMDSTATION 🛸 – svävande UFO med glaskupol, strålport och blinkljus.
// ============================================================================
function rymdstationMarkup() {
  const ljus = [340, 400, 480, 560, 620]
    .map((x, i) => `<circle cx="${x}" cy="426" r="7" fill="${i % 2 ? "#F7C948" : "#EF6F6C"}" ${THIN}/>`)
    .join("");
  return `${shadow(480, 520, 200)}
      <!-- Traktorstråle ner mot marken -->
      <path d="M424 512 L536 512 L582 434 L378 434 Z" fill="#9AD3F0" opacity="0.28" stroke="none"/>
      <!-- Fartygets underskrov -->
      <path d="M300 412 Q480 508 660 412 Q480 468 300 412 Z" fill="var(--hus-wall2)" ${LINE}/>
      <!-- Tallriks-kropp -->
      <ellipse cx="480" cy="410" rx="200" ry="58" fill="var(--hus-house)" ${LINE}/>
      ${ljus}
      <!-- Glaskupol (cockpit) -->
      <path d="M398 384 Q398 300 480 300 Q562 300 562 384 Z" fill="var(--hus-wall)" ${LINE}/>
      <path d="M430 360 Q446 330 480 326" fill="none" stroke="#fff" stroke-width="5"
        stroke-linecap="round" opacity="0.75"/>
      <!-- Antenn med blinkljus -->
      ${limb("M480 300 L480 266", "#B7C0D8", 4)}
      <circle cx="480" cy="260" r="8" fill="#EF6F6C" ${LINE}/>
      <circle cx="480" cy="260" r="3" fill="#FDE9A8"/>
      <!-- Ingångsramp (dörr) ner till marken -->
      <path d="M442 512 L518 512 L508 436 L452 436 Z" fill="var(--hus-wall)" ${LINE}/>
      <path d="M480 436 L480 512" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="480" cy="470" r="6" fill="#F7C948" ${THIN}/>
      ${star5(628, 322, 6, "#fff", 2.6)}
      ${star5(346, 300, 5, "#fff", 2.2)}`;
}

// ============================================================================
// 4. GYLLENE PYRAMID 🔺 – guldpyramid med lysande topp-juvel och portal.
// ============================================================================
function pyramidMarkup() {
  return `${shadow(480, 512, 200)}
      <!-- Pyramidkropp -->
      <path d="M300 512 L480 178 L660 512 Z" fill="var(--hus-house)" ${LINE}/>
      <!-- Solbelyst höger sida (ljusare split ner för mitten) -->
      <path d="M480 178 L660 512 L480 512 Z" fill="var(--hus-wall2)" opacity="0.28" stroke="none"/>
      <!-- Stenskift-linjer -->
      <path d="M366 396 L594 396 M336 456 L624 456" stroke="${O}" stroke-width="2.4" opacity="0.3" fill="none"/>
      <path d="M480 178 L480 512" stroke="${O}" stroke-width="2.4" opacity="0.25"/>
      <!-- Toppsten (capstone) med lysande juvel -->
      <path d="M452 246 L480 178 L508 246 Z" fill="var(--hus-roof)" ${LINE}/>
      <circle cx="480" cy="224" r="9" fill="#F7C948" ${LINE}/>
      <circle cx="480" cy="224" r="4" fill="#FDE9A8"/>
      ${star5(480, 168, 8, "#FDE9A8", 3)}
      <!-- Lysande portal -->
      <path d="M440 512 L440 396 Q440 372 480 372 Q520 372 520 396 L520 512 Z" fill="var(--hus-wall)" ${LINE}/>
      <path d="M456 512 L456 402 Q456 386 480 386 Q504 386 504 402 L504 512 Z" fill="#FDE9A8" opacity="0.55" stroke="none"/>
      <path d="M480 386 L480 512" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/>
      <!-- Facklor vid porten -->
      ${limb("M406 508 L406 452", "#8A6242", 5)}
      <circle cx="406" cy="446" r="9" fill="#F7A948" ${LINE}/>
      <circle cx="406" cy="444" r="4" fill="#FDE9A8"/>
      ${limb("M554 508 L554 452", "#8A6242", 5)}
      <circle cx="554" cy="446" r="9" fill="#F7A948" ${LINE}/>
      <circle cx="554" cy="444" r="4" fill="#FDE9A8"/>
      ${star5(390, 348, 5, "#FDE9A8", 2.2)}
      ${star5(576, 340, 5, "#FDE9A8", 2.2)}`;
}

/** id → { namn, emoji, markup } – spreadas in i HUS_SKAL i art-hus-ute.js.
 *  BARA vinnbara (legendary-drops); finns aldrig i shoppens hus-kategori. */
export const LEGENDARY_HUS_SKAL = {
  "myst-drakborg": { namn: "Drakborg", emoji: "🐉", markup: drakborgMarkup },
  "myst-regnbagspalats": { namn: "Regnbågspalats", emoji: "🌈", markup: regnbagspalatsMarkup },
  "myst-rymdstation": { namn: "Rymdstation", emoji: "🛸", markup: rymdstationMarkup },
  "myst-pyramid": { namn: "Gyllene pyramid", emoji: "🔺", markup: pyramidMarkup },
};
