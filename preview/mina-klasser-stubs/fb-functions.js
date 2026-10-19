// Förhandsvisnings-STUB av firebase-functions (#804): ingen server – varje callable
// svarar med ett vänligt fel (t.ex. Schackets "Avsluta parti" i previewn).
export const getFunctions = () => ({});
export const connectFunctionsEmulator = () => {};
export const httpsCallable = () => async () => {
  throw Object.assign(new Error("Det finns ingen server i förhandsvisningen."), { code: "unavailable" });
};
