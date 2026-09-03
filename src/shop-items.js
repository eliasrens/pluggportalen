// ============================================================================
// Pluggportalen – shop-katalog
// ----------------------------------------------------------------------------
// Alla köpbara saker i shoppen. Ritas som emoji – inga externa assets krävs.
// Id:na sparas i Firestore (studentData.ownedItems, room.placements,
// avatarItems), så håll dem STABILA. Lägg gärna till nya saker, men byt inte
// id på befintliga.
//
// Kategorier:
//   klader   – kläder & accessoarer som sätts på avataren (har en `slot`)
//   mobler   – möbler & prylar som placeras i rummet
//   husdjur  – husdjur som placeras i rummet
//   dekor    – dekor & pynt som placeras i rummet
//   mat      – KONSUMERBAR mat (äpplen) som läggs på golvet & äts av djuren
//
// Mat (`mat`) är en förbrukningsvara: den ligger INTE i ownedItems (en-gång-per-
// sak), utan köp ökar ett ANTAL (studentData.appleCount) man kan köpa flera av.
// Sätt `consumable: true` på sådana saker (se isConsumable). Hanteras via
// buyApple()/placeApple()/eatApple() i data-pet.js.
//
// Kläder (`klader`) bärs på avataren och har en `slot` (hatt/ansikte/hals/hand).
// Bara en sak per slot kan bäras samtidigt. Övriga kategorier placeras i rummet.
//
// Priser är medvetet spridda (billigt → dyrt) för långsiktig motivation.
// ============================================================================

export const CATEGORIES = [
  { id: "klader", name: "Kläder & accessoarer", emoji: "🎩" },
  { id: "mobler", name: "Möbler & prylar", emoji: "🪑" },
  { id: "husdjur", name: "Husdjur", emoji: "🐾" },
  { id: "mat", name: "Mat", emoji: "🍎" },
  { id: "dekor", name: "Dekor & pynt", emoji: "🖼️" },
];

// Slot = var på avataren en klädsak sitter (för positionering + en per slot).
export const WEARABLE_SLOTS = ["hatt", "ansikte", "hals", "hand"];

export const SHOP_ITEMS = [
  // --- Kläder & accessoarer (bärs på avataren) -----------------------------
  { id: "keps", name: "Keps", emoji: "🧢", category: "klader", slot: "hatt", price: 20 },
  { id: "partyhatt", name: "Partyhatt", emoji: "🎉", category: "klader", slot: "hatt", price: 35 },
  { id: "krona", name: "Krona", emoji: "👑", category: "klader", slot: "hatt", price: 150 },
  { id: "tomtemossa", name: "Tomteluva", emoji: "🎅", category: "klader", slot: "hatt", price: 60 },
  { id: "trollkarlshatt", name: "Trollkarlshatt", emoji: "🎩", category: "klader", slot: "hatt", price: 120 },
  { id: "glasogon", name: "Coola solglasögon", emoji: "🕶️", category: "klader", slot: "ansikte", price: 40 },
  { id: "glad-mask", name: "Glad mask", emoji: "😎", category: "klader", slot: "ansikte", price: 25 },
  { id: "halsduk", name: "Halsduk", emoji: "🧣", category: "klader", slot: "hals", price: 45 },
  { id: "medalj", name: "Guldmedalj", emoji: "🏅", category: "klader", slot: "hals", price: 90 },
  { id: "ballong", name: "Ballong", emoji: "🎈", category: "klader", slot: "hand", price: 15 },
  { id: "trollstav", name: "Trollstav", emoji: "🪄", category: "klader", slot: "hand", price: 110 },
  { id: "svard", name: "Träsvärd", emoji: "🗡️", category: "klader", slot: "hand", price: 80 },
  // fler kläder
  { id: "vintermossa", name: "Vintermössa", emoji: "🧶", category: "klader", slot: "hatt", price: 30 },
  { id: "strahatt", name: "Stråhatt", emoji: "👒", category: "klader", slot: "hatt", price: 55 },
  { id: "cowboyhatt", name: "Cowboyhatt", emoji: "🤠", category: "klader", slot: "hatt", price: 130 },
  { id: "pilotglasogon", name: "Runda glasögon", emoji: "👓", category: "klader", slot: "ansikte", price: 50 },
  { id: "ogonlapp", name: "Ögonlapp", emoji: "🏴‍☠️", category: "klader", slot: "ansikte", price: 30 },
  { id: "fluga", name: "Fluga", emoji: "🎀", category: "klader", slot: "hals", price: 40 },
  { id: "slips", name: "Slips", emoji: "👔", category: "klader", slot: "hals", price: 45 },
  { id: "blomma", name: "Blomma", emoji: "🌷", category: "klader", slot: "hand", price: 12 },
  { id: "glasstrut", name: "Glasstrut", emoji: "🍦", category: "klader", slot: "hand", price: 28 },
  { id: "bok", name: "Bok", emoji: "📕", category: "klader", slot: "hand", price: 35 },

  // --- Möbler & prylar (placeras i rummet) ---------------------------------
  { id: "stol", name: "Pall", emoji: "🪑", category: "mobler", price: 30 },
  { id: "sang", name: "Säng", emoji: "🛏️", category: "mobler", price: 120 },
  { id: "lampa", name: "Golvlampa", emoji: "🪔", category: "mobler", price: 50 },
  { id: "bokhylla", name: "Bokhylla", emoji: "📚", category: "mobler", price: 100 },
  { id: "dator", name: "Dator", emoji: "🖥️", category: "mobler", price: 200 },
  { id: "tv", name: "TV", emoji: "📺", category: "mobler", price: 180 },
  // `flat: true` = platt golvsak (matta) som alltid ritas UNDERST i rummet, så
  // möbler, dekor och husdjur hamnar ovanpå oavsett placeringsordning. Sätt
  // flaggan på fler mattliknande saker vid behov.
  { id: "matta", name: "Mysmatta", emoji: "🟦", category: "mobler", price: 40, flat: true },
  // fler möbler
  { id: "sittpuff", name: "Sittpuff", emoji: "🛋️", category: "mobler", price: 45 },
  { id: "byra", name: "Byrå", emoji: "🗄️", category: "mobler", price: 95 },
  { id: "skrivbord", name: "Skrivbord", emoji: "🪵", category: "mobler", price: 110 },
  { id: "fatolj", name: "Fåtölj", emoji: "🛋️", category: "mobler", price: 150 },

  // --- Husdjur (placeras i rummet) -----------------------------------------
  // Mystiskt ägg + värmelampa hör till de kläckbara husdjuren (bor i Mitt rum).
  // Köps via buyEgg()/buyHeatLamp() i data-pet.js (uppdaterar studentData.pets).
  { id: "mystery-egg", name: "Mystiskt ägg", emoji: "🥚", category: "husdjur", price: 200 },
  { id: "varmelampa", name: "Värmelampa", emoji: "🔦", category: "husdjur", price: 120 },
  { id: "hund", name: "Hundvalp", emoji: "🐶", category: "husdjur", price: 160 },
  { id: "katt", name: "Kattunge", emoji: "🐱", category: "husdjur", price: 160 },
  { id: "kanin", name: "Kanin", emoji: "🐰", category: "husdjur", price: 130 },
  { id: "fisk", name: "Akvariefisk", emoji: "🐠", category: "husdjur", price: 70 },
  { id: "papegoja", name: "Papegoja", emoji: "🦜", category: "husdjur", price: 220 },
  { id: "dinosaurie", name: "Husdinosaurie", emoji: "🦕", category: "husdjur", price: 500 },
  // fler husdjur
  { id: "hamster", name: "Hamster", emoji: "🐹", category: "husdjur", price: 90 },
  { id: "igelkott", name: "Igelkott", emoji: "🦔", category: "husdjur", price: 120 },
  { id: "skoldpadda", name: "Sköldpadda", emoji: "🐢", category: "husdjur", price: 140 },

  // --- Mat (konsumerbar – läggs på golvet, äts av husdjuren) ----------------
  // Äpplet köps i valfritt ANTAL (ökar studentData.appleCount, hamnar aldrig i
  // ownedItems). Lägg ut det på golvet i Mitt rum → närmaste hungriga djur går
  // dit och äter, och växer efter 10 matningar. Se data-pet.js.
  { id: "apple", name: "Mysterymat", emoji: "🍎", category: "mat", price: 5, consumable: true },

  // --- Dekor & pynt (placeras i rummet) ------------------------------------
  { id: "krukvaxt", name: "Krukväxt", emoji: "🪴", category: "dekor", price: 25 },
  { id: "poster-varld", name: "Världskarta", emoji: "🗺️", category: "dekor", price: 55 },
  { id: "tavla", name: "Tavla", emoji: "🖼️", category: "dekor", price: 65 },
  { id: "stjarnor", name: "Stjärnljus", emoji: "✨", category: "dekor", price: 20 },
  { id: "regnbage", name: "Regnbåge", emoji: "🌈", category: "dekor", price: 85 },
  { id: "akvarium", name: "Akvarium", emoji: "🐟", category: "dekor", price: 140 },
  // fler dekor
  { id: "girlang", name: "Vimpelgirlang", emoji: "🎏", category: "dekor", price: 18 },
  { id: "ballonger", name: "Ballongbukett", emoji: "🎈", category: "dekor", price: 22 },
  { id: "kaktus", name: "Kaktus", emoji: "🌵", category: "dekor", price: 30 },
  { id: "vaggklocka", name: "Väggklocka", emoji: "🕰️", category: "dekor", price: 60 },
];

/** Slå upp en shop-sak på id. */
export function getItem(id) {
  return SHOP_ITEMS.find((it) => it.id === id) || null;
}

/** Är saken en klädsak som bärs på avataren? */
export function isWearable(id) {
  const it = getItem(id);
  return !!(it && it.category === "klader");
}

/** Är saken en platt golvsak (matta) som alltid ska ligga underst i rummet? */
export function isFlatItem(id) {
  const it = getItem(id);
  return !!(it && it.flat);
}

/**
 * Är saken ett VANLIGT djur (hund/katt/kanin …)? De köps i shoppen och blir
 * LEVANDE, promenerande djur i rummet (studentData.roomAnimals via
 * data-animals.js) – inte statiska möbler i room.placements. Ägget och
 * värmelampan hör till mystery-systemet (data-pet.js) och räknas inte hit.
 */
export function isAnimalItem(id) {
  const it = getItem(id);
  return !!(it && it.category === "husdjur" && id !== "mystery-egg" && id !== "varmelampa");
}

/** Är saken en förbrukningsvara (mat) som köps i antal, inte ägs en gång? */
export function isConsumable(id) {
  const it = getItem(id);
  return !!(it && it.consumable);
}

/** Saker i en kategori. */
export function itemsInCategory(catId) {
  return SHOP_ITEMS.filter((it) => it.category === catId);
}
