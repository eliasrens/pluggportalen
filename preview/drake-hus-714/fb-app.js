// Preview-stub för firebase-app.js (från #422, återbrukad i #698 och #714): ingen Firebase, bara ett app-objekt.
export function initializeApp(config, name = "[DEFAULT]") {
  return { name, options: config };
}
export async function deleteApp() {}
