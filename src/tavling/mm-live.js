// ============================================================================
// Mattematchen – Live-svar räknas in, KLIENTVÄGEN (#847, epic #844)
// ----------------------------------------------------------------------------
// För Live-formaten som skriver sina svar själva under reglerna (Klassmatchen
// via live-data.js submitLiveAnswer, Snilleblixten via snilleblixt-data.js).
// Serverformaten gör samma sak i functions/mattematchen-live.js.
//
//   mmLiveWrites({ uid, classId, attemptId, record, isCorrect }) → Promise<Write[]>
//     MM-delen av svarets batch (planLiveMmWrites, ankaret liveAnswers), eller
//     [] om eleven inte har en aktiv Mattematch där Live-klassen deltar.
//     Tävlingen kommer ur elevens bevakare (ui.getMattematch → mm-watch.js,
//     samma som sidomenyn) – inga läsningar per svar. Kastar aldrig.
//   commitMedMm(writes, mmWrites) → Promise – EN batch med båda. Nekas den
//     (perioden tog nyss slut, tävlingen pausades) skickas Live-svaret om utan
//     MM-delen, så Live-poängen aldrig går förlorad. Live-svarets eget
//     dokument kan bara skapas en gång → MM-delen räknas högst en gång.
//
// Laddas bara via de lata Live-modulerna – aldrig i bootgrafen (#271).
// ============================================================================

import { db } from "../firebase-config.js";
import {
  doc, writeBatch, increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import * as data from "../data.js";
import { getMattematch } from "../ui.js";
import { planLiveMmWrites } from "./answer-writes.js";

const fv = { increment, serverTimestamp };

/** MM-skrivningarna för ett Live-svar i multiplikation (eller []). */
export async function mmLiveWrites({ uid, classId, attemptId, record, isCorrect }) {
  try {
    const m = await getMattematch();
    if (!m?.competition) return [];
    const { mmNow } = await import("./mm-watch.js"); // redan laddad av getMattematch
    const name = data.getSession()?.namn || uid;
    return planLiveMmWrites({ competition: m.competition, now: mmNow(), uid, classId, name, attemptId, record, isCorrect, fv });
  } catch (err) {
    console.warn("Mattematchen (Live): kunde inte planera MM-delen", err);
    return [];
  }
}

function commit(list) {
  const b = writeBatch(db);
  for (const w of list) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}

/** Live-svaret + MM-delen i EN batch; MM-delen nekad → Live-svaret ensamt. */
export async function commitMedMm(writes, mmWrites = []) {
  if (!mmWrites.length) return commit(writes);
  try {
    return await commit([...writes, ...mmWrites]);
  } catch (err) {
    if (err?.code !== "permission-denied") throw err;
    console.warn("Mattematchen (Live): MM-delen nekades – Live-svaret skickas utan", err?.code);
    return commit(writes);
  }
}
