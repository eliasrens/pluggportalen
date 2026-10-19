// #807 tester: som installeraEmulatorFirestore (emulator-firestore.js) men med ETT EGET projekt-id,
// så att en testfil kan köras parallellt med andra mot samma emulator utan att dela data
// (och utan att andras clearFirestore() rör den). src/firebase-config.js byts mot en modul
// med samma exporter men ett annat projectId.
import { register } from "node:module";
import { installeraEmulatorFirestore } from "./emulator-firestore.js";

export async function installeraMedProjekt(projectId, token) {
  await installeraEmulatorFirestore(token);
  const config = `
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
export const firebaseConfig = { apiKey: "test", projectId: ${JSON.stringify(projectId)}, appId: "test" };
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);`;
  const krok = `
export async function resolve(spec, ctx, next) {
  if (/\\/firebase-config\\.js$/.test(spec)) return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(${JSON.stringify(config)}) };
  return next(spec, ctx);
}`;
  register(`data:text/javascript,${encodeURIComponent(krok)}`);
}
