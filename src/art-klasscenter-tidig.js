// ============================================================================
// Pluggporten – Klasscentret nivå 1–4 (#478): lägereld → tält → koja → stuga
// ----------------------------------------------------------------------------
// Ritas i Klasscentrets gemensamma koordinater (art-klasscenter-delar.js:
// viewBox 1250×800, mitt x=625, marklinje y=G=752). Varje funktion tar opts
// ({animera}) och returnerar INRE markup (utan <svg>) – art-klasscenter.js
// lägger ramen. Laddas bara dynamiskt (aldrig i app.js statiska bootgraf).
// ============================================================================

import {
  O, LINE, THIN, limb, shadow, G, CX, anim, rok, fonster, gnistra,
  WOOD, WOOD_DARK, WOOD_LIGHT, STONE, STONE_DARK, GULD, KRAM, FANA,
} from "./art-klasscenter-delar.js";

// Liggande stock (sittbänk) med årsringar i ändarna.
function stock(x1, x2, y, r = 12) {
  return `${limb(`M${x1} ${y} L${x2} ${y}`, WOOD, r * 2)}
      <circle cx="${x2}" cy="${y}" r="${r}" fill="${WOOD_LIGHT}" ${LINE}/>
      <circle cx="${x2}" cy="${y}" r="${(r * 0.45).toFixed(1)}" fill="none" stroke="${WOOD_DARK}" stroke-width="2"/>`;
}

// Stenring: en rad runda stenar längs marken mellan x1 och x2.
function stenring(x1, x2, y, n) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const x = x1 + ((x2 - x1) * i) / (n - 1);
    s += `<ellipse cx="${x.toFixed(1)}" cy="${y}" rx="17" ry="11" fill="${i % 2 ? STONE : STONE_DARK}" ${THIN}/>`;
  }
  return s;
}

// Vedtrave: staplade stockändar (ringar) med nedersta raden på marken.
function vedtrave(x, n) {
  let s = "";
  const r = 13;
  for (let rad = 0; rad < 3; rad++)
    for (let i = 0; i < n - rad; i++) {
      const cx = x + i * r * 2 + rad * r;
      const cy = G - r - rad * r * 1.75;
      s += `<circle cx="${cx}" cy="${cy.toFixed(1)}" r="${r}" fill="${WOOD_LIGHT}" ${THIN}/>
        <circle cx="${cx}" cy="${cy.toFixed(1)}" r="5" fill="none" stroke="${WOOD_DARK}" stroke-width="1.8"/>`;
    }
  return s;
}

// --- 1. Lägereld med stockar -------------------------------------------------
function lagereld(opts) {
  return `${shadow(CX, G, 170)}
      ${stock(462, 528, G - 14)}
      ${stock(722, 788, G - 14)}
      <!-- Vedkåta bakom elden -->
      ${limb(`M574 ${G - 6} L640 ${G - 96}`, WOOD_DARK, 12)}
      ${limb(`M676 ${G - 6} L610 ${G - 96}`, WOOD, 12)}
      <g${anim(opts, "kc-flamma")}>
        <path d="M578 ${G - 10} Q560 ${G - 70} 598 ${G - 104} Q596 ${G - 72} 612 ${G - 64} Q606 ${G - 118} 632 ${G - 150} Q640 ${G - 100} 656 ${G - 92} Q660 ${G - 116} 652 ${G - 128} Q694 ${G - 86} 672 ${G - 10} Z" fill="#F08A3C" ${LINE}/>
        <path d="M598 ${G - 10} Q588 ${G - 52} 612 ${G - 72} Q614 ${G - 52} 626 ${G - 50} Q624 ${G - 86} 640 ${G - 104} Q644 ${G - 70} 652 ${G - 62} Q666 ${G - 40} 652 ${G - 10} Z" fill="${GULD}" ${THIN}/>
        <ellipse cx="626" cy="${G - 26}" rx="16" ry="12" fill="#FDE9A8" stroke="none"/>
      </g>
      ${limb(`M586 ${G - 10} L664 ${G - 10}`, WOOD_DARK, 12)}
      ${stenring(560, 690, G - 4, 6)}
      <g${anim(opts, "kc-glitter")}>${gnistra(586, G - 150, 7, GULD)}</g>
      <g${anim(opts, "kc-glitter d2")}>${gnistra(676, G - 176, 6, GULD)}</g>
      <g${anim(opts, "kc-glitter d3")}>${gnistra(640, G - 196, 5, GULD)}</g>`;
}

// --- 2. Tält av grenar och tyg -----------------------------------------------
function talt(opts) {
  const TYG = "#F2A93B", TYG_MORK = "#D98A2B";
  return `${shadow(CX, G, 240)}
      <!-- Sidan (i perspektiv), bakom framgaveln -->
      <path d="M560 ${G - 232} L742 ${G - 214} L826 ${G} L690 ${G} Z" fill="${TYG_MORK}" ${LINE}/>
      <rect x="716" y="${G - 120}" width="38" height="34" rx="4" fill="#EF6F6C" ${THIN} transform="rotate(8 735 ${G - 103})"/>
      <path d="M722 ${G - 116} L748 ${G - 90} M748 ${G - 116} L722 ${G - 90}" stroke="${KRAM}" stroke-width="2" stroke-linecap="round" transform="rotate(8 735 ${G - 103})"/>
      ${limb(`M560 ${G - 232} L742 ${G - 214}`, WOOD_DARK, 6)}
      <!-- Framgaveln -->
      <path d="M430 ${G} L560 ${G - 232} L690 ${G} Z" fill="${TYG}" ${LINE}/>
      <path d="M560 ${G - 186} L512 ${G} L608 ${G} Z" fill="#6E5A7E" ${LINE}/>
      <path d="M560 ${G - 186} Q532 ${G - 92} 486 ${G} L530 ${G} Q540 ${G - 90} 560 ${G - 186} Z" fill="#F7D08A" ${THIN}/>
      <path d="M560 ${G - 186} Q590 ${G - 110} 616 ${G - 40}" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <!-- Grenstänger som korsas i toppen -->
      ${limb(`M436 ${G} L578 ${G - 262}`, WOOD_DARK, 8)}
      ${limb(`M684 ${G} L542 ${G - 262}`, WOOD_DARK, 8)}
      <!-- Tältlinor + pinnar -->
      <path d="M470 ${G - 70} L384 ${G - 2} M800 ${G - 60} L880 ${G - 2}" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
      ${limb(`M384 ${G + 2} L380 ${G - 14}`, WOOD, 5)}
      ${limb(`M880 ${G + 2} L884 ${G - 14}`, WOOD, 5)}
      <!-- Liten vimpel i grenkrysset -->
      <g${anim(opts, "kc-fana")}><path d="M578 ${G - 262} L620 ${G - 252} L578 ${G - 240} Z" fill="${FANA}" ${THIN}/></g>
      <!-- Pallstock + liten lägereldsrest -->
      ${stock(300, 350, G - 12, 11)}
      ${stenring(894, 950, G - 4, 3)}`;
}

// --- 3. Liten enkel träkoja --------------------------------------------------
function koja() {
  let plankor = "";
  for (let x = 500; x < 780; x += 34)
    plankor += `<path d="M${x} ${G - 182} L${x} ${G - 4}" stroke="${WOOD_DARK}" stroke-width="2.4" stroke-linecap="round"/>`;
  return `${shadow(CX, G, 250)}
      <rect x="466" y="${G - 190}" width="318" height="190" rx="6" fill="${WOOD}" ${LINE}/>
      ${plankor}
      <!-- Lite snett plankttak med överhäng -->
      <path d="M432 ${G - 172} L622 ${G - 312} L820 ${G - 176} L806 ${G - 160} L622 ${G - 290} L446 ${G - 156} Z" fill="${WOOD_DARK}" ${LINE}/>
      <path d="M478 ${G - 186} L622 ${G - 290} L772 ${G - 190} Z" fill="${WOOD_LIGHT}" ${LINE}/>
      <path d="M560 ${G - 234} L560 ${G - 188} M622 ${G - 280} L622 ${G - 188} M684 ${G - 234} L684 ${G - 188}" stroke="${WOOD}" stroke-width="3" stroke-linecap="round"/>
      <!-- Dörr av brädor -->
      <rect x="508" y="${G - 128}" width="72" height="128" rx="5" fill="${WOOD_DARK}" ${LINE}/>
      <path d="M532 ${G - 124} L532 ${G - 2} M556 ${G - 124} L556 ${G - 2} M512 ${G - 92} L576 ${G - 92} M512 ${G - 34} L576 ${G - 34}" stroke="${O}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
      <circle cx="568" cy="${G - 62}" r="4.5" fill="${GULD}" ${THIN}/>
      <!-- Fönster med fönsterlucka -->
      ${fonster(640, G - 140, 84, 70)}
      <rect x="728" y="${G - 142}" width="26" height="74" rx="3" fill="#6FC66F" ${LINE}/>
      <rect x="630" y="${G - 70}" width="104" height="12" rx="6" fill="${KRAM}" ${LINE}/>
      <!-- Vedtrave bredvid -->
      ${vedtrave(810, 3)}`;
}

// --- 4. Stabil timmerstuga med rykande skorsten -----------------------------
function timmerstuga(opts) {
  let timmer = "";
  for (let y = G - 14; y > G - 210; y -= 26) timmer += limb(`M392 ${y} L858 ${y}`, WOOD, 19);
  return `${shadow(CX, G, 300)}
      <!-- Skorsten i sten (bakom taket) + rök -->
      <rect x="716" y="${G - 360}" width="62" height="150" rx="6" fill="${STONE}" ${LINE}/>
      <path d="M716 ${G - 330} L778 ${G - 330} M716 ${G - 300} L778 ${G - 300} M746 ${G - 360} L746 ${G - 330} M732 ${G - 330} L732 ${G - 300} M762 ${G - 330} L762 ${G - 300}" stroke="${STONE_DARK}" stroke-width="2.4"/>
      <rect x="708" y="${G - 372}" width="78" height="18" rx="5" fill="${STONE_DARK}" ${LINE}/>
      ${rok(747, G - 388, opts)}
      <!-- Timmerväggen: liggande stockar med utstickande knutar -->
      <rect x="400" y="${G - 220}" width="450" height="220" fill="${WOOD_DARK}" ${LINE}/>
      ${timmer}
      <!-- Torvtak (grönt gräs med blommor) -->
      <path d="M356 ${G - 196} L625 ${G - 372} L894 ${G - 196} Z" fill="#6FC66F" ${LINE}/>
      <path d="M380 ${G - 204} L625 ${G - 362} L870 ${G - 204}" fill="none" stroke="#8FD48A" stroke-width="7" stroke-linecap="round"/>
      <circle cx="520" cy="${G - 262}" r="6" fill="#F890B7" ${THIN}/>
      <circle cx="690" cy="${G - 300}" r="6" fill="${GULD}" ${THIN}/>
      <circle cx="760" cy="${G - 248}" r="6" fill="#FFFFFF" ${THIN}/>
      <path d="M346 ${G - 192} L904 ${G - 192}" stroke="${O}" stroke-width="8" stroke-linecap="round"/>
      <path d="M346 ${G - 192} L904 ${G - 192}" stroke="${WOOD_DARK}" stroke-width="4" stroke-linecap="round"/>
      <!-- Gavelfönster -->
      <circle cx="625" cy="${G - 262}" r="24" fill="${KRAM}" ${LINE}/>
      <circle cx="625" cy="${G - 262}" r="12" fill="#9AD3F0" ${THIN}/>
      <!-- Dörr + trappsteg -->
      <rect x="585" y="${G - 140}" width="80" height="136" rx="10" fill="#C97B63" ${LINE}/>
      <path d="M598 ${G - 126} L652 ${G - 126} L652 ${G - 82} L598 ${G - 82} Z" fill="none" stroke="${O}" stroke-width="2.4" opacity="0.5"/>
      <circle cx="652" cy="${G - 66}" r="5" fill="${GULD}" ${THIN}/>
      <rect x="566" y="${G - 12}" width="118" height="12" rx="4" fill="${STONE}" ${LINE}/>
      <!-- Två fönster med blomlådor -->
      ${fonster(446, G - 158, 92, 80)}
      ${fonster(712, G - 158, 92, 80)}
      <rect x="440" y="${G - 74}" width="104" height="16" rx="5" fill="${WOOD_LIGHT}" ${LINE}/>
      <rect x="706" y="${G - 74}" width="104" height="16" rx="5" fill="${WOOD_LIGHT}" ${LINE}/>
      <circle cx="462" cy="${G - 78}" r="6" fill="#EF6F6C" ${THIN}/><circle cx="492" cy="${G - 80}" r="6" fill="${GULD}" ${THIN}/><circle cx="522" cy="${G - 78}" r="6" fill="#F890B7" ${THIN}/>
      <circle cx="728" cy="${G - 78}" r="6" fill="#F890B7" ${THIN}/><circle cx="758" cy="${G - 80}" r="6" fill="#EF6F6C" ${THIN}/><circle cx="788" cy="${G - 78}" r="6" fill="${GULD}" ${THIN}/>
      ${vedtrave(870, 3)}`;
}

/** Nivå 1–4 → markup-funktion(opts). */
export const KLASSCENTER_TIDIG = { 1: lagereld, 2: talt, 3: koja, 4: timmerstuga };
