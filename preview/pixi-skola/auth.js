// Preview-stub för src/auth.js (#421): alltid inloggad som scenariots elev.
// Allt annat är den riktiga modulen (laddad under en annan URL så importkartan
// inte pekar tillbaka hit).
import { ME } from "./scenario.js";
export * from "/src/auth.js?real";

const SESSION = { studentId: ME, namn: "Alva", username: ME };
export const getSession = () => SESSION;
export const currentStudentId = () => ME;
export const isLoggedIn = () => true;
export const isTeacher = () => false;
export const whenAuthReady = () => Promise.resolve();
