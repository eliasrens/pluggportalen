// ============================================================================
// Pluggporten – köpbara Jul-avatarer (#911, epic #906, DEL E.2)
// ----------------------------------------------------------------------------
// Samma regler som Halloween-avatarerna (hw-avatarer.js, #694): sex figurer i
// stilen från art-characters-art.js med samma ankargrid – viewBox "0 0 100 120",
// huvud (50,36) r≈22, ögon y=34 (x 41/59), hals y≈58, höger tass (79,77),
// fötter y≈109 – så ALLA kläder och kostymer sitter rätt.
//
// Katalogen (id/namn/pris, category "avatar", collection "jul") står i
// shop-items.js (KOP_AVATARER) så att butikKop på servern känner dem; ägandet i
// studentData.ownedItems och regeln kopAvatarOk i firestore.rules. Konsten laddas
// bara med import() (#271) – av loadAvatarArt() i avatars.js och av jul-konst.js.
// Id:na sparas i Firestore (avatarId, ownedItems) – byt dem aldrig.
// ============================================================================

import { O, LINE, THIN, STYLE, eyes, cheeks, smile, limb, stdBody, head, roundEar, nose } from "../art-style.js";
import { registerCharacters } from "../art-characters.js";
import { registerItemArt } from "../art-items.js";
import { getItem } from "../shop-items.js";
import { JULROD, GRAN, GULD, GULD_MORK, PEPPAR, SNOVIT, SNOSKUGGA, IS, WOOD, WOOD_DARK } from "./jul-art-delar.js";

/** Vit glasyrslinga (pepparkakan). */
const glasyr = (d, w = 2.2) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round"/>`;

function pepparkaksArt() {
  return (
    stdBody(PEPPAR, PEPPAR, PEPPAR) +
    glasyr("M24 78 Q28 75 32 78 M73 72 Q77 69 82 72 M33 106 Q40 103 47 106 M53 106 Q60 103 67 106") +
    `<circle cx="50" cy="74" r="3.2" fill="${JULROD}" ${THIN}/>` +
    `<circle cx="50" cy="86" r="3.2" fill="${GRAN}" ${THIN}/>` +
    `<circle cx="50" cy="98" r="3.2" fill="${JULROD}" ${THIN}/>` +
    head(PEPPAR) +
    glasyr("M32 24 Q36 20 40 22 M60 22 Q64 20 68 24", 2) +
    eyes() + smile(46, 6) +
    `<path d="M43 52 Q50 56 57 52" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 3"/>` +
    cheeks(43, 17)
  );
}

function snogubbeArt() {
  return (
    `<ellipse cx="50" cy="114" rx="22" ry="3" fill="${O}" opacity="0.1"/>` +
    // pinnarmar bakom kroppen, höger slutar vid handankaret (79,77)
    limb("M37 70 Q27 72 21 80", WOOD, 3.4) +
    limb("M63 70 Q72 70 78 76", WOOD, 3.4) +
    limb("M24 76 L19 73 M76 73 L81 70", WOOD, 2.4) +
    `<ellipse cx="50" cy="93" rx="22" ry="17" fill="${SNOVIT}" ${LINE}/>` +
    `<ellipse cx="50" cy="69" rx="16" ry="13" fill="${SNOVIT}" ${LINE}/>` +
    `<path d="M36 98 Q50 106 64 98" fill="none" stroke="${SNOSKUGGA}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="50" cy="66" r="2.4" fill="${O}" stroke="none"/>` +
    `<circle cx="50" cy="75" r="2.4" fill="${O}" stroke="none"/>` +
    `<circle cx="50" cy="88" r="2.6" fill="${O}" stroke="none"/>` +
    // röd halsduk mellan huvud och kropp
    `<path d="M33 56 Q50 63 67 56 L67 61 Q50 68 33 61 Z" fill="${JULROD}" ${THIN}/>` +
    `<path d="M58 62 L64 62 L66 74 L59 74 Z" fill="${JULROD}" ${THIN}/>` +
    head(SNOVIT) +
    eyes(33, 9, 5.6) +
    // morotsnäsa
    `<path d="M50 39 L62 42.5 L50 44.5 Z" fill="#F2A93B" ${THIN}/>` +
    `<path d="M44 49 h0.1 M47 51 h0.1 M50 51.6 h0.1 M53 51 h0.1 M56 49 h0.1" fill="none" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>` +
    cheeks(44, 17)
  );
}

function renArt() {
  const fur = "#A98263", belly = "#EADBC6", muzzle = "#F1E4D2";
  const horn = "M42 17 Q36 6 38 1 M39 10 Q32 8 29 3 M38 5 Q43 2 45 3";
  const hornH = "M58 17 Q64 6 62 1 M61 10 Q68 8 71 3 M62 5 Q57 2 55 3";
  return (
    stdBody(fur, belly, WOOD_DARK) +
    // halsband med bjällra
    `<path d="M37 60 Q50 66 63 60" fill="none" stroke="${JULROD}" stroke-width="4.4" stroke-linecap="round"/>` +
    `<circle cx="50" cy="66" r="4.2" fill="${GULD}" ${THIN}/>` +
    `<path d="M47.4 67 Q50 69 52.6 67" fill="none" stroke="${GULD_MORK}" stroke-width="1.4" stroke-linecap="round"/>` +
    limb(horn, "#D9C2A0", 3) + limb(hornH, "#D9C2A0", 3) +
    `<ellipse cx="28" cy="29" rx="7" ry="4" fill="${fur}" ${LINE} transform="rotate(-18 28 29)"/>` +
    `<ellipse cx="72" cy="29" rx="7" ry="4" fill="${fur}" ${LINE} transform="rotate(18 72 29)"/>` +
    head(fur) +
    // ljus tofs i pannan
    `<path d="M44 16 Q50 22 56 16 Q53 24 50 24 Q47 24 44 16 Z" fill="${belly}" stroke="none"/>` +
    eyes() +
    `<ellipse cx="50" cy="47" rx="9" ry="6.5" fill="${muzzle}" stroke="none"/>` +
    nose(43.5, "#5A4A44", 3.6, 2.6) + smile(49.5, 4) + cheeks(44)
  );
}

function pingvinArt() {
  const fur = "#2F3E63", beak = "#F2A93B";
  return (
    `<path d="M50 14 C26 14 24 44 26 70 C28 96 36 106 50 106 C64 106 72 96 74 70 C76 44 74 14 50 14 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M27 58 Q15 70 25 84 Q31 76 32 62 Z" fill="${fur}" ${LINE}/>` +
    // höger vinge sträcks mot handankaret
    `<path d="M72 62 Q82 66 83 76 Q76 78 70 72 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M50 22 C38 22 34 30 35 44 C30 56 32 88 50 96 C68 88 70 56 65 44 C66 30 62 22 50 22 Z" fill="#fff" stroke="none"/>` +
    eyes() +
    `<path d="M44 41 Q50 38 56 41 Q53 48 50 48 Q47 48 44 41 Z" fill="${beak}" ${THIN}/>` +
    cheeks(45, 15) +
    // randig halsduk (rött och vitt) med en flik
    `<path d="M30 55 Q50 64 70 55 L70 62 Q50 71 30 62 Z" fill="${JULROD}" ${LINE}/>` +
    `<path d="M38 59 L38 66 M46 61 L46 68 M54 61 L54 68 M62 59 L62 66" fill="none" stroke="#fff" stroke-width="2.4"/>` +
    `<path d="M33 62 L40 63 L38 80 L31 78 Z" fill="${JULROD}" ${THIN}/>` +
    `<path d="M32.4 68 L39.2 69 M31.8 74 L38.6 75" fill="none" stroke="#fff" stroke-width="2.2"/>` +
    `<ellipse cx="40" cy="108" rx="8" ry="4.6" fill="${beak}" ${LINE}/>` +
    `<ellipse cx="60" cy="108" rx="8" ry="4.6" fill="${beak}" ${LINE}/>`
  );
}

function isbjornArt() {
  const fur = "#F7F9FC", belly = IS, inner = "#F3C6D2";
  return (
    stdBody(fur, "#E6F1F8") +
    `<ellipse cx="50" cy="87" rx="9" ry="10" fill="${belly}" opacity="0.45" stroke="none"/>` +
    roundEar(-1, fur, inner) + roundEar(1, fur, inner) +
    head(fur) +
    eyes() +
    `<ellipse cx="50" cy="45" rx="9.5" ry="7" fill="#fff" stroke="${SNOSKUGGA}" stroke-width="1.6"/>` +
    nose(42.5, O, 3.8, 2.8) + smile(47.5, 4.2) + cheeks(44, 17) +
    // några snöflingor i pälsen
    `<path d="M33 75 l0 5 M30.5 77.5 l5 0 M67 92 l0 5 M64.5 94.5 l5 0" fill="none" stroke="${SNOSKUGGA}" stroke-width="1.6" stroke-linecap="round"/>`
  );
}

function tomtenisseArt() {
  const hud = "#F6D2B8", rock = JULROD, skagg = SNOVIT;
  return (
    stdBody(rock, rock, "#5A4A44") +
    // bälte och spänne
    `<path d="M32 84 Q50 89 68 84 L68 90 Q50 95 32 90 Z" fill="${O}" stroke="none"/>` +
    `<rect x="45" y="85.5" width="10" height="7" rx="1.5" fill="none" stroke="${GULD}" stroke-width="2.2"/>` +
    // vita vantar (ritas över tassarna)
    `<circle cx="28" cy="81" r="5.3" fill="${GRAN}" ${THIN}/>` +
    `<circle cx="79" cy="77" r="5.3" fill="${GRAN}" ${THIN}/>` +
    head(hud) +
    // luva: röd spets som lägger sig åt sidan, vit kant
    `<path d="M27 30 Q28 10 46 6 Q62 3 72 14 Q78 20 80 30 L74 30 Q72 22 66 20 Q70 26 73 30 Z" fill="${rock}" ${LINE}/>` +
    `<circle cx="78" cy="33" r="5" fill="${skagg}" ${LINE}/>` +
    `<rect x="25" y="25" width="50" height="8.5" rx="4.2" fill="${skagg}" ${LINE}/>` +
    eyes(38, 9, 5.2) +
    // skägg runt munnen
    `<path d="M29 41 Q28 58 40 62 Q50 66 60 62 Q72 58 71 41 Q65 47 58 47 Q50 52 42 47 Q35 47 29 41 Z" fill="${skagg}" ${LINE}/>` +
    `<ellipse cx="50" cy="45" rx="4" ry="3.4" fill="#F3A6A0" ${THIN}/>` +
    `<path d="M46 52 Q50 55 54 52" fill="none" stroke="${O}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<ellipse cx="35" cy="44" rx="3.6" ry="2.4" fill="#FFB1B8" opacity="0.85"/>` +
    `<ellipse cx="65" cy="44" rx="3.6" ry="2.4" fill="#FFB1B8" opacity="0.85"/>` +
    `<path d="M40 58 Q44 60 46 58 M54 58 Q56 60 60 58" fill="none" stroke="${SNOSKUGGA}" stroke-width="1.6" stroke-linecap="round"/>`
  );
}

/** id → konst – namnen hämtas ur katalogen (shop-items.js KOP_AVATARER). */
const KONST = {
  "jul-av-pepparkaksgubbe": pepparkaksArt,
  "jul-av-snogubbe": snogubbeArt,
  "jul-av-ren": renArt,
  "jul-av-pingvin": pingvinArt,
  "jul-av-isbjorn": isbjornArt,
  "jul-av-tomtenisse": tomtenisseArt,
};

export const JUL_AVATAR_IDS = Object.keys(KONST);

let klar = false;

/** Slå in figurerna (avatarer) + butikskortens bilder (idempotent). */
export function registreraJulAvatarer() {
  if (klar) return;
  klar = true;
  const art = Object.fromEntries(JUL_AVATAR_IDS.map((id) => [id, KONST[id]()]));
  registerCharacters(Object.fromEntries(JUL_AVATAR_IDS.map((id) => [id, { name: getItem(id)?.name || id, art: art[id] }])));
  registerItemArt(Object.fromEntries(JUL_AVATAR_IDS.map((id) => [id, { viewBox: STYLE.viewBox, art: art[id] }])));
}
