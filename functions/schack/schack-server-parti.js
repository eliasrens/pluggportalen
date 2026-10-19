// ============================================================================
// Schack – partiets regellogik, delad av klient och server (#779, Etapp 2A)
// ----------------------------------------------------------------------------
// All regelkontroll går genom chess.js (ingen egen regelkod, §1). Servern
// spelar upp HELA draglistan från utgångsställningen för varje drag, så att
// trefaldig upprepning räknas rätt (en FEN ensam saknar historiken); 40–80
// SAN-drag tar ~1 ms. Kopieras till functions/schack/ av
// admin/sync-schack-functions.mjs tillsammans med vendor/chess.js.
//
//   byggParti(drag)              Chess efter draglistan (kastar på trasig lista)
//   bedomSlut(chess)             { resultat, orsak } | null
//   provaDrag(drag, { from, to, promotion })
//                                → { san, fen, tur, drag, slut } | null (olagligt)
// ============================================================================

import { Chess } from "./vendor/chess.js";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const RUTA = /^[a-h][1-8]$/;
const FORVANDLING = ["q", "r", "b", "n"];

/** Ett parti efter draglistan (SAN). Kastar om ett drag inte går att spela. */
export function byggParti(drag = []) {
  const chess = new Chess();
  for (const san of drag) chess.move(san);
  return chess;
}

/**
 * Är partiet slut i den här ställningen? Resultatet ur vems tur det är:
 * matt = den på tur förlorade. Remi: patt, trefaldig upprepning, 50-drags-
 * regeln eller för lite material (orsak "patt" respektive "remi").
 */
export function bedomSlut(chess) {
  if (chess.isCheckmate()) return { resultat: chess.turn() === "w" ? "0-1" : "1-0", orsak: "matt" };
  if (chess.isStalemate()) return { resultat: "½-½", orsak: "patt" };
  if (chess.isThreefoldRepetition() || chess.isDrawByFiftyMoves() || chess.isInsufficientMaterial()) {
    return { resultat: "½-½", orsak: "remi" };
  }
  return null;
}

/** Rensa klientens drag till { from, to, promotion? } – null om formen är fel. */
export function normaliseraDrag(d) {
  if (!d || typeof d !== "object") return null;
  const from = String(d.from || "").toLowerCase();
  const to = String(d.to || "").toLowerCase();
  if (!RUTA.test(from) || !RUTA.test(to) || from === to) return null;
  const p = d.promotion == null || d.promotion === "" ? null : String(d.promotion).toLowerCase();
  if (p !== null && !FORVANDLING.includes(p)) return null;
  return p ? { from, to, promotion: p } : { from, to };
}

/**
 * Spela draget på partiet `drag` (SAN-lista). Olagligt drag → null, inget
 * ändras. En bonde till sista raden utan promotion blir dam (som brädet).
 * @returns {{ san:string, fen:string, tur:"w"|"b", drag:string[], slut:null|{resultat,orsak} } | null}
 */
export function provaDrag(drag, forslag) {
  const d = normaliseraDrag(forslag);
  if (!d) return null;
  const chess = byggParti(drag);
  let gjort;
  try {
    gjort = chess.move({ from: d.from, to: d.to, promotion: d.promotion || "q" });
  } catch {
    return null;
  }
  if (!gjort) return null;
  return { san: gjort.san, fen: chess.fen(), tur: chess.turn(), drag: [...drag, gjort.san], slut: bedomSlut(chess) };
}
