// ============================================================================
// Pluggporten – shop-katalog
// ----------------------------------------------------------------------------
// Alla köpbara saker i shoppen (emoji-rendering, inga externa assets). Id:na
// sparas i Firestore (ownedItems, room.placements, avatarItems) → håll STABILA;
// lägg gärna till nya, byt aldrig id på befintliga. Kategorier: klader (bärs på
// avataren, en per `slot` hatt/ansikte/hals/hand/rygg – rygg ritas BAKOM
// figuren, avatars.js); mobler/husdjur/dekor placeras i rummet; mat =
// KONSUMERBAR (`consumable`, INTE ownedItems, köp ökar appleCount; data-pet.js).
// Priser spridda (billigt → dyrt); `collection` = säsongsvara (#692, nedan).
// ============================================================================

import { MYSTERY_ITEMS, MYSTERY_BOXES } from "./mystery-items.js";

export const CATEGORIES = [
  { id: "klader", name: "Kläder & accessoarer", emoji: "🎩" },
  { id: "mobler", name: "Möbler & prylar", emoji: "🪑" },
  { id: "husdjur", name: "Husdjur", emoji: "🐾" },
  { id: "mat", name: "Djurmat", emoji: "🍎" },
  { id: "dekor", name: "Dekor & pynt", emoji: "🖼️" },
  { id: "hus", name: "Hus", emoji: "🏠" },
  { id: "tradgard", name: "Trädgård & utomhus", emoji: "🌳" },
  // Mysteryboxen visas SIST i shoppen – CATEGORIES-ordningen styr renderingen.
  { id: "mystery", name: "Mysterybox", emoji: "🎁",
    hint: "Köp en box och öppna den – du får en slumpad kosmetisk sak! Vanliga, ovanliga, sällsynta och (mycket sällsynt) legendariska finns – legendarys kan vara fordon eller hus! Mega- och Epic-boxen ger legendary mycket oftare. Dubbletter blir coins." },
];

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
  // ännu fler kläder (issue #32) – fördelat över alla fyra slots
  { id: "kockmossa", name: "Kockmössa", emoji: "👨‍🍳", category: "klader", slot: "hatt", price: 45 },
  { id: "vikinghjalm", name: "Vikingahjälm", emoji: "⛑️", category: "klader", slot: "hatt", price: 140 },
  { id: "riddarhjalm", name: "Riddarhjälm", emoji: "🪖", category: "klader", slot: "hatt", price: 125 },
  { id: "djuroron", name: "Djuröron", emoji: "🐼", category: "klader", slot: "hatt", price: 35 },
  { id: "mustasch", name: "Mustasch", emoji: "👨", category: "klader", slot: "ansikte", price: 25 },
  { id: "monokel", name: "Monokel", emoji: "🧐", category: "klader", slot: "ansikte", price: 60 },
  { id: "hjartglasogon", name: "Hjärtglasögon", emoji: "😍", category: "klader", slot: "ansikte", price: 45 },
  { id: "snorkelmask", name: "Snorkelmask", emoji: "🤿", category: "klader", slot: "ansikte", price: 55 },
  { id: "parlhalsband", name: "Pärlhalsband", emoji: "📿", category: "klader", slot: "hals", price: 70 },
  { id: "cape", name: "Hjältemantel", emoji: "🦸", category: "klader", slot: "rygg", price: 120 },
  { id: "fjaderboa", name: "Fjäderboa", emoji: "🪶", category: "klader", slot: "hals", price: 50 },
  { id: "amulett", name: "Ädelstensamulett", emoji: "💎", category: "klader", slot: "hals", price: 95 },
  { id: "paraply", name: "Paraply", emoji: "☂️", category: "klader", slot: "hand", price: 40 },
  { id: "gitarr", name: "Gitarr", emoji: "🎸", category: "klader", slot: "hand", price: 130 },
  { id: "fiskespo", name: "Fiskespö", emoji: "🎣", category: "klader", slot: "hand", price: 65 },
  { id: "godisklubba", name: "Godisklubba", emoji: "🍭", category: "klader", slot: "hand", price: 18 },

  // --- Möbler & prylar (placeras i rummet) ---------------------------------
  { id: "stol", name: "Pall", emoji: "🪑", category: "mobler", price: 30 },
  { id: "sang", name: "Säng", emoji: "🛏️", category: "mobler", price: 120 },
  { id: "lampa", name: "Golvlampa", emoji: "🪔", category: "mobler", price: 50 },
  { id: "bokhylla", name: "Bokhylla", emoji: "📚", category: "mobler", price: 100 },
  { id: "dator", name: "Dator", emoji: "🖥️", category: "mobler", price: 200 },
  { id: "tv", name: "TV", emoji: "📺", category: "mobler", price: 180 },
  // `flat: true` = platt golvsak (matta) som alltid ritas UNDERST i rummet så
  // möbler/dekor/husdjur hamnar ovanpå; sätt flaggan på fler mattliknande saker.
  { id: "matta", name: "Mysmatta", emoji: "🟦", category: "mobler", price: 40, flat: true },
  // fler möbler
  { id: "sittpuff", name: "Sittpuff", emoji: "🛋️", category: "mobler", price: 45 },
  { id: "byra", name: "Byrå", emoji: "🗄️", category: "mobler", price: 95 },
  { id: "skrivbord", name: "Skrivbord", emoji: "🪵", category: "mobler", price: 110 },
  { id: "fatolj", name: "Fåtölj", emoji: "🛋️", category: "mobler", price: 150 },
  // fler sängvarianter
  { id: "enkelsang", name: "Enkelsäng", emoji: "🛏️", category: "mobler", price: 90 },
  { id: "vaningsang", name: "Våningssäng", emoji: "🛏️", category: "mobler", price: 170 },
  { id: "hangmatta", name: "Hängmatta", emoji: "🛖", category: "mobler", price: 75 },
  { id: "golvmadrass", name: "Golvmadrass", emoji: "🛌", category: "mobler", price: 55 },
  // ännu fler möbeltyper
  { id: "soffa", name: "Soffa", emoji: "🛋️", category: "mobler", price: 160 },
  { id: "matbord", name: "Matbord", emoji: "🍽️", category: "mobler", price: 115 },
  { id: "gungstol", name: "Gungstol", emoji: "🪑", category: "mobler", price: 85 },
  { id: "garderob", name: "Garderob", emoji: "🚪", category: "mobler", price: 130 },
  { id: "kylskap", name: "Kylskåp", emoji: "🧊", category: "mobler", price: 140 },
  { id: "nattduksbord", name: "Nattduksbord", emoji: "🛎️", category: "mobler", price: 60 },

  // --- Husdjur (placeras i rummet) -----------------------------------------
  // Mystiskt ägg + värmelampa hör till de kläckbara husdjuren (bor i Mitt rum).
  // Köps via buyEgg()/buyHeatLamp() i data-pet.js (uppdaterar studentData.pets).
  { id: "mystery-egg", name: "Mystiskt ägg", emoji: "🥚", category: "husdjur", price: 200 },
  { id: "varmelampa", name: "Värmelampa", emoji: "🔦", category: "husdjur", price: 120 },
  { id: "hund", name: "Hundvalp", emoji: "🐶", category: "husdjur", price: 160 },
  { id: "katt", name: "Kattunge", emoji: "🐱", category: "husdjur", price: 160 },
  { id: "kanin", name: "Kanin", emoji: "🐰", category: "husdjur", price: 130 },
  { id: "fisk", name: "Akvariefisk", emoji: "🐠", category: "husdjur", price: 70 },
  { id: "papegoja", name: "Papegoja", emoji: "🦜", category: "husdjur", price: 185 },
  { id: "dinosaurie", name: "Husdinosaurie", emoji: "🦕", category: "husdjur", price: 190 },
  // fler husdjur
  { id: "hamster", name: "Hamster", emoji: "🐹", category: "husdjur", price: 90 },
  { id: "igelkott", name: "Igelkott", emoji: "🦔", category: "husdjur", price: 120 },
  { id: "skoldpadda", name: "Sköldpadda", emoji: "🐢", category: "husdjur", price: 140 },
  // Bondgårdsdjur (#330): LEVANDE djur i farm.animals (data-farm.js), ej roomAnimals;
  // placeras via "Mina djur" (rum/hage/lada). `farmAnimal:true` → isFarmAnimalItem.
  { id: "animal_horse", name: "Häst", emoji: "🐴", category: "husdjur", price: 250, farmAnimal: true },
  { id: "animal_cow", name: "Ko", emoji: "🐮", category: "husdjur", price: 200, farmAnimal: true },
  { id: "animal_pig", name: "Gris", emoji: "🐷", category: "husdjur", price: 180, farmAnimal: true },

  // --- Mat (konsumerbar – läggs på golvet, äts av husdjuren) ----------------
  // Köps i valfritt ANTAL (studentData.appleCount, aldrig ownedItems); läggs på
  // golvet i Mitt rum → närmaste hungriga djur äter, växer efter 10 (data-pet.js).
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
  // Mer pynt (#352).
  { id: "nallebjorn", name: "Nallebjörn", emoji: "🧸", category: "dekor", price: 35 },
  { id: "lavalampa", name: "Lavalampa", emoji: "🫧", category: "dekor", price: 75 },
  { id: "discokula", name: "Discokula", emoji: "🪩", category: "dekor", price: 90 },
  { id: "spegel", name: "Golvspegel", emoji: "🪞", category: "dekor", price: 95 },
  { id: "pokal", name: "Guldpokal", emoji: "🏆", category: "dekor", price: 110 },
  { id: "teleskop", name: "Teleskop", emoji: "🔭", category: "dekor", price: 150 },

  // --- Hus (byter husets EXTERIÖR/skal – rummet inuti oförändrat) ------------
  // Köp → skal-id i ownedItems; aktivt skal väljs i "🏠 Nytt hus" (husSkalId).
  // Stugan = default/gratis, säljs ej. Item-id === skal-id i HUS_SKAL (art-hus-ute.js).
  { id: "slott", name: "Slott", emoji: "🏰", category: "hus", price: 400, skalId: "slott" },
  { id: "svamphus", name: "Svamphus", emoji: "🍄", category: "hus", price: 300, skalId: "svamphus" },
  // Lyxiga husskal (egen-tecknade, art-hus-lyx.js) – dyra spar-belöningar (1000+).
  { id: "skepp", name: "Skepp", emoji: "⛵", category: "hus", price: 1000, skalId: "skepp" },
  { id: "fotboll", name: "Fotbollshus", emoji: "⚽", category: "hus", price: 1200, skalId: "fotboll" },
  { id: "skyskrapa", name: "Skyskrapa", emoji: "🏢", category: "hus", price: 1500, skalId: "skyskrapa" },
  { id: "glasvilla", name: "Glasvilla", emoji: "🏙️", category: "hus", price: 2000, skalId: "glasvilla" },
  // Fler lyxskal (#350, elevönskemål) – samma register/flöde som ovan.
  { id: "cirkustalt", name: "Cirkustält", emoji: "🎪", category: "hus", price: 1100, skalId: "cirkustalt" },
  { id: "raket", name: "Rymdraket", emoji: "🚀", category: "hus", price: 1300, skalId: "raket" },
  { id: "godishus", name: "Godishus", emoji: "🍭", category: "hus", price: 1600, skalId: "godishus" },
  { id: "vulkan", name: "Vulkanhus", emoji: "🌋", category: "hus", price: 2500, skalId: "vulkan" },
  // Klassiska & natur-husskal (#383, egen-tecknade art-hus-natur.js) – 4 000–6 000.
  { id: "skeppsvrak", name: "Piratkopia (Skeppsvrak)", emoji: "🏴‍☠️", category: "hus", price: 4000, skalId: "skeppsvrak" },
  { id: "tradkoja", name: "Trädkoja", emoji: "🌳", category: "hus", price: 4500, skalId: "tradkoja" },
  { id: "akvariehus", name: "Akvariehus", emoji: "🐠", category: "hus", price: 5000, skalId: "akvariehus" },
  { id: "snoglobshus", name: "Snöglobs-hus", emoji: "❄️", category: "hus", price: 5500, skalId: "snoglobshus" },
  { id: "djungeltempel", name: "Djungeltempel", emoji: "🛕", category: "hus", price: 6000, skalId: "djungeltempel" },
  // Stil & retro-husskal (#384, egen-tecknade art-hus-retro.js) – 6 500–8 500.
  { id: "bibliotekstorn", name: "Bibliotekstorn", emoji: "📚", category: "hus", price: 6500, skalId: "bibliotekstorn" },
  { id: "detektivbyra", name: "Detektivbyrå", emoji: "🔍", category: "hus", price: 7000, skalId: "detektivbyra" },
  { id: "discolokal", name: "Discolokal", emoji: "🪩", category: "hus", price: 7500, skalId: "discolokal" },
  { id: "cyberpunk", name: "Cyberpunk-residens", emoji: "🌆", category: "hus", price: 8000, skalId: "cyberpunk" },
  { id: "trojanskhast", name: "Trojansk häst", emoji: "🐴", category: "hus", price: 8500, skalId: "trojanskhast" },
  // Maskiner & nöje-husskal (#385, egen-tecknade art-hus-noje.js) – 9 000–12 000.
  { id: "tidstorn", name: "Tidstorn (Steampunk)", emoji: "⚙️", category: "hus", price: 9000, skalId: "tidstorn" },
  { id: "gamerhalan", name: "Gamer-hålan", emoji: "🎮", category: "hus", price: 9500, skalId: "gamerhalan" },
  { id: "fruktpalats", name: "Fruktpalats", emoji: "🍍", category: "hus", price: 10000, skalId: "fruktpalats" },
  { id: "arkadhall", name: "Arkadhall", emoji: "🕹️", category: "hus", price: 11000, skalId: "arkadhall" },
  { id: "hajktalt", name: "Hajk-tält (Glamping)", emoji: "⛺", category: "hus", price: 12000, skalId: "hajktalt" },
  // Legendariska husskal (#386, egen-tecknade art-hus-legend-shop.js) – 13 000–15 000.
  { id: "kristallgrotta", name: "Magisk Kristallgrotta", emoji: "💎", category: "hus", price: 13000, skalId: "kristallgrotta" },
  { id: "drakgrotta", name: "Drakgrotta", emoji: "🐲", category: "hus", price: 14000, skalId: "drakgrotta" },
  { id: "manbas", name: "Månbas", emoji: "🌘", category: "hus", price: 14500, skalId: "manbas" },
  { id: "kandisvilla", name: "Kändisvilla (Hollywood-stil)", emoji: "🌟", category: "hus", price: 14800, skalId: "kandisvilla" },
  { id: "maktpyramid", name: "Den Gyllene Svävande Maktpyramiden", emoji: "🔺", category: "hus", price: 15000, skalId: "maktpyramid" },
  // Lada-SKINS (#353): byter LAGGÅRDENS utseende – samma flöde som husskalen
  // (köp → ownedItems; val i 🛖 Ny lada → farm.barnSkin, kosmetiskt; art-lada-skins.js).
  { id: "lada-bla", name: "Blå sjölada", emoji: "🌊", category: "hus", price: 350, barnSkin: true },
  { id: "lada-godis", name: "Godislada", emoji: "🍬", category: "hus", price: 700, barnSkin: true },
  { id: "lada-rymd", name: "Rymdlada", emoji: "🛸", category: "hus", price: 1200, barnSkin: true },
  // Rums-uppgraderingar: varje köp låser upp ETT extra rum (dörr inne + rumslista).
  // roomUpgrade:true → getRoomCount() ger +1 rum styck, köps i pris-ordning (data-room.js).
  { id: "rum-2", name: "Extra rum", emoji: "🚪", category: "hus", price: 250, roomUpgrade: true },
  { id: "rum-3", name: "Tredje rummet", emoji: "🚪", category: "hus", price: 500, roomUpgrade: true },
  { id: "rum-4", name: "Fjärde rummet", emoji: "🚪", category: "hus", price: 800, roomUpgrade: true },

  // --- Trädgård & utomhus (placeras UTE runt huset i ute-vyn, issue #132) ----
  // Multi-kategori (flera exemplar); placering i studentData.garden (data-room.js).
  // `flat:true` (rabatt/parkering/damm) ritas platt mot marken, UNDERST.
  { id: "buske", name: "Buske", emoji: "🌿", category: "tradgard", price: 25 },
  { id: "blomrabatt", name: "Blomrabatt", emoji: "🌷", category: "tradgard", price: 35, flat: true },
  { id: "trad", name: "Träd", emoji: "🌳", category: "tradgard", price: 60 },
  { id: "cykel", name: "Cykel", emoji: "🚲", category: "tradgard", price: 300 },
  { id: "parkering", name: "Parkeringsruta", emoji: "🅿️", category: "tradgard", price: 110, flat: true },
  // Mer till trädgården (#351).
  { id: "damm", name: "Anddamm", emoji: "🦆", category: "tradgard", price: 90, flat: true },
  { id: "gunga", name: "Gungställning", emoji: "🛝", category: "tradgard", price: 150 },
  { id: "fontan", name: "Fontän", emoji: "⛲", category: "tradgard", price: 260 },
  // Fordon är avsiktligt dyra spar-belöningar (perfekt quiz ≈ 50 coins).
  { id: "bil", name: "Bil", emoji: "🚗", category: "tradgard", price: 900 },
  { id: "sportbil", name: "Sportbil", emoji: "🏎️", category: "tradgard", price: 1500 },
  { id: "monstertruck", name: "Monstertruck", emoji: "🛻", category: "tradgard", price: 2000 },

  // --- Fröer (#329): sås i odlingsbädden på GÅRDEN, inte placerbara saker -----
  // `seed:true` + id = crop-id (STABILA); köp ökar ownedCounts, plantSeed drar av 1.
  { id: "crop_carrot", name: "Morotsfrön", emoji: "🥕", category: "tradgard", price: 25, seed: true },
  { id: "crop_clover", name: "Klöverfrön", emoji: "☘️", category: "tradgard", price: 35, seed: true },
  { id: "crop_berries", name: "Magiska bärfrön", emoji: "🫐", category: "tradgard", price: 80, seed: true },
  // Godis-grödor (#349): ALLA husdjur blir glada av dem; ingen är FODER_FOR-favorit.
  { id: "crop_pumpkin", name: "Pumpafrön", emoji: "🎃", category: "tradgard", price: 45, seed: true },
  { id: "crop_lettuce", name: "Salladsfrön", emoji: "🥬", category: "tradgard", price: 20, seed: true },

  // --- Gårds-uppgraderingar (#333): odlingsbädd + laggård – myntsänkorna ------
  // Nivån bor i farm.gardenTier/barnLevel (aldrig ownedItems, #331); buyFarmUpgrade
  // höjer den i EN transaktion. `farmUpgrade`="garden"|"barn", `upgradeLevel` köps
  // i ordning (2 före 3); nivå 1 = start, säljs ej.
  { id: "odling-2", name: "Dubbel odlingslåda", emoji: "🪴", category: "tradgard", price: 150, farmUpgrade: "garden", upgradeLevel: 2 },
  { id: "odling-3", name: "Växthus", emoji: "🏡", category: "tradgard", price: 350, farmUpgrade: "garden", upgradeLevel: 3 },
  { id: "lada-2", name: "Röd trälada", emoji: "🛖", category: "tradgard", price: 450, farmUpgrade: "barn", upgradeLevel: 2 },
  { id: "lada-3", name: "Stor herrgårdslaggård", emoji: "🏛️", category: "tradgard", price: 800, farmUpgrade: "barn", upgradeLevel: 3 },

  // --- 🎃 Halloween-samlingen (#692, epic #689) ------------------------------
  // Vanliga kategorier (placering/inventarie som förut) + `collection` → säljs BARA
  // i Halloween-fliken när isHalloweenActive() (season.js); köpta saker gäller året
  // runt. Konsten laddas lazy (halloween/hw-konst.js, #271). D–F lägger till här.
  { id: "hw-pumpalykta", name: "Pumpalykta", emoji: "🎃", category: "dekor", price: 60, collection: "halloween" },
  { id: "hw-spindelnat", name: "Spindelnät", emoji: "🕸️", category: "dekor", price: 40, collection: "halloween" },
  { id: "hw-fladdermusgirlang", name: "Fladdermusgirlang", emoji: "🦇", category: "dekor", price: 45, collection: "halloween" },
  { id: "hw-godisskal", name: "Skål med godis", emoji: "🍬", category: "dekor", price: 50, collection: "halloween" },
  { id: "hw-haxkvast", name: "Häxkvast", emoji: "🧹", category: "dekor", price: 55, collection: "halloween" },
  { id: "hw-ljusstake", name: "Ljusstake", emoji: "🕯️", category: "dekor", price: 75, collection: "halloween" },
  { id: "hw-spokgardin", name: "Spökgardin", emoji: "👻", category: "dekor", price: 95, collection: "halloween" },
  { id: "hw-skelettfigur", name: "Skelettfigur", emoji: "🦴", category: "dekor", price: 110, collection: "halloween" },
  { id: "hw-kristallkula", name: "Kristallkula", emoji: "🔮", category: "dekor", price: 150, collection: "halloween" },
  { id: "hw-halloweenmatta", name: "Halloweenmatta", emoji: "🟪", category: "mobler", price: 85, flat: true, collection: "halloween" },
  { id: "hw-spoklampa", name: "Spöklampa", emoji: "👻", category: "mobler", price: 120, collection: "halloween" },
  { id: "hw-haxkittel", name: "Häxkittel", emoji: "🧪", category: "mobler", price: 180, collection: "halloween" },
  { id: "hw-pumpahog", name: "Pumpahög", emoji: "🎃", category: "tradgard", price: 60, collection: "halloween" },
  { id: "hw-lovhog", name: "Lövhög", emoji: "🍂", category: "tradgard", price: 70, collection: "halloween" },
  { id: "hw-buu-skylt", name: "Buu!-skylt", emoji: "👻", category: "tradgard", price: 80, collection: "halloween" },
  { id: "hw-halmbal", name: "Halmbal med pumpor", emoji: "🌾", category: "tradgard", price: 110, collection: "halloween" },
  { id: "hw-haxbrevlada", name: "Häxhattsbrevlåda", emoji: "📫", category: "tradgard", price: 130, collection: "halloween" },
  { id: "hw-fagelskramma", name: "Fågelskrämma", emoji: "🌾", category: "tradgard", price: 140, collection: "halloween" },
  { id: "hw-pumpastolpe", name: "Lyktstolpe med pumpa", emoji: "🏮", category: "tradgard", price: 180, collection: "halloween" },
  { id: "hw-lysvampar", name: "Lysande svampar", emoji: "🍄", category: "tradgard", price: 300, collection: "halloween" },
  { id: "hw-spokhus", name: "Gulligt spökhus", emoji: "🏚️", category: "hus", price: 4000, skalId: "hw-spokhus", collection: "halloween" },
  { id: "hw-pumpahus", name: "Pumpahus", emoji: "🎃", category: "hus", price: 4000, skalId: "hw-pumpahus", collection: "halloween" },
  { id: "hw-skallehus", name: "Snällt döskallehus", emoji: "🏠", category: "hus", price: 4000, skalId: "hw-skallehus", collection: "halloween" },
];

// --- Mysteryboxarna (köp & öppna → slumpad kosmetik ur viktad pool) ---------
// Tre nivåer (#186) med olika legendaryChance (mystery-items.js); köps hur många
// gånger som helst, öppnas via openMysteryBox (data-mystery.js) + pages-shop-
// mystery.js. Läggs SIST (kategorin "mystery" sist) → längst ner i shoppen.
for (const box of MYSTERY_BOXES) {
  SHOP_ITEMS.push({
    id: box.id, name: box.name, emoji: box.emoji, category: "mystery",
    price: box.price, mysteryBox: true, legendaryChance: box.legendaryChance,
  });
}

// Mystery-vinsterna slås in så getItem() m.fl. resolvar dem; mysteryOnly → aldrig
// i vanliga shoppen. `existingShopItem` (bil/cykel) finns redan → hoppas över.
for (const it of MYSTERY_ITEMS) {
  if (it.existingShopItem) continue;
  SHOP_ITEMS.push({ price: 0, ...it, mysteryOnly: true });
}

// Rums-uppgraderingarnas id:n i pris-/upplåsningsordning; antalet ÄGDA = antal
// EXTRA rum utöver grundrummet (getRoomCount, data-room.js). Id:na STABILA.
export const ROOM_UPGRADE_IDS = ["rum-2", "rum-3", "rum-4"];

/** Är saken en rums-uppgradering (låser upp ett extra rum)? */
export function isRoomUpgrade(id) {
  const it = getItem(id);
  return !!(it && it.roomUpgrade);
}

/** Hur många EXTRA rum en ownedItems-lista låst upp (0 = bara grundrummet). */
export function roomUpgradeCount(ownedItems) {
  if (!Array.isArray(ownedItems)) return 0;
  return ROOM_UPGRADE_IDS.filter((id) => ownedItems.includes(id)).length;
}

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

/** HUS-sak (kategori "hus": husskal + rums-uppgraderingar)? varld-rum.js
 * filtrerar bort dem ur room.placements med !isHouseItem(id). */
export function isHouseItem(id) {
  const it = getItem(id);
  return !!(it && it.category === "hus");
}

/** VANLIGT djur (hund/katt …)? Blir levande djur i roomAnimals (data-animals.js),
 * inte statiska möbler. Ägget/värmelampan (mystery, data-pet.js) räknas inte. */
export function isAnimalItem(id) {
  const it = getItem(id);
  return !!(it && it.category === "husdjur" && !it.farmAnimal && id !== "mystery-egg" && id !== "varmelampa");
}

/** BONDGÅRDSDJUR (häst/ko/gris, #330)? Bor i farm.animals (data-farm.js) och
 * placeras via "Mina djur" – helt isär från roomAnimals och mystery-pets. */
export function isFarmAnimalItem(id) {
  const it = getItem(id);
  return !!(it && it.farmAnimal);
}

/** TRÄDGÅRDS-sak (kategori "tradgard")? Placeras UTE (studentData.garden,
 * varld-tradgard.js), aldrig i rummet (varld-rum.js filtrerar !isGardenItem). */
export function isGardenItem(id) {
  const it = getItem(id);
  return !!(it && it.category === "tradgard");
}

/** FRÖ (#329)? tradgard-multi (antal i ownedCounts) men sås i gårdens odlings-
 * bädd (varld-odling.js) – varld-tradgard.js döljer dem med !isSeedItem. */
export function isSeedItem(id) {
  const it = getItem(id);
  return !!(it && it.seed);
}

/** GÅRDS-UPPGRADERING (#333)? Nivån bor i farm.gardenTier/barnLevel (köps via
 * buyFarmUpgrade) – aldrig ownedItems/ownedCounts, aldrig placerbar, ej multi. */
export function isFarmUpgradeItem(id) {
  const it = getItem(id);
  return !!(it && it.farmUpgrade);
}

/** Är saken en förbrukningsvara (mat) som köps i antal, inte ägs en gång? */
export function isConsumable(id) {
  const it = getItem(id);
  return !!(it && it.consumable);
}

// Kategorier där man får äga/placera FLERA exemplar (antal per id i
// studentData.ownedCounts, data.js). Vanliga djur får också flera (roomAnimals).
const MULTI_CATEGORIES = new Set(["mobler", "dekor", "tradgard"]);

/** Får man äga flera exemplar (möbler/dekor/trädgård)? Mystery-saker är UNIKA
 * samlarobjekt (dubbletter → coins, data-mystery.js), uppgraderingar likaså. */
export function isMultiItem(id) {
  const it = getItem(id);
  return !!(it && MULTI_CATEGORIES.has(it.category) && !it.mysteryOnly && !it.farmUpgrade);
}

/** Är saken själva mysteryboxen (köp & öppna → slumpad kosmetik)? */
export function isMysteryBox(id) {
  const it = getItem(id);
  return !!(it && it.mysteryBox);
}

/** Sak-id ur en placerings-NYCKEL: "soffa" eller "soffa#2" (extra exemplar).
 * Sak-id:n innehåller aldrig "#" (nycklar: varld-rum.js). */
export function itemIdFromKey(key) {
  const s = String(key || "");
  const i = s.indexOf("#");
  return i === -1 ? s : s.slice(0, i);
}

/** Säsongssamlingen en sak hör till ("halloween") eller null (#692). */
export function itemCollection(id) {
  const it = getItem(id);
  return (it && it.collection) || null;
}

/** Köpbara saker i en kategoriflik: mystery-vinster (bara ur boxen) och
 * samlingsvaror (bara i sin säsongsflik, se itemsInCollection) räknas inte. */
export function itemsInCategory(catId) {
  return SHOP_ITEMS.filter((it) => it.category === catId && !it.mysteryOnly && !it.collection);
}

/** Köpbara saker i en säsongssamling (#692), i katalogordning. */
export function itemsInCollection(col) {
  return SHOP_ITEMS.filter((it) => it.collection === col && !it.mysteryOnly);
}
/** Lazy katalogtillägg (#693 kostymer via halloween/hw-konst.js): nya id:n läggs till, befintliga lämnas. */
export const registerShopItems = (items) => items.forEach((it) => getItem(it.id) || SHOP_ITEMS.push(it));
