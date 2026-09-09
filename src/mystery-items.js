// ============================================================================
// Pluggportalen – mysterybox: item-pool, sällsynthet & viktad lottning
// ----------------------------------------------------------------------------
// Mysteryboxen är en NY KÄLLA till KOSMETIK – inget parallellt system. Varje
// mystery-item är en vanlig kosmetisk sak som återanvänder befintliga slots:
//   * category "klader"   (slot hatt/ansikte/hals/hand/rygg) → bärs på avataren
//     via klädlådan (varld-rum-wear.js), precis som köpta kläder.
//   * category "dekor"    → placeras i rummet via sak-lådan (varld-rum.js).
//   * category "tradgard" → placeras UTOMHUS runt huset (varld-tradgard.js).
//   * category "hus"      (skalId) → husskal som väljs i "🏠 Nytt hus"-panelen.
// Items ÄGS binärt i studentData.ownedItems (som köpta single-saker) – de dyker
// därför automatiskt upp i garderob/inventarie utan extra kod. Mystery-saker
// säljs INTE i den vanliga shoppen (mysteryOnly:true → filtreras bort där); de
// kan bara vinnas ur boxen. DJUREN (ägg/kläckning) rörs INTE av det här.
//
// LEGENDARY-nivån (#140) kan innehålla saker som redan finns i shoppen: FORDON
// ("bil"/"cykel" ur trädgårds-katalogen). Dessa markeras `existingShopItem:true`
// så shop-items.js INTE dubblerar dem i katalogen – de finns redan där som
// köpbara saker, men kan nu även VINNAS ur boxen. HUS-legendarys är mystery-
// husskal (art-mystery.js). Håll id:na STABILA – de sparas i Firestore.
//
// Denna modul är REN (ingen Firestore, inget DOM) och självförsörjande så att
// shop-items.js kan slå ihop MYSTERY_ITEMS i SHOP_ITEMS utan cirkelimport.
// ============================================================================

/** Vanliga mysteryboxens shop-id och pris (köps hur många gånger som helst). */
export const MYSTERY_BOX_ID = "mysterybox";
export const MYSTERY_BOX_PRICE = 500;

/**
 * BOX-NIVÅER (#186). Samma item-pool (MYSTERY_ITEMS) för alla tre, men olika
 * pris och olika LEGENDARY-CHANS (per-box-parameter i stället för hårdkodad).
 * `legendaryChance` skickas ända ner till rollMysteryItem():
 *   * null  → basviktning (alla nivåer viktade tillsammans, ~2 % legendary) –
 *             används av vanliga boxen så dess odds är HELT oförändrade (#140).
 *   * tal   → chansen att lotta legendary; resten fördelas viktat på
 *             vanlig/ovanlig/sällsynt enligt RARITIES.
 * Boxarna visas SIST i shoppen i denna ordning (billigast → dyrast). Håll
 * id:na stabila. `art` = itemSvg-id för egen box-ikon (art-mystery-box.js).
 */
export const MYSTERY_BOXES = [
  { id: MYSTERY_BOX_ID, name: "Mysterybox", price: MYSTERY_BOX_PRICE, emoji: "🎁", legendaryChance: null },
  { id: "mysterybox-mega", name: "Mega-mysterybox", price: 1000, emoji: "🎁", legendaryChance: 0.11 },
  { id: "mysterybox-epic", name: "Epic-mysterybox", price: 2000, emoji: "🎁", legendaryChance: 0.9 },
];

/**
 * Sällsynthetsnivåer med LOTTNINGSVIKT (weight) och DUBBLETT-coins (coins man
 * får i stället om man redan äger den lottade saken). Vikten styr hur ofta en
 * NIVÅ dyker upp; inom en nivå lottas saker likformigt. Ordningen legendary ≪
 * sällsynt < ovanlig < vanlig gör att legendary känns speciellt (~2 % chans).
 * Färgen används i reveal-kortet. Håll nivå-nycklarna stabila – de sparas via
 * items rarity-fält.
 */
export const RARITIES = {
  vanlig: { label: "Vanlig", weight: 58, dupCoins: 40, farg: "#7FC7E8" },
  ovanlig: { label: "Ovanlig", weight: 28, dupCoins: 90, farg: "#B79BE0" },
  sallsynt: { label: "Sällsynt", weight: 12, dupCoins: 180, farg: "#F7C948" },
  legendary: { label: "Legendarisk", weight: 2, dupCoins: 400, farg: "#FF7A1A" },
};

/** Nivåer i ordning vanlig → legendary (för UI-listor). */
export const RARITY_ORDER = ["vanlig", "ovanlig", "sallsynt", "legendary"];

/**
 * Hela item-poolen. Varje post:
 *   id       STABILT shop-id (sparas i ownedItems) – unikt. Mystery-egna saker
 *            är prefixade "myst-"; legendary FORDON återanvänder shop-id:n.
 *   name     visningsnamn
 *   category "klader" | "dekor" | "tradgard" | "hus"
 *   slot     (bara klader) hatt|ansikte|hals|hand|rygg
 *   skalId   (bara hus) === id (husskal-id i art-hus-ute.js)
 *   rarity   nyckel i RARITIES
 *   emoji    ofarlig fallback om SVG-konst saknas (art-mystery.js ritar riktig)
 *   existingShopItem  true = id:t finns REDAN i SHOP_ITEMS (fordon) → injiceras
 *            INTE på nytt av shop-items.js; kan bara vinnas som legendary-drop.
 */
export const MYSTERY_ITEMS = [
  // --- Vanliga -------------------------------------------------------------
  { id: "myst-stjarnglas", name: "Stjärnglasögon", category: "klader", slot: "ansikte", rarity: "vanlig", emoji: "🤩" },
  { id: "myst-blomkrans", name: "Blomsterkrans", category: "klader", slot: "hatt", rarity: "vanlig", emoji: "💐" },
  { id: "myst-prickscarf", name: "Prickig halsduk", category: "klader", slot: "hals", rarity: "vanlig", emoji: "🧣" },
  { id: "myst-lyktglob", name: "Lyktglob", category: "dekor", rarity: "vanlig", emoji: "🔮" },
  { id: "myst-svamplykta", name: "Svamplykta", category: "dekor", rarity: "vanlig", emoji: "🍄" },

  // --- Ovanliga ------------------------------------------------------------
  { id: "myst-fevingar", name: "Févingar", category: "klader", slot: "rygg", rarity: "ovanlig", emoji: "🧚" },
  { id: "myst-manhatt", name: "Månhatt", category: "klader", slot: "hatt", rarity: "ovanlig", emoji: "🌙" },
  { id: "myst-trollspo", name: "Kristalltrollspö", category: "klader", slot: "hand", rarity: "ovanlig", emoji: "🪄" },
  { id: "myst-fjarilsvingar", name: "Fjärilsvingar", category: "klader", slot: "rygg", rarity: "ovanlig", emoji: "🦋" },
  { id: "myst-kristallklunga", name: "Kristallklunga", category: "dekor", rarity: "ovanlig", emoji: "💎" },
  { id: "myst-lyktstolpe", name: "Sagolykta", category: "dekor", rarity: "ovanlig", emoji: "🏮" },
  { id: "myst-tradkoja", name: "Trädkoja", category: "hus", skalId: "myst-tradkoja", rarity: "ovanlig", emoji: "🌳" },

  // --- Sällsynta -----------------------------------------------------------
  { id: "myst-stjarnkrona", name: "Stjärnkrona", category: "klader", slot: "hatt", rarity: "sallsynt", emoji: "👑" },
  { id: "myst-drakvingar", name: "Drakvingar", category: "klader", slot: "rygg", rarity: "sallsynt", emoji: "🐉" },
  { id: "myst-anglavingar", name: "Änglavingar", category: "klader", slot: "rygg", rarity: "sallsynt", emoji: "😇" },
  { id: "myst-regnbagsfontan", name: "Regnbågsfontän", category: "dekor", rarity: "sallsynt", emoji: "⛲" },
  { id: "myst-trollportal", name: "Trollportal", category: "dekor", rarity: "sallsynt", emoji: "🌀" },

  // --- Legendariska (mycket sällsynta – de häftigaste sakerna) -------------
  // FORDON (återanvänder shop-id:n → existingShopItem, injiceras ej på nytt).
  { id: "bil", name: "Bil", category: "tradgard", rarity: "legendary", emoji: "🚗", existingShopItem: true },
  { id: "cykel", name: "Cykel", category: "tradgard", rarity: "legendary", emoji: "🚲", existingShopItem: true },
  // HUS (mystery-husskal).
  { id: "myst-kristallhus", name: "Kristallhus", category: "hus", skalId: "myst-kristallhus", rarity: "legendary", emoji: "🏯" },
  { id: "myst-molnslott", name: "Molnslott", category: "hus", skalId: "myst-molnslott", rarity: "legendary", emoji: "☁️" },
  // Exklusiva legendary-hus (art-hus-legendary.js) – bara vinnbara ur boxen,
  // finns ALDRIG i shoppens hus-kategori.
  { id: "myst-drakborg", name: "Drakborg", category: "hus", skalId: "myst-drakborg", rarity: "legendary", emoji: "🐉" },
  { id: "myst-regnbagspalats", name: "Regnbågspalats", category: "hus", skalId: "myst-regnbagspalats", rarity: "legendary", emoji: "🌈" },
  { id: "myst-rymdstation", name: "Rymdstation", category: "hus", skalId: "myst-rymdstation", rarity: "legendary", emoji: "🛸" },
  { id: "myst-pyramid", name: "Gyllene pyramid", category: "hus", skalId: "myst-pyramid", rarity: "legendary", emoji: "🔺" },
];

/** Alla mystery-id:n i en Set (snabb uppslagning). */
const MYSTERY_ID_SET = new Set(MYSTERY_ITEMS.map((it) => it.id));

/** Slå upp ett mystery-item på id, eller null. */
export function getMysteryItem(id) {
  return MYSTERY_ITEMS.find((it) => it.id === id) || null;
}

/** Är id:t ett mystery-item (ur boxen)? */
export function isMysteryItem(id) {
  return MYSTERY_ID_SET.has(id);
}

/** Sällsynthetsnivån för ett mystery-id (eller null om okänt). */
export function rarityOf(id) {
  const it = getMysteryItem(id);
  return it ? it.rarity : null;
}

/** Metadata för en nivå (label/weight/dupCoins/farg), säkert fallback. */
export function rarityInfo(rarity) {
  return RARITIES[rarity] || RARITIES.vanlig;
}

/** Coins man får när man lottar en DUBBLETT av given nivå. */
export function dupCoins(rarity) {
  return rarityInfo(rarity).dupCoins;
}

/** Alla items i en given nivå. */
export function itemsOfRarity(rarity) {
  return MYSTERY_ITEMS.filter((it) => it.rarity === rarity);
}

/** Viktad nivå bland ett givet urval av nivåer (drar EN gång ur rng). */
function weightedTier(rng, tiers) {
  const totalWeight = tiers.reduce((s, r) => s + RARITIES[r].weight, 0);
  let pick = rng() * totalWeight;
  let tier = tiers[tiers.length - 1];
  for (const r of tiers) {
    pick -= RARITIES[r].weight;
    if (pick < 0) {
      tier = r;
      break;
    }
  }
  return tier;
}

/**
 * Lotta ETT mystery-item ur poolen. Två steg: (1) välj NIVÅ, (2) välj sak
 * likformigt inom nivån. Så vikterna styr hur ofta varje sällsynthetsnivå
 * faller, oberoende av hur många saker en nivå har.
 *
 * NIVÅ-valet beror på `legendaryChance` (per-box-parameter, se MYSTERY_BOXES):
 *   * null/undefined → alla nivåer viktas TILLSAMMANS efter RARITIES.weight
 *     (~2 % legendary) – vanliga boxens oförändrade beteende.
 *   * ett tal        → med sannolikhet `legendaryChance` blir det legendary,
 *     annars viktas vanlig/ovanlig/sällsynt inbördes. Så Mega/Epic-boxarna kan
 *     höja legendary-oddsen utan att röra själva poolen.
 *
 * @param {() => number} [rng] slumpkälla i [0,1) (injicerbar för tester)
 * @param {{legendaryChance?: number|null}} [opts]
 * @returns {object} det lottade item-objektet
 */
export function rollMysteryItem(rng = Math.random, { legendaryChance = null } = {}) {
  const tiers = RARITY_ORDER.filter((r) => itemsOfRarity(r).length > 0);
  const hasLegendary = itemsOfRarity("legendary").length > 0;
  let tier;
  if (legendaryChance != null && hasLegendary) {
    // (1a) Parametrerad legendary-chans: legendary ja/nej, annars övriga viktat.
    if (rng() < legendaryChance) {
      tier = "legendary";
    } else {
      tier = weightedTier(rng, tiers.filter((r) => r !== "legendary"));
    }
  } else {
    // (1b) Standard: alla nivåer viktade tillsammans (oförändrad basbox).
    tier = weightedTier(rng, tiers);
  }
  // (2) Likformig sak inom nivån.
  const pool = itemsOfRarity(tier);
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx];
}
