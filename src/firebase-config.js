// Firebase-initiering för Pluggportalen.
// Webbappens config är publik (så är alla Firebase-webbnycklar) – skyddet ligger
// i Firestore-säkerhetsreglerna (se firestore.rules) + Firebase Auth, inte i att
// gömma nyckeln.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyB34GPjLkIuJNbgTGOrm6sRMIAisx9aJ3w",
  authDomain: "pluggportalen-so-2026.firebaseapp.com",
  projectId: "pluggportalen-so-2026",
  storageBucket: "pluggportalen-so-2026.firebasestorage.app",
  messagingSenderId: "480223055142",
  appId: "1:480223055142:web:30dedfa21e2528134945e7",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// Firebase Auth: äkta inloggning så att Firestore-reglerna kan gatas per elev
// (request.auth). Se src/auth.js för login-/session-logiken.
export const auth = getAuth(app);
