// Preview-räknare (#420): varje "läsning" (stubbad data-funktion eller
// Firestore-stubbens getDoc/getDocs) räknas, så klicktestet kan bevisa att
// hover/förrendering INTE läser något. window.__pvLasningar.
export const lasningar = (globalThis.__pvLasningar ??= { total: 0, per: {} });
export function las(namn) {
  lasningar.total++;
  lasningar.per[namn] = (lasningar.per[namn] || 0) + 1;
}
