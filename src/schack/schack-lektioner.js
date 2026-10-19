// ============================================================================
// Guiden "Lär dig schack" – lektionerna som data (#790, spec §12). Ren modul:
// texterna, uppgifterna, stjärnregeln, bedömningen av ett drag och
// framstegen (studentData.schack.lektioner). Ritas av schack-lektion-vy.js.
//
// Fyra sorters lektioner:
//   "fragor"    tryck på rätt ruta (lektion 1) – varje tryck räknas
//   "jakt"      en pjäs samlar stjärnor/tar svarta pjäser (2–8) – schack-stjarnjakt.js
//   "stallning" en riktig ställning, ett drag som ska uppfylla ett krav (9–11) – chess.js
//   "parti"     ett helt parti mot Bonden (12) – schack-dator-vy.js
//
// Stjärnorna (1–3): för fragor/jakt/stallning räknas "drag" = varje tryck/drag
// eleven gjort, även de som var fel och hoppade tillbaka; `min` = minsta möjliga
// (jakt: BFS, test/schack-guide.test.js kontrollerar talen; annars en per uppgift).
// Partiet: vinst 3, remi 2, förlust 1; att ge upp räknas inte som klarat.
// ============================================================================

import { Chess } from "./vendor/chess.js";

export const ANTAL_LEKTIONER = 12;

/** Hur många drag över minsta möjliga som ändå ger två stjärnor. */
export function tolerans(min) {
  return Math.max(2, Math.round(min * 0.25));
}

/** 1–3 stjärnor efter antal drag (eller tryck) jämfört med minsta möjliga. */
export function stjarnorEfterDrag(drag, min) {
  if (drag <= min) return 3;
  return drag <= min + tolerans(min) ? 2 : 1;
}

/** Partiet (lektion 12): vinst 3, remi 2, förlust 1, gav upp = inte klarad (0). */
export function stjarnorEfterParti(slut, egenFarg) {
  if (!slut || slut.orsak === "gav-upp") return 0;
  if (!slut.vinnare) return 2;
  return slut.vinnare === egenFarg ? 3 : 1;
}

const J = (pjas, fran, stjarnor, min, extra = {}) => ({ pjas, fran, stjarnor, min, ...extra });
const svart = (ruta, typ) => ({ ruta, typ });
const KOLUMN = (f) => [1, 2, 3, 4, 5, 6, 7, 8].map((r) => f + r);
const RAD = (r) => [..."abcdefgh"].map((f) => f + r);

export const LEKTIONER = [
  {
    nr: 1, titel: "Brädet", ikon: ["b", "b"], typ: "fragor",
    intro: "Schackbrädet har 64 rutor. Kolumnerna heter a–h (från vänster) och raderna 1–8 (nerifrån). " +
      "En ruta heter kolumnen + raden, till exempel e4. Vit börjar alltid på rad 1 och 2, svart på rad 7 och 8.",
    uppgifter: [
      { text: "Tryck på rutan e4.", svar: ["e4"] },
      { text: "Tryck på rutan a8 – hörnet längst upp till vänster.", svar: ["a8"] },
      { text: "Tryck på en ruta i kolumn c.", svar: KOLUMN("c") },
      { text: "Tryck på en ruta på rad 5.", svar: RAD(5) },
      { text: "Tryck på den vita damen. Tips: damen står på sin egen färg.", svar: ["d1"] },
      { text: "Tryck på den svarta kungen.", svar: ["e8"] },
      { text: "Tryck på en vit springare (hästen).", svar: ["b1", "g1"] },
    ],
  },
  {
    nr: 2, titel: "Tornet", ikon: ["w", "r"], typ: "jakt",
    intro: "Tornet går rakt – framåt, bakåt eller åt sidan – så långt det vill, men kan inte hoppa över pjäser.",
    uppgifter: [
      J("r", "a1", ["a5", "e5", "e8"], 3),
      J("r", "c2", ["c7", "g7", "g2", "e4"], 5, { egna: ["c5", "f4"], text: "Dina bönder står i vägen – tornet kan inte hoppa över dem." }),
    ],
  },
  {
    nr: 3, titel: "Löparen", ikon: ["w", "b"], typ: "jakt",
    intro: "Löparen går snett, så långt den vill. Den stannar alltid på samma färg som den började på.",
    uppgifter: [
      J("b", "c1", ["f4", "h6"], 2),
      J("b", "f1", ["b5", "e8", "h5", "d1"], 4),
    ],
  },
  {
    nr: 4, titel: "Damen", ikon: ["w", "q"], typ: "jakt",
    intro: "Damen är den starkaste pjäsen. Hon går som tornet och löparen tillsammans: rakt och snett, så långt hon vill.",
    uppgifter: [
      J("q", "d1", ["d6", "h2", "a5"], 4),
      J("q", "a1", ["h8", "h1", "a8", "d5", "e3"], 6, { egna: ["d4"] }),
    ],
  },
  {
    nr: 5, titel: "Kungen", ikon: ["w", "k"], typ: "jakt",
    intro: "Kungen är den viktigaste pjäsen men går bara ett steg i taget – åt vilket håll som helst.",
    uppgifter: [
      J("k", "e1", ["d2", "e3", "f2"], 3),
      J("k", "d4", ["c5", "e5", "e3"], 5),
    ],
  },
  {
    nr: 6, titel: "Springaren", ikon: ["w", "n"], typ: "jakt",
    intro: "Springaren hoppar som ett L: två steg rakt och ett åt sidan. Den är den enda pjäsen som kan hoppa över andra.",
    uppgifter: [
      J("n", "b1", ["c3", "d5", "f6"], 3),
      J("n", "g1", ["g3", "e4", "c5", "a6"], 5),
    ],
  },
  {
    nr: 7, titel: "Bonden", ikon: ["w", "p"], typ: "jakt",
    intro: "Bonden går ett steg rakt fram – från startraden får den gå två. Den går aldrig bakåt, och den tar snett framåt.",
    uppgifter: [
      J("p", "e2", ["e4", "e5", "e6"], 3),
      J("p", "c2", [], 4, {
        fiender: [svart("d4", "p"), svart("e5", "p"), svart("d6", "p")],
        text: "Ta de svarta bönderna! Bonden tar snett framåt – ett steg.",
      }),
    ],
  },
  {
    nr: 8, titel: "Ta pjäser", ikon: ["b", "r"], typ: "jakt",
    intro: "Du tar en pjäs genom att flytta till rutan där den står – då åker den av brädet. " +
      "Pjäserna är olika mycket värda: bonde 1, springare och löpare 3, torn 5, dam 9.",
    uppgifter: [
      J("n", "e4", [], 3, { fiender: [svart("c5", "p"), svart("b7", "b"), svart("d8", "r")], text: "Ta alla svarta pjäser med springaren." }),
      J("q", "d1", [], 5, {
        fiender: [svart("d7", "n"), svart("h5", "b"), svart("a4", "p"), svart("d4", "r")],
        text: "Ta alla svarta pjäser med damen. Tornet står i vägen för springaren!",
      }),
    ],
  },
  {
    nr: 9, titel: "Schack", ikon: ["w", "k"], typ: "stallning",
    intro: "När en pjäs hotar kungen står kungen i schack. Då måste du rädda den direkt. " +
      "Det finns tre sätt: flytta kungen, ta pjäsen som ger schack, eller ställ en pjäs emellan.",
    uppgifter: [
      { fen: "k3r3/8/8/8/8/8/8/4K3 w - - 0 1", krav: "kung", text: "Tornet ger schack! Flytta kungen till en säker ruta." },
      { fen: "k7/8/8/8/4r3/8/2B5/4K3 w - - 0 1", krav: "ta", text: "Schack igen! Ta tornet med löparen." },
      { fen: "4r2k/8/8/8/8/R7/8/4K3 w - - 0 1", krav: "emellan", text: "Schack! Ställ ditt torn emellan kungen och det svarta tornet." },
    ],
  },
  {
    nr: 10, titel: "Schack matt och patt", ikon: ["b", "k"], typ: "stallning",
    intro: "Schack matt: kungen står i schack och kan inte räddas – då är partiet slut och du har vunnit. " +
      "Patt: den som ska flytta står inte i schack men har inget lagligt drag – då blir det remi. Akta dig för patt!",
    uppgifter: [
      { fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", krav: "matt", text: "Gör schack matt i ett drag med tornet." },
      { fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1", krav: "matt", text: "Gör schack matt med damen. Akta dig – ett av dragen blir patt!" },
      { fen: "k7/8/1K6/8/8/8/8/2Q5 w - - 0 1", krav: "matt", text: "Gör schack matt en gång till. Kungen hjälper damen." },
    ],
  },
  {
    nr: 11, titel: "Specialdragen", ikon: ["w", "r"], typ: "stallning",
    intro: "Tre drag är lite speciella: rockad (kungen och tornet flyttar samtidigt), en passant (en bonde tar en bonde som " +
      "precis gått två steg förbi den) och bondeförvandling (en bonde som når sista raden blir en annan pjäs).",
    uppgifter: [
      {
        fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1", krav: "rockad",
        text: "Gör rockad: kungen går två steg mot ett torn, och tornet hoppar över.",
      },
      {
        fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2", krav: "enpassant", senast: { from: "d7", to: "d5" },
        text: "Svart gick just d7–d5. Ta den en passant: din bonde går snett till d6.",
      },
      { fen: "4k3/1P6/8/8/8/8/8/4K3 w - - 0 1", krav: "forvandling", text: "Flytta bonden till sista raden och välj vad den ska bli." },
    ],
  },
  {
    nr: 12, titel: "Ditt första parti", ikon: ["b", "p"], typ: "parti",
    intro: "Nu spelar du ett helt parti mot Bonden, den lättaste datorn. Du har vit och börjar. " +
      "Ångra, Tips och Varna mig finns om du vill. Vinst ger tre stjärnor, remi två och förlust en – bara du spelar klart.",
    uppgifter: [],
  },
];

export function lektionFor(nr) {
  return LEKTIONER.find((l) => l.nr === Number(nr)) || null;
}

/** Minsta antal drag/tryck för hela lektionen (summan över uppgifterna). */
export function minFor(lektion) {
  if (lektion.typ === "jakt") return lektion.uppgifter.reduce((s, u) => s + u.min, 0);
  return lektion.uppgifter.length;
}

const FEL = {
  kung: "Kungen är räddad – men nu ska du flytta själva kungen. Prova igen!",
  ta: "Kungen är räddad – men prova att TA tornet med löparen.",
  emellan: "Kungen är räddad – men prova att ställa tornet emellan.",
  matt: "Det var inte matt – kungen kan fly eller räddas. Prova igen!",
  rockad: "Det var inte rockad. Flytta kungen två steg åt sidan.",
  enpassant: "Det var inte en passant. Flytta bonden på e5 snett till d6.",
  forvandling: "Flytta bonden ända fram till sista raden.",
};
const RATT = {
  kung: "Rätt! Kungen gick undan.",
  ta: "Rätt! Pjäsen som gav schack är borta.",
  emellan: "Rätt! Tornet skyddar kungen.",
  matt: "Schack matt! Kungen kan inte räddas.",
  rockad: "Rätt! Det var rockad – kungen står säkert och tornet kommer ut.",
  enpassant: "Rätt! Bonden tog en passant – den svarta bonden försvann från d5.",
  forvandling: "Rätt! Bonden förvandlades.",
};

/**
 * Uppfyller elevens drag uppgiftens krav? `drag` = brädets dragobjekt
 * ({ piece, captured, flags, san, efter }). → { ok, text }.
 */
export function bedomDrag(uppgift, drag) {
  const f = drag.flags || "";
  const ok = {
    kung: () => drag.piece === "k",
    ta: () => !!drag.captured,
    emellan: () => drag.piece !== "k" && !drag.captured,
    matt: () => drag.san.includes("#"),
    rockad: () => f.includes("k") || f.includes("q"),
    enpassant: () => f.includes("e"),
    forvandling: () => f.includes("p"),
  }[uppgift.krav]?.() ?? false;
  if (ok) return { ok: true, text: RATT[uppgift.krav] };
  if (uppgift.krav === "matt") {
    try {
      if (new Chess(drag.efter).isStalemate()) {
        return { ok: false, text: "Oj, patt! Svart står inte i schack men kan inte flytta – då blir det remi. Prova ett annat drag." };
      }
    } catch { /* ogiltig FEN – vanligt felsvar */ }
  }
  return { ok: false, text: FEL[uppgift.krav] || "Prova igen!" };
}

/**
 * Framstegen ur studentData.schack.lektioner i säker form: { "1": 3, … } med bara
 * kända lektioner och heltal 1–3 (trasiga värden kastas).
 */
export function normaliseraLektioner(m) {
  const ut = {};
  if (!m || typeof m !== "object") return ut;
  for (const l of LEKTIONER) {
    const v = m[String(l.nr)];
    if (Number.isInteger(v) && v >= 1 && v <= 3) ut[String(l.nr)] = v;
  }
  return ut;
}

/** Ska resultatet sparas? Bara när det är bättre än det sparade (stjärnor sänks aldrig). */
export function arForbattring(lektioner, nr, stjarnor) {
  return Number.isInteger(stjarnor) && stjarnor >= 1 && stjarnor <= 3 && stjarnor > (lektioner?.[String(nr)] || 0);
}

/** Summan av stjärnorna och hur många lektioner som är klara. */
export function summa(lektioner) {
  const v = Object.values(normaliseraLektioner(lektioner));
  return { stjarnor: v.reduce((s, x) => s + x, 0), klara: v.length, max: ANTAL_LEKTIONER * 3 };
}

/**
 * Loppet genom en lektion (fragor/jakt/stallning) utan DOM – vyn ritar, loppet räknar.
 *   tryck(ruta)      fråga: → { ratt, uppgiftKlar, lektionKlar }
 *   drag(dragInfo)   ställning: → { ok, text, lektionKlar }   (fel drag räknas också)
 *   jaktKlar(antal)  jakt: uppgiften klar på `antal` drag → { lektionKlar }
 *   nasta()          till nästa uppgift (efter uppgiftKlar)
 *   resultat()       { stjarnor, drag, min } när lektionen är klar
 */
export function skapaLopp(lektion) {
  let steg = 0;
  let antal = 0;
  let klar = false;
  let uppgiftKlar = false;
  const sista = () => steg >= lektion.uppgifter.length - 1;
  const avsluta = () => {
    uppgiftKlar = true;
    if (sista()) klar = true;
    return klar;
  };
  return {
    get steg() { return steg; },
    get antal() { return antal; },
    get klar() { return klar; },
    get uppgiftKlar() { return uppgiftKlar; },
    uppgift: () => lektion.uppgifter[steg],
    sista,
    tryck(ruta) {
      if (klar || uppgiftKlar) return { ratt: false, lektionKlar: klar };
      antal++;
      const ratt = lektion.uppgifter[steg].svar.includes(ruta);
      if (!ratt) return { ratt, lektionKlar: false };
      const lk = avsluta();
      if (!lk) { steg++; uppgiftKlar = false; } // frågorna går direkt vidare
      return { ratt, uppgiftKlar: true, lektionKlar: lk };
    },
    drag(d) {
      if (klar || uppgiftKlar) return { ok: false, text: "", lektionKlar: klar };
      antal++;
      const b = bedomDrag(lektion.uppgifter[steg], d);
      return { ...b, lektionKlar: b.ok ? avsluta() : false };
    },
    jaktKlar(n) {
      if (klar || uppgiftKlar) return { lektionKlar: klar };
      antal += n;
      return { lektionKlar: avsluta() };
    },
    nasta() {
      if (!uppgiftKlar || klar) return false;
      steg++;
      uppgiftKlar = false;
      return true;
    },
    resultat() {
      const min = minFor(lektion);
      return { stjarnor: klar ? stjarnorEfterDrag(antal, min) : 0, drag: antal, min };
    },
  };
}
