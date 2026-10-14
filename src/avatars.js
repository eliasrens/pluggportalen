// ============================================================================
// Pluggporten – avatarer
// ----------------------------------------------------------------------------
// Knyter ihop karaktärskonsten (art-characters.js) och klädselkonsten
// (art-wearables.js) till den publika avatar-API:n. Id:na sparas i Firestore
// (student.avatarId, studentData.avatarItems) – håll dem stabila, lägg bara
// till nya. Emojin per avatar finns kvar som enkel etikett/fallback (används
// t.ex. i lärarens elevtabell), men allt eleven ser renderas som inline SVG.
// ============================================================================

import { getItem, SHOP_ITEMS } from "./shop-items.js";
import { CHARACTERS, characterSvg } from "./art-characters.js";
import { wearableSvg, wearableAnchor } from "./art-wearables.js";
import { loadCollectionArt } from "./art-items.js";

export { CHARACTERS, characterSvg };

/** id → emoji-etikett (fallback). Ta aldrig bort ett id – de är sparade val. */
export const AVATARS = {
  fox: "🦊",
  owl: "🦉",
  cat: "🐱",
  dog: "🐶",
  panda: "🐼",
  frog: "🐸",
  unicorn: "🦄",
  dragon: "🐲",
  lion: "🦁",
  penguin: "🐧",
  koala: "🐨",
  robot: "🤖",
  bjorn: "🐻",
  tiger: "🐯",
  rabbit: "🐰",
  pig: "🐷",
  cow: "🐮",
  monkey: "🐵",
  hamster: "🐹",
  mouse: "🐭",
  chick: "🐤",
  sheep: "🐑",
  hedgehog: "🦔",
  wolf: "🐺",
  deer: "🦌",
  raccoon: "🦝",
  turtle: "🐢",
  bee: "🐝",
  elephant: "🐘",
  goat: "🐐",
};

export const DEFAULT_AVATAR = "fox";

// --- Köpbara avatarer (#694) -------------------------------------------------
// Alla i AVATARS ovan är GRATIS. Köpbara figurer är butiksvaror med category
// "avatar" (ingen egen flik) och `collection` (t.ex. Halloween-fliken), ägs i
// studentData.ownedItems – för alltid. Katalograderna står HÄR och slås in i
// SHOP_ITEMS när modulen laddas (avatars.js ligger i bootgrafen, så getItem
// känner dem innan något ritas; shop-items.js är vid 400-taket). Konsten laddas
// lazy per samling (AVATAR_KONST nedan, #271). En ny köpbar figur: rad nedan +
// konst i samlingens modul + id:t i firestore.rules (kopAvatarOk).
const KOP_AVATARER = [
  { id: "hw-av-spoke", name: "Litet spöke", emoji: "👻", price: 400, collection: "halloween" },
  { id: "hw-av-fladdermus", name: "Fladdermus", emoji: "🦇", price: 450, collection: "halloween" },
  { id: "hw-av-pumpgubbe", name: "Pumpgubbe", emoji: "🎃", price: 500, collection: "halloween" },
  { id: "hw-av-mumie", name: "Gullig mumie", emoji: "🧻", price: 600, collection: "halloween" },
  { id: "hw-av-haxkatt", name: "Häxkatt", emoji: "🐈", price: 700, collection: "halloween" },
  { id: "hw-av-vampyr", name: "Liten vampyr", emoji: "🧛", price: 800, collection: "halloween" },
];
for (const it of KOP_AVATARER) {
  if (!getItem(it.id)) SHOP_ITEMS.push({ ...it, category: "avatar" });
}

/** Är id:t en köpbar avatar (inte gratis)? */
export function isBuyableAvatar(id) {
  const it = getItem(id);
  return !!(it && it.category === "avatar");
}

/** Alla köpbara avatarer (katalogposter) i katalogordning. */
export function buyableAvatars() {
  return SHOP_ITEMS.filter((it) => it.category === "avatar");
}

/** Får eleven använda avataren? Gratis alltid, köpbar bara om den ägs. */
export function canUseAvatar(id, ownedItems) {
  if (AVATARS[id]) return true;
  return isBuyableAvatar(id) && Array.isArray(ownedItems) && ownedItems.includes(id);
}

/** Samling → laddare som registrerar samlingens avatarkonst (lazy, #271). */
const AVATAR_KONST = {
  halloween: () => import("./halloween/hw-avatarer.js").then((m) => m.registreraHalloweenAvatarer()),
};
let konstLaddas = null;

/**
 * Ladda (en gång) de köpbara avatarernas konst. Löses alltid, även vid fel
 * (då står platshållaren kvar). Efteråt byts platshållare i dokumentet ut
 * mot den riktiga figuren, så vyer som ritade för tidigt läker sig själva.
 */
export function loadAvatarArt() {
  konstLaddas ||= Promise.all(
    Object.values(AVATAR_KONST).map((ladda) =>
      ladda().catch((err) => console.warn("Avatarkonsten kunde inte laddas", err)))
  ).then(() => {
    if (typeof document === "undefined") return;
    for (const svg of document.querySelectorAll("svg[data-av-vantar]")) {
      const id = svg.getAttribute("data-av-vantar");
      if (CHARACTERS[id]) svg.outerHTML = characterSvg(id);
    }
  });
  return konstLaddas;
}

/** Är avatarens konst redo att ritas (gratis, eller köpbar + laddad)? */
export function avatarArtReady(id) {
  return !!AVATARS[id] || !isBuyableAvatar(id) || !!CHARACTERS[id];
}

/** Neutral siluett medan en köpbar figurs konst laddas (aldrig fel figur). */
function vantarSvg(id) {
  return (
    `<svg viewBox="0 0 100 120" role="img" aria-label="${avatarName(id)}" data-av-vantar="${id}" ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M50 14 C34 14 28 26 28 38 C28 50 34 56 38 58 C30 66 29 84 31 104 L69 104 C71 84 70 66 62 58 C66 56 72 50 72 38 C72 26 66 14 50 14 Z" fill="#3B3350" opacity="0.12"/></svg>`
  );
}

/** Emoji för ett avatar-id, med säker fallback till standardavataren. */
export function avatarEmoji(id) {
  return AVATARS[id] || (isBuyableAvatar(id) && getItem(id).emoji) || AVATARS[DEFAULT_AVATAR];
}

/** Svenskt namn för ett avatar-id (för aria-labels och titlar). */
export function avatarName(id) {
  if (CHARACTERS[id]) return CHARACTERS[id].name;
  return isBuyableAvatar(id) ? getItem(id).name : CHARACTERS[DEFAULT_AVATAR].name;
}

/**
 * Fristående helkropps-SVG för en karaktär (utan klädsel) – används i
 * avatarväljarens knappar och förhandsvisning. Skalar med CSS width/height.
 * Avataren ritas alltid i sitt basutseende (ingen evolution – bara husdjuren
 * kan utvecklas).
 */
export function avatarSvg(id) {
  if (AVATARS[id]) return characterSvg(id);
  if (!isBuyableAvatar(id)) return characterSvg(DEFAULT_AVATAR);
  if (CHARACTERS[id]) return characterSvg(id);
  loadAvatarArt(); // köpbar figur vars konst inte laddats än (#694)
  return vantarSvg(id);
}

/**
 * Bygg HTML för en avatar med ev. burna klädsaker ovanpå. Klädseln positioneras
 * med CSS (per slot, i % av containern) och hela figuren skalar med
 * font-size (.avatar-figure är 1em × 1.2em), så samma markup fungerar både i
 * sidhuvudet (litet) och som stor hjältebild. Karaktärerna delar ankargrid,
 * så samma slot-koordinater träffar rätt på alla figurer.
 *
 * Säsongskostymer (`seasonal`, #693) ritas med klassen af-kostym och syns BARA
 * när <html data-<säsong>> är satt (styles/33-kostymer.css) – avgörs alltså vid
 * ritningen, så ingen elevdata skrivs om och ett byte slår igenom direkt på
 * alla redan ritade avatarer. Katalogen, konsten och säsongstemat laddas lazy
 * (#271): ett buret "hw-"-id som inte laddats än blir en dold platshållare som
 * fylls i när katalogen kommit (laddaKostymer).
 *
 * @param {string} avatarId
 * @param {string[]} [equipped] id:n på burna klädsaker (från studentData.avatarItems)
 * @returns {string} HTML-sträng
 */
export function avatarMarkup(avatarId, equipped = []) {
  const worn = [];
  let vantar = "";
  for (const id of equipped || []) {
    const it = getItem(id);
    if (it && it.category === "klader") worn.push(it);
    else if (!it && LAZY_ID.test(id)) vantar += `<span class="af-kostym-vantar" data-kostym="${id}" hidden></span>`;
  }
  if (vantar || worn.some((it) => it.seasonal)) laddaKostymer();
  // Rygg-plagg (manteln) ritas FÖRE af-base → hänger bakom figuren; övriga
  // plagg ritas efter → ovanpå. Samma markup i rum- och ute-vyn.
  const behind = worn.filter((it) => it.slot === "rygg").map(wearSpan).join("");
  const front = worn.filter((it) => it.slot !== "rygg").map(wearSpan).join("");
  return `<span class="avatar-figure">${behind}<span class="af-base">${avatarSvg(avatarId)}</span>${front}${vantar}</span>`;
}

/** Säsongssamlingarnas id-prefix (hw- = Halloween, #692/#693) – lazy katalog. */
const LAZY_ID = /^hw-/;

function wearSpan(it) {
  // Vissa ansiktssaker (mustaschen) ankras lägre än ögonlinjen – lägg på
  // af-anchor-<anchor> som flyttar slot-boxen (se styles.css).
  const anchor = wearableAnchor(it.id);
  const cls = `af-wear af-${it.slot}${anchor ? ` af-anchor-${anchor}` : ""}`;
  if (it.seasonal) return `<span class="${cls} af-kostym" data-seasonal="${it.seasonal}">${wearableSvg(it.id) || ""}</span>`;
  return `<span class="${cls}">${wearableSvg(it.id) || it.emoji}</span>`;
}

/**
 * Kan klädsaken bäras just nu? Vanliga plagg alltid; en säsongskostym bara när
 * dess säsong är på – samma <html data-halloween> som styr synligheten
 * (season-world.js, server-korrigerad klocka). Garderoben: av = kan tas av men
 * inte på (varld-rum-wear.js).
 */
export function wearableActive(item) {
  if (!item || !item.seasonal) return true;
  return typeof document !== "undefined" && document.documentElement.dataset[item.seasonal] != null;
}

let kostymP = null;

/** Första kostymen: ladda katalog+konst (fyll platshållarna) + säsongstemat. */
function laddaKostymer() {
  if (kostymP || typeof document === "undefined") return;
  kostymP = Promise.all([
    loadCollectionArt().then(() => {
      for (const ph of document.querySelectorAll(".af-kostym-vantar")) {
        const it = getItem(ph.dataset.kostym);
        if (it && it.category === "klader") {
          const t = document.createElement("template");
          t.innerHTML = wearSpan(it);
          // Rygg bakom figuren (före af-base), övriga ovanpå.
          const base = it.slot === "rygg" && ph.parentElement?.querySelector(":scope > .af-base");
          if (base) base.before(t.content);
          else ph.before(t.content);
        }
        ph.remove();
      }
    }),
    import("./season-world.js").then((m) => m.ensureTheme()),
  ]).catch((err) => console.warn("Kostymerna kunde inte laddas:", err));
}
