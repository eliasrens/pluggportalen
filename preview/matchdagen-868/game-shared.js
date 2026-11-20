// Förhandsvisningen #868: game-shared.js drar in Firebase och hela appens UI.
// Frågekällorna behöver bara de två rena funktionerna – samma kod som i
// src/game-shared.js (testet test/matchdagen-fragor.test.js kör originalen).
export function hasPassage(q) {
  return !!(q && typeof q.passage === "string" && q.passage.trim());
}
export function plainQuizPool(quiz) {
  const arr = Array.isArray(quiz) ? quiz : [];
  const plain = arr.filter((q) => !hasPassage(q));
  return plain.length > 0 ? plain : arr;
}
