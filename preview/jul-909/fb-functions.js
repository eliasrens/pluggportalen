// Preview-stub för firebase-functions.js (#698): inga callables i husvärlden –
// ett anrop svarar med ett fel (appens felvägar tar hand om det).
export function getFunctions() { return {}; }
export function httpsCallable(_f, namn) {
  return async () => { throw Object.assign(new Error(`callable ${namn} finns inte i previewn`), { code: "unavailable" }); };
}
