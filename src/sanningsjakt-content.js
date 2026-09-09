// ============================================================================
// Pluggportalen – sanningsjakt-content.js
// Innehållshärledning för arkad-läget "Fånga sanningar" (games-sanningsjakt.js).
// Browser-fritt och rent → enhetstestbart. Bygger balanserade (~50/50) sant/
// falskt-påståenden ur områdets fakta-par, med quiz som fallback, och matar ut
// dem ett i taget utan snabb upprepning.
//
//   • par ({term,definition}): rätt parning = sant "<term> – <def>" (tankstreck),
//     felparad definition = falskt. Kräver minst 2 textpar (för att kunna felpara).
//   • fallback quiz: rätt alternativ = sant, distraktor = falskt.
// ============================================================================

// OBS: håll den här modulen browser-fri (ingen import från game-shared/ui) så
// den kan enhetstestas i Node (jfr question-rotation.js). Egen shuffle nedan.

/** Blanda en array (kopia, Fisher–Yates). */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Textuella par (både term och definition som text – inga bildpar). */
export function textualPairs(areaData) {
  return (areaData?.pairs || []).filter(
    (p) => p && p.term && p.definition && !p.termImage && !p.defImage
  );
}

/**
 * Kan området härleda påståenden? (minst 2 textpar ELLER minst en quiz-fråga).
 * Används av gamemodes.js för att visa/dölja kortet.
 */
export function hasSanningsjaktContent(areaData) {
  if (textualPairs(areaData).length >= 2) return true;
  // Bara frågor utan passage kan bli påståenden (se buildStatements).
  const quiz = Array.isArray(areaData?.quiz) ? areaData.quiz : [];
  return quiz.some((q) => !(q && typeof q.passage === "string" && q.passage.trim()));
}

/**
 * Bygg en balanserad (~50/50) kortlek med påståenden {text, sub?, truth}.
 * Föredrar par; annars quiz. Returnerar [] om inget kan härledas.
 */
export function buildStatements(areaData) {
  const pairs = textualPairs(areaData);
  const out = [];
  if (pairs.length >= 2) {
    pairs.forEach((p, i) => {
      // Tankstreck-form "<term> – <def>" (EN DASH U+2013, ett mellanslag på var sida).
      out.push({ text: `${p.term} – ${p.definition}`, truth: true });
      // Felpara med en ANNAN definition → falskt.
      let j = i;
      while (j === i) j = Math.floor(Math.random() * pairs.length);
      out.push({ text: `${p.term} – ${pairs[j].definition}`, truth: false });
    });
    return out;
  }
  // Bara RÄKNE-/vanliga frågor (utan passage): en läsförståelse-fråga bygger på en
  // källtext som inte visas här, så den skulle ge ett obegripligt påstående.
  const quiz = (Array.isArray(areaData?.quiz) ? areaData.quiz : []).filter(
    (q) => !(q && typeof q.passage === "string" && q.passage.trim())
  );
  quiz.forEach((q) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    const answer = opts[q.answerIndex];
    if (answer == null) return;
    const distractors = opts.filter((_, i) => i !== q.answerIndex);
    out.push({ sub: q.question, text: String(answer), truth: true });
    if (distractors.length) {
      const d = distractors[Math.floor(Math.random() * distractors.length)];
      out.push({ sub: q.question, text: String(d), truth: false });
    }
  });
  return out;
}

/**
 * Fabrik som matar ut ett påstående i taget: blandar kortleken, går igenom den
 * och undviker att samma text kommer tillbaka för snabbt (kort minne).
 * @returns {() => ({text:string, sub?:string, truth:boolean}|null)}
 */
export function statementFeeder(deck) {
  if (!deck || deck.length === 0) return () => null;
  let queue = shuffle(deck);
  let qi = 0;
  const recent = [];
  const memory = Math.min(6, Math.max(2, deck.length - 2));
  return function next() {
    for (let tries = 0; tries < queue.length; tries++) {
      if (qi >= queue.length) {
        queue = shuffle(deck);
        qi = 0;
      }
      const cand = queue[qi++];
      if (!recent.includes(cand.text)) {
        recent.push(cand.text);
        if (recent.length > memory) recent.shift();
        return cand;
      }
    }
    return queue[0]; // säkerhetsnät (mycket liten kortlek)
  };
}
