// ============================================================================
// Pluggporten – shop-katalog
// ----------------------------------------------------------------------------
// Alla köpbara saker i shoppen (emoji-rendering – inga externa assets). Id:na
// sparas i Firestore (studentData.ownedItems, room.placements, avatarItems) →
// håll STABILA; lägg gärna till nya, byt aldrig id på befintliga.
// Kategorier: klader (bärs på avataren, en per `slot` hatt/ansikte/hals/hand/
// rygg – rygg ritas BAKOM figuren, avatarMarkup i avatars.js); mobler/husdjur/
// dekor placeras i rummet; mat = KONSUMERBAR (`consumable`, INTE ownedItems, köp
// ökar studentData.appleCount; buy/place/eatApple i data-pet.js). Priser är
// medvetet spridda (billigt → dyrt) för långsiktig motivation.
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
  // Bondgårdsdjur (issue #330, epic Trädgård/Gård): egna LEVANDE djur som bor i
  // farm.animals (data-farm.js) – INTE roomAnimals – och kan placeras i rummet,
  // ute i hagen eller inne i laggården via "Mina djur" (farm.placedAnimals).
  // `farmAnimal: true` skiljer dem från de vanliga djuren (isFarmAnimalItem).
  { id: "animal_horse", name: "Häst", emoji: "🐴", category: "husdjur", price: 250, farmAnimal: true },
  { id: "animal_cow", name: "Ko", emoji: "🐮", category: "husdjur", price: 200, farmAnimal: true },
  { id: "animal_pig", name: "Gris", emoji: "🐷", category: "husdjur", price: 180, farmAnimal: true },

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
  // Mer pynt (#352).
  { id: "nallebjorn", name: "Nallebjörn", emoji: "🧸", category: "dekor", price: 35 },
  { id: "lavalampa", name: "Lavalampa", emoji: "🫧", category: "dekor", price: 75 },
  { id: "discokula", name: "Discokula", emoji: "🪩", category: "dekor", price: 90 },
  { id: "spegel", name: "Golvspegel", emoji: "🪞", category: "dekor", price: 95 },
  { id: "pokal", name: "Guldpokal", emoji: "🏆", category: "dekor", price: 110 },
  { id: "teleskop", name: "Teleskop", emoji: "🔭", category: "dekor", price: 150 },

  // --- Hus (byter husets EXTERIÖR/skal – rummet inuti oförändrat) ------------
  // Köp lägger skal-id:t i ownedItems; aktivt skal väljs i "🏠 Nytt hus"
  // (studentData.husSkalId). Stugan = default/gratis, säljs ej. Item-id ===
  // skal-id i HUS_SKAL-registret (art-hus-ute.js) – håll i synk.
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
  // Lada-SKINS (#353): byter LAGGÅRDENS utseende – samma flöde som husskalen
  // (köp → ownedItems; val i 🛖 Ny lada → farm.barnSkin). Rent kosmetiskt:
  // nivån (#333) styr kapaciteten. Id:n = registret i art-lada-skins.js.
  { id: "lada-bla", name: "Blå sjölada", emoji: "🌊", category: "hus", price: 350, barnSkin: true },
  { id: "lada-godis", name: "Godislada", emoji: "🍬", category: "hus", price: 700, barnSkin: true },
  { id: "lada-rymd", name: "Rymdlada", emoji: "🛸", category: "hus", price: 1200, barnSkin: true },
  // Rums-uppgraderingar: varje köp låser upp ETT extra rum i huset (dörr inne +
  // rumslista i husvärlden). roomUpgrade:true → räknas av getRoomCount() som +1
  // rum; de köps i pris-ordning men ger var och en exakt +1 rum. Se data-room.js.
  { id: "rum-2", name: "Extra rum", emoji: "🚪", category: "hus", price: 250, roomUpgrade: true },
  { id: "rum-3", name: "Tredje rummet", emoji: "🚪", category: "hus", price: 500, roomUpgrade: true },
  { id: "rum-4", name: "Fjärde rummet", emoji: "🚪", category: "hus", price: 800, roomUpgrade: true },

  // --- Trädgård & utomhus (placeras UTE runt huset i ute-vyn, issue #132) ----
  // Multi-kategori (MULTI_CATEGORIES nedan) → man får äga/placera FLERA exemplar.
  // Placeringen sparas i studentData.garden (data-room.js), skild från rummets
  // möbler. `flat:true` (rabatt/parkering/damm) ritas platt mot marken, UNDERST.
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
  // `seed:true` + id = grödans crop-id (STABILA). tradgard-multi → köp ökar
  // ownedCounts[id]; sådden (plantSeed) drar av 1, döljs ur lådan via isSeedItem.
  { id: "crop_carrot", name: "Morotsfrön", emoji: "🥕", category: "tradgard", price: 25, seed: true },
  { id: "crop_clover", name: "Klöverfrön", emoji: "☘️", category: "tradgard", price: 35, seed: true },
  { id: "crop_berries", name: "Magiska bärfrön", emoji: "🫐", category: "tradgard", price: 80, seed: true },
  // Godis-grödor (#349): ALLA husdjur blir glada av dem; ingen är FODER_FOR-favorit.
  { id: "crop_pumpkin", name: "Pumpafrön", emoji: "🎃", category: "tradgard", price: 45, seed: true },
  { id: "crop_lettuce", name: "Salladsfrön", emoji: "🥬", category: "tradgard", price: 20, seed: true },

  // --- Gårds-uppgraderingar (#333): odlingsbädd + laggård – myntsänkorna ------
  // Nivån bor i FÄLTEN farm.gardenTier/farm.barnLevel – ALDRIG härledd ur
  // ownedItems (#331). buyFarmUpgrade (data-farm.js) drar coins + höjer fältet i
  // EN transaktion (inget i ownedItems). `farmUpgrade`=fältet ("garden"|"barn"),
  // `upgradeLevel`=nivån; köps i ordning (2 före 3). Nivå 1 = start, säljs ej.
  { id: "odling-2", name: "Dubbel odlingslåda", emoji: "🪴", category: "tradgard", price: 150, farmUpgrade: "garden", upgradeLevel: 2 },
  { id: "odling-3", name: "Växthus", emoji: "🏡", category: "tradgard", price: 350, farmUpgrade: "garden", upgradeLevel: 3 },
  { id: "lada-2", name: "Röd trälada", emoji: "🛖", category: "tradgard", price: 450, farmUpgrade: "barn", upgradeLevel: 2 },
  { id: "lada-3", name: "Stor herrgårdslaggård", emoji: "🏛️", category: "tradgard", price: 800, farmUpgrade: "barn", upgradeLevel: 3 },
];

// --- Mysteryboxarna (köp & öppna → slumpad kosmetik ur viktad pool) ---------
// Tre nivåer (#186): vanlig 500, Mega 1000, Epic 2000 – samma item-pool men
// olika legendary-chans (legendaryChance styr lottningen, se mystery-items.js).
// Boxarna köps hur många gånger som helst (aldrig "ägd"); öppnandet sker via
// openMysteryBox() (data-mystery.js) och reveal-flödet i pages-shop-mystery.js.
// De läggs SIST i SHOP_ITEMS + kategorin "mystery" är sist i CATEGORIES → de
// hamnar längst ner i shoppen, i pris-ordning. `mysteryBox:true` gör att
// pages-shop.js kör öppna-flödet i stället för ett vanligt köp.
for (const box of MYSTERY_BOXES) {
  SHOP_ITEMS.push({
    id: box.id, name: box.name, emoji: box.emoji, category: "mystery",
    price: box.price, mysteryBox: true, legendaryChance: box.legendaryChance,
  });
}

// Mystery-vinsterna slås in i katalogen så getItem()/isWearable() m.fl. resolvar
// dem överallt. De är mysteryOnly → filtreras bort ur vanliga shoppen
// (itemsInCategory), vinns bara ur boxen, price:0. `existingShopItem`
// (legendary-fordon bil/cykel) finns REDAN i katalogen → hoppas över (ej dubbel).
for (const it of MYSTERY_ITEMS) {
  if (it.existingShopItem) continue;
  SHOP_ITEMS.push({ price: 0, ...it, mysteryOnly: true });
}

/**
 * Rums-uppgraderingarnas id:n i pris-/upplåsningsordning. Antalet ÄGDA av dessa
 * avgör hur många EXTRA rum eleven har (utöver grundrummet) – se getRoomCount()
 * i data-room.js. Håll listan i pris-ordning; håll id:na stabila (Firestore).
 */
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

/** Är saken en HUS-sak (kategori "hus")? Täcker husskal (slott/svamphus …) och
 * rums-uppgraderingar (rum-2/3/4); varld-rum.js filtrerar bort dem ur
 * room.placements med !isHouseItem(id). */
export function isHouseItem(id) {
  const it = getItem(id);
  return !!(it && it.category === "hus");
}

/** Är saken ett VANLIGT djur (hund/katt/kanin …)? Köps i shoppen och blir
 * LEVANDE, promenerande djur i rummet (studentData.roomAnimals via
 * data-animals.js) – inte statiska möbler i room.placements. Ägget och
 * värmelampan hör till mystery-systemet (data-pet.js) och räknas inte hit. */
export function isAnimalItem(id) {
  const it = getItem(id);
  return !!(it && it.category === "husdjur" && !it.farmAnimal && id !== "mystery-egg" && id !== "varmelampa");
}

/** Är saken ett BONDGÅRDSDJUR (häst/ko/gris)? Köps i shoppen som de vanliga
 * djuren men bor i gårdens datamodell (farm.animals, data-farm.js) och kan
 * placeras i rummet, hagen eller laggården ("Mina djur", farm.placedAnimals).
 * Hålls helt isär från roomAnimals (isAnimalItem) och mystery-pets. */
export function isFarmAnimalItem(id) {
  const it = getItem(id);
  return !!(it && it.farmAnimal);
}

/** Är saken en TRÄDGÅRDS-/utomhussak (kategori "tradgard")? Köps i shoppen och
 * placeras UTOMHUS runt huset i ute-vyn (studentData.garden via data-room.js) –
 * inte som möbler i rummet. varld-rum.js filtrerar bort dem ur rums-lådan och
 * room.placements med !isGardenItem(id); varld-tradgard.js äger dem i stället. */
export function isGardenItem(id) {
  const it = getItem(id);
  return !!(it && it.category === "tradgard");
}

/**
 * Är saken ett FRÖ (#329)? Fröer bor i tradgard-kategorin (multi → antal i
 * ownedCounts) men placeras ALDRIG som trädgårdssaker – de sås i gårdens
 * odlingsbädd (varld-odling.js) och förbrukas där. varld-tradgard.js filtrerar
 * bort dem ur placerings-lådan med !isSeedItem(id).
 */
export function isSeedItem(id) {
  const it = getItem(id);
  return !!(it && it.seed);
}

/**
 * Är saken en GÅRDS-UPPGRADERING (#333)? Odlingsbädden/laggården säljs som
 * shop-kort men nivån bor i farm.gardenTier/farm.barnLevel (data-farm.js) –
 * köpet går via buyFarmUpgrade och hamnar ALDRIG i ownedItems/ownedCounts.
 * De placeras heller aldrig (trädgårds-lådan läser bara ownedItems → de dyker
 * aldrig upp där), och de är inte multi-saker trots tradgard-kategorin.
 */
export function isFarmUpgradeItem(id) {
  const it = getItem(id);
  return !!(it && it.farmUpgrade);
}

/** Är saken en förbrukningsvara (mat) som köps i antal, inte ägs en gång? */
export function isConsumable(id) {
  const it = getItem(id);
  return !!(it && it.consumable);
}

/**
 * Kategorier där man får äga/placera FLERA exemplar (t.ex. flera soffor).
 * Antalet per id räknas i studentData.ownedCounts (data.js) i stället för binära
 * ownedItems. VANLIGA djur (isAnimalItem) får också flera men bor i roomAnimals.
 */
const MULTI_CATEGORIES = new Set(["mobler", "dekor", "tradgard"]);

/**
 * Får man äga flera exemplar av den här saken? (möbler & dekor). Mystery-saker
 * är UNIKA samlarobjekt (mysteryOnly) och ägs binärt även om de har en multi-
 * kategori (dekor) – dubbletter omvandlas till coins i stället, se data-mystery.js.
 */
export function isMultiItem(id) {
  const it = getItem(id);
  return !!(it && MULTI_CATEGORIES.has(it.category) && !it.mysteryOnly && !it.farmUpgrade);
}

/** Är saken själva mysteryboxen (köp & öppna → slumpad kosmetik)? */
export function isMysteryBox(id) {
  const it = getItem(id);
  return !!(it && it.mysteryBox);
}

/**
 * En placerings-NYCKEL i room.placements är ett rent sak-id ("soffa") eller
 * "<id>#<n>" ("soffa#2" – extra exemplar). Här plockas sak-id:t ur nyckeln;
 * sak-id:n innehåller aldrig "#", så separatorn är säker (nycklar: varld-rum.js).
 */
export function itemIdFromKey(key) {
  const s = String(key || "");
  const i = s.indexOf("#");
  return i === -1 ? s : s.slice(0, i);
}

/**
 * Köpbara saker i en kategori (för shop-katalogen). Mystery-vinsterna
 * (mysteryOnly) filtreras bort – de säljs aldrig direkt, bara ur boxen.
 */
export function itemsInCategory(catId) {
  return SHOP_ITEMS.filter((it) => it.category === catId && !it.mysteryOnly);
}
