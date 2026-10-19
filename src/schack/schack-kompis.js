// ============================================================================
// Schack mot en kompis – lyssnaren på klassdokumentet (#780, §7.1, §9).
// ----------------------------------------------------------------------------
// EN onSnapshot på schackKlass/{classId} (moln.lyssnaKlass), delad av allt på
// schacksidan som behöver lobbyn: startsidan, lobbyn, partiet mot datorn
// (utmaningsrutan) och flödets "kom tillbaka till partiet". Den öppnas när
// första vyn vill ha den och stängs:
//   - direkt med stangKompis() när eleven lämnar schacksidan (route-byte,
//     utloggning, pagehide) – en egen väntan tas då bort (schackSlutaVanta);
//   - LAT_STANG_MS efter att sista vyn släppt den (t.ex. när ett kompisparti
//     öppnas – partiet har sin egen lyssnare). En vy som byts mot en annan
//     inom schacksidan återanvänder alltså samma lyssnare (ingen ny läsning).
//
//   const sluta = bevakaKlass(k, (klass) => …, (fel) => …);   sluta();
//   k = { moln: () => Promise<moln>, classId, uid }
// ============================================================================

export { partiFor } from "./schack-server-delat.js";

export const LAT_STANG_MS = 2_000;

let bev = null; // { classId, uid, k, stopp, klass, fns: Map<fn, onFel>, timer, stangd }
const lamnade = new Set(); // partier eleven lämnat – flödet hoppar inte tillbaka in i dem

/** Anropa fn utan att ett fel i en vy stoppar de andra. */
function sakert(fn, ...args) {
  try {
    fn(...args);
  } catch (e) {
    console.error("schack: fel i lobbyns lyssnare", e);
  }
}

function starta(k) {
  const b = { classId: k.classId, uid: k.uid, k, stopp: null, klass: null, fns: new Map(), timer: null, stangd: false, fel: null };
  bev = b;
  Promise.resolve()
    .then(() => k.moln())
    .then((moln) => {
      if (b.stangd) return;
      b.moln = moln;
      b.stopp = moln.lyssnaKlass(k.classId, (klass) => {
        b.klass = klass;
        b.fel = null;
        for (const fn of [...b.fns.keys()]) sakert(fn, klass);
      }, (err) => {
        b.fel = err || new Error("lobbyn kunde inte läsas");
        for (const onFel of [...b.fns.values()]) if (onFel) sakert(onFel, b.fel);
      });
    })
    .catch((err) => {
      if (b.stangd) return;
      b.fel = err;
      for (const onFel of [...b.fns.values()]) if (onFel) sakert(onFel, err);
    });
  return b;
}

/** Stäng lyssnaren; returnerar löftet om schackSlutaVanta (eller ett uppfyllt löfte). */
function stang(b, { slutaVanta }) {
  if (!b || b.stangd) return Promise.resolve(false);
  b.stangd = true;
  clearTimeout(b.timer);
  try { b.stopp?.(); } catch { /* redan stängd */ }
  b.stopp = null;
  if (bev === b) bev = null;
  // Väntan tas bort när eleven lämnar sidan "om det går" (§7.1) – annars går den ut efter 10 min.
  if (slutaVanta && b.moln && b.klass?.vantar && Object.hasOwn(b.klass.vantar, b.uid)) {
    return b.moln.lobby.slutaVanta(b.classId).then(() => true, () => false);
  }
  return Promise.resolve(false);
}

/**
 * Lyssna på klassdokumentet. `fn(klass)` får varje ny version (direkt om en
 * finns), `onFel(err)` om läsningen nekas. Returnerar avregistreringen.
 */
export function bevakaKlass(k, fn, onFel = null) {
  if (!k?.classId || !k?.uid) return () => {};
  if (bev && (bev.classId !== k.classId || bev.uid !== k.uid)) stang(bev, { slutaVanta: true });
  const b = bev && !bev.stangd ? bev : starta(k);
  clearTimeout(b.timer);
  b.fns.set(fn, onFel);
  if (b.klass) queueMicrotask(() => { if (b.fns.has(fn)) sakert(fn, b.klass); });
  else if (b.fel && onFel) queueMicrotask(() => { if (b.fns.has(fn)) sakert(onFel, b.fel); });
  return () => {
    if (!b.fns.delete(fn) || b.fns.size || b.stangd) return;
    clearTimeout(b.timer);
    b.timer = setTimeout(() => { if (!b.fns.size) stang(b, { slutaVanta: false }); }, LAT_STANG_MS);
  };
}

/** Senaste klassdokumentet (null om lyssnaren inte är öppen). */
export const senasteKlass = () => bev?.klass ?? null;

/** Är lyssnaren öppen just nu? (tester och förhandsvisningen) */
export const lyssnarPaKlass = () => Boolean(bev && !bev.stangd);

/**
 * Stäng lyssnaren direkt (eleven lämnar schacksidan) och ta bort en egen väntan.
 * Returnerar löftet om schackSlutaVanta – utloggningen väntar på det (F1).
 */
export function stangKompis({ slutaVanta = true } = {}) {
  return stang(bev, { slutaVanta });
}

/** Eleven lämnade partiet (Till lobbyn / partiet saknas) – hoppa inte tillbaka in i det. */
export const markeraLamnat = (partiId) => { if (partiId) lamnade.add(partiId); };
export const arLamnat = (partiId) => lamnade.has(partiId);
