// Preview-stub för src/auth.js (#739): inloggad lärare, ingen Firebase.
// ?roll=admin → admin, annars årskurskonto "anna".
const admin = new URLSearchParams(location.search).get("roll") === "admin";
export const isTeacher = () => true;
export const isAdmin = () => admin;
export const signInTeacher = async () => ({ ok: true });
export const signOutCurrent = () => {};
export const takeSessionLostNotice = () => null;
