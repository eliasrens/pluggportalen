// ============================================================================
// Live: server-korrigerad klocka (#460) – så 3-2-1-KÖR, tid kvar och matchslut
// blir samma på alla elevdatorer och projektorer, oavsett deras egna klockor.
// ----------------------------------------------------------------------------
// Tre källor, bästa vinner:
//   1. Grov bas: HTTP Date-headern (data-class-lock.js syncServerClock, ±1 s).
//   2. Mätning (NTP-likt): skriv liveClock/{uid}.t = serverTimestamp(), läs
//      tillbaka. Serverns tid S låg mellan sändning T0 och kvittens T1 →
//      offset ≈ S − (T0+T1)/2, fel ≤ halva rundturen. Tre prov, kortast
//      rundtur vinner. Kräver regeln för liveClock (se firestore.rules).
//   3. Undre gräns från varje FÄRSK serverstämpel klienten ser i en snapshot
//      (startedAt, lastAt …): stämpeln S kan inte ligga efter mottagandet R →
//      offset ≥ S − R. Höjer offset om mätningen låg för lågt.
//
// Varför inte bara data-class-lock.js serverNow() (som Mattematchen/fokusläget
// använder)? Den har sekund-upplösning och nollar avvikelser < 5 s – en elev-
// dator som går 3 s före skulle visa KÖR! 3 s för tidigt och få sina första svar
// nekade (reglerna räknar mot request.time). 3-2-1 kräver ~0,1–0,3 s precision.
//
// API
//   serverNow()            → ms (klientens tid + offset)
//   syncLiveClock(uid?)    → Promise<offset>; körs en gång per sida (cachad)
//   noteServerStamp(t)     → matar in en färsk serverstämpel (Timestamp|ms)
//   clockOffset()          → aktuell offset (ms) – för felsökning/preview
// ============================================================================

import { db } from "../firebase-config.js";
import {
  doc, setDoc, getDocFromServer, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { syncServerClock, serverNow as httpNow } from "../data-class-lock.js";
import { toMs } from "./live-core.js";

let offset = 0;
let measured = false;
let lowerBound = -Infinity;
let syncP = null;

export function serverNow() {
  return Date.now() + offset;
}

export function clockOffset() {
  return offset;
}

/** En färsk serverstämpel S sedd NU → offset ≥ S − nu. */
export function noteServerStamp(t) {
  const s = toMs(t);
  if (s == null) return;
  const lb = s - Date.now();
  if (lb > lowerBound) lowerBound = lb;
  if (offset < lowerBound) offset = lowerBound;
}

async function measureOnce(uid) {
  const ref = doc(db, "liveClock", uid);
  const t0 = Date.now();
  await setDoc(ref, { t: serverTimestamp() });
  const t1 = Date.now();
  const snap = await getDocFromServer(ref);
  const s = toMs(snap.get("t"));
  if (s == null) throw new Error("ingen serverstämpel");
  return { est: s - (t0 + t1) / 2, rtt: t1 - t0 };
}

/**
 * Synka klockan (en gång per sidladdning). Fel → HTTP-basen (eller 0).
 * @param {string} [uid] den inloggades uid (liveClock/{uid})
 */
export function syncLiveClock(uid) {
  if (syncP) return syncP;
  syncP = (async () => {
    try {
      await syncServerClock();
      if (!measured) offset = Math.max(httpNow() - Date.now(), lowerBound);
    } catch {}
    if (!uid) return offset;
    let best = null;
    for (let i = 0; i < 3; i++) {
      try {
        const m = await measureOnce(uid);
        if (!best || m.rtt < best.rtt) best = m;
      } catch (err) {
        if (i === 0) console.warn("Live-klockan: mätning misslyckades – använder HTTP-tid", err?.code || err);
        break;
      }
    }
    if (best) {
      measured = true;
      offset = Math.max(Math.round(best.est), lowerBound);
    }
    return offset;
  })();
  return syncP;
}
