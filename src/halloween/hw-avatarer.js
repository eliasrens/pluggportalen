// ============================================================================
// Pluggporten – köpbara Halloween-avatarer (#694, epic #689, spec §5)
// ----------------------------------------------------------------------------
// Sex figurer i samma stil som art-characters-art.js: viewBox "0 0 100 120",
// huvud (50,36) r≈22, ögon y=34 (x 41/59), hals y≈58, höger tass (79,77),
// fötter y≈109 – samma ankargrid, så ALLA kläder och kostymer sitter rätt.
// Gulligt-läskigt: stora ögon, runda former, inga vassa tänder.
//
// Katalogen (id/namn/pris, category "avatar") står i avatars.js och slås in i
// SHOP_ITEMS där; ägandet i studentData.ownedItems. Konsten laddas bara med import() (#271) – av
// loadAvatarArt() i avatars.js och av hw-konst.js (butiken/världen).
// Id:na sparas i Firestore (avatarId, ownedItems) – byt dem aldrig.
// ============================================================================

import { O, LINE, THIN, STYLE, eye, eyes, cheeks, smile, limb, stdBody, head, pointyEar, nose } from "../art-style.js";
import { registerCharacters } from "../art-characters.js";
import { registerItemArt } from "../art-items.js";
import { getItem } from "../shop-items.js";
import "../avatars.js"; // slår in köpavatarernas katalograder i SHOP_ITEMS

const LILA = "#B79BE0", LILA_MORK = "#7E62B8", NATT = "#4C4661", GUL = "#F7C948";

/** Liten öppen "o"-mun (förvånat-gulligt). */
const oMun = (y = 46) => `<ellipse cx="50" cy="${y}" rx="3.2" ry="3.8" fill="#7C4A57" ${THIN}/>`;

/** Kattöga: gul iris med smal pupill och glimt. */
const kattOga = (x) =>
  `<circle cx="${x}" cy="34" r="6.2" fill="${GUL}" ${THIN}/>` +
  `<ellipse cx="${x + 0.4}" cy="34.6" rx="1.9" ry="4.2" fill="${O}"/>` +
  `<circle cx="${x + 2.2}" cy="32" r="1.3" fill="#fff"/>`;

function spokeArt() {
  return (
    `<ellipse cx="50" cy="115" rx="18" ry="3" fill="${O}" opacity="0.12"/>` +
    // huvud + kjol i ett, vågig fåll som svävar ovanför golvet
    `<path d="M50 13 C33 13 27 27 28 42 C29 60 27 84 25 104 Q31 99 37 106 Q43 99 50 106 Q57 99 63 106 Q69 99 75 104 C73 84 71 60 72 42 C73 27 67 13 50 13 Z" fill="#fff" ${LINE}/>` +
    `<path d="M30 92 Q50 98 70 92 L73 102 Q69 99 63 106 Q57 99 50 106 Q43 99 37 106 Q31 99 27 102 Z" fill="#E9E2F7" stroke="none"/>` +
    limb("M31 66 Q23 71 22 79", "#fff", 7) +
    `<circle cx="22" cy="80" r="4.8" fill="#fff" ${THIN}/>` +
    limb("M69 66 Q76 69 78 75", "#fff", 7) +
    `<circle cx="79" cy="77" r="4.8" fill="#fff" ${THIN}/>` +
    eyes(34, 9, 6.5) + oMun(46) + cheeks(43, 17)
  );
}

function pumpgubbeArt() {
  const pumpa = "#F49E4C", rand = "#F08A3C";
  return (
    stdBody("#6FA85B", "#A9D98F", "#8A6242") +
    // blad på kroppen (lappar på dräkten)
    `<path d="M44 80 q6 -6 12 0 q-6 6 -12 0 Z" fill="#4E9B5E" stroke="none"/>` +
    // stjälk + litet blad (en hatt täcker dem – det gör inget)
    `<path d="M50 17 Q49 10 54 7" fill="none" stroke="#6B4A2E" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M53 12 Q62 6 66 12 Q60 16 53 12 Z" fill="#6FC66F" ${THIN}/>` +
    // pumpahuvud (lite bredare än huvudcirkeln, samma mitt)
    `<ellipse cx="50" cy="37" rx="25" ry="21" fill="${pumpa}" ${LINE}/>` +
    `<path d="M42 20 Q33 37 42 54 M58 20 Q67 37 58 54" fill="none" stroke="${rand}" stroke-width="2.6" stroke-linecap="round"/>` +
    eyes() +
    `<path d="M47.5 41 L50 38 L52.5 41 Z" fill="${O}" stroke="none"/>` +
    smile(46, 7) + cheeks(44, 17)
  );
}

function fladdermusArt() {
  const fur = "#5B4F7A", vinge = "#7E62B8";
  return (
    // vingar bakom kroppen, fästa vid armarna
    `<path d="M37 64 Q20 52 8 60 Q12 66 10 72 Q17 70 19 77 Q24 73 29 79 Q31 72 37 70 Z" fill="${vinge}" ${LINE}/>` +
    `<path d="M63 64 Q80 52 92 60 Q88 66 90 72 Q83 70 81 77 Q76 73 71 79 Q69 72 63 70 Z" fill="${vinge}" ${LINE}/>` +
    stdBody(fur, LILA, NATT) +
    pointyEar(-1, fur, "#F5C1CB") + pointyEar(1, fur, "#F5C1CB") +
    head(fur) +
    `<ellipse cx="50" cy="45" rx="10" ry="7.5" fill="${LILA}" stroke="none"/>` +
    eyes() + nose(42, "#F5A3B5", 3, 2.2) + smile(46.5, 5) + cheeks(44)
  );
}

function haxkattArt() {
  const fur = NATT, belly = "#6B6488";
  return (
    // svans med glittrig stjärntipp
    limb("M64 98 Q86 100 84 82 Q83 74 76 76", fur, 7) +
    `<path transform="translate(76 74) scale(1.1)" d="M0 -5 L1.4 -1.5 L5 -1.2 L2.3 1.1 L3.1 4.8 L0 2.8 L-3.1 4.8 L-2.3 1.1 L-5 -1.2 L-1.4 -1.5 Z" fill="${GUL}" ${THIN}/>` +
    stdBody(fur, belly) +
    // lila halsband med liten månbjällra
    `<path d="M38 60 Q50 66 62 60" fill="none" stroke="${LILA}" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="50" cy="67" r="4" fill="${GUL}" ${THIN}/><circle cx="52" cy="66" r="3" fill="${belly}" stroke="none"/>` +
    pointyEar(-1, fur, LILA) + pointyEar(1, fur, LILA) +
    head(fur) +
    // liten månskära i pannan
    `<path d="M50 18 A4.5 4.5 0 1 0 55 25 A3.6 3.6 0 1 1 50 18 Z" fill="${GUL}" stroke="none"/>` +
    kattOga(41) + kattOga(59) +
    nose(41.5, "#F5A3B5") +
    `<path d="M46 45 Q48 48 50 45 Q52 48 54 45" fill="none" stroke="#C9C2DE" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M24 40 L34 41 M24 46 L34 45 M76 40 L66 41 M76 46 L66 45" fill="none" stroke="#C9C2DE" stroke-width="2" stroke-linecap="round"/>` +
    cheeks(44)
  );
}

function mumieArt() {
  const linda = "#F3E6C8", skugga = "#DCCBA6";
  const band = (d) => `<path d="${d}" fill="none" stroke="${skugga}" stroke-width="2.4" stroke-linecap="round"/>`;
  return (
    stdBody(linda, linda, linda) +
    band("M37 70 Q50 64 64 72 M34 82 Q50 76 66 84 M34 94 Q50 88 66 96 M42 104 Q52 100 60 103") +
    band("M30 74 L34 78 M74 72 L78 75") +
    // lös bandagesnibb som fladdrar
    `<path d="M70 26 Q82 22 86 30 Q80 30 76 34 Z" fill="${linda}" ${THIN}/>` +
    head(linda) +
    band("M30 26 Q50 18 70 26 M29 47 Q50 54 71 47 M33 53 Q50 60 67 53") +
    // mörk springa där ögonen tittar ut
    `<path d="M29 30 Q50 25 71 30 L71 39 Q50 35 29 39 Z" fill="${NATT}" stroke="none"/>` +
    eyes(34, 9, 6) + smile(45, 5) + cheeks(43, 17)
  );
}

function vampyrArt() {
  const hud = "#E6DDF5", drakt = NATT, cape = "#5B3F8C";
  return (
    // cape bakom kroppen med ljuslila foder + hög krage bakom huvudet
    `<path d="M33 60 Q20 86 22 108 Q50 112 78 108 Q80 86 67 60 Z" fill="${cape}" ${LINE}/>` +
    `<path d="M36 64 Q27 86 28 104 L72 104 Q73 86 64 64 Z" fill="${LILA}" stroke="none"/>` +
    `<path d="M33 60 L20 40 L42 54 Z M67 60 L80 40 L58 54 Z" fill="${cape}" ${LINE}/>` +
    stdBody(drakt, drakt, drakt) +
    // vit skjortfront med liten rosett
    `<path d="M41 61 Q50 58 59 61 L50 84 Z" fill="#fff" ${THIN}/>` +
    `<path d="M44 63 L50 66 L44 69 Z M56 63 L50 66 L56 69 Z" fill="${LILA_MORK}" ${THIN}/>` +
    head(hud) +
    // frisyr med spets i pannan
    `<path d="M28 33 C27 18 38 13 50 13 C62 13 73 18 72 33 Q65 24 56 25 L50 31 L44 25 Q35 24 28 33 Z" fill="${drakt}" ${LINE}/>` +
    eye(41, 35, 6) + eye(59, 35, 6) +
    smile(46, 5.5) + cheeks(44)
  );
}

/** id → { name, art } – namnen hämtas ur katalogen (avatars.js). */
const KONST = {
  "hw-av-spoke": spokeArt,
  "hw-av-pumpgubbe": pumpgubbeArt,
  "hw-av-fladdermus": fladdermusArt,
  "hw-av-haxkatt": haxkattArt,
  "hw-av-mumie": mumieArt,
  "hw-av-vampyr": vampyrArt,
};

export const HW_AVATAR_IDS = Object.keys(KONST);

let klar = false;

/** Slå in figurerna (avatarer) + butikskortens bilder (idempotent). */
export function registreraHalloweenAvatarer() {
  if (klar) return;
  klar = true;
  const art = Object.fromEntries(HW_AVATAR_IDS.map((id) => [id, KONST[id]()]));
  registerCharacters(Object.fromEntries(HW_AVATAR_IDS.map((id) => [id, { name: getItem(id)?.name || id, art: art[id] }])));
  registerItemArt(Object.fromEntries(HW_AVATAR_IDS.map((id) => [id, { viewBox: STYLE.viewBox, art: art[id] }])));
}
