// ============================================================================
// QA-server mot Firebase-EMULATORERNA (issue #403, Läsresan-QA).
// ----------------------------------------------------------------------------
// Servar repot precis som server.mjs, men byter ut src/firebase-config.js mot
// en variant som kopplar Firestore + Auth till de lokala emulatorerna. Ingen
// produktionsdata läses eller skrivs. Appkoden i repot ändras INTE.
//
//   1. firebase emulators:start --only auth,firestore   (kräver Java 21+)
//   2. node admin/qa-lasresan-seed.mjs                  (testkonton + scenarier)
//   3. PORT=8000 node admin/qa-emulator-server.mjs
//
// Se docs/QA-LASRESAN.md för hela receptet.
// ============================================================================
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = process.env.PORT || 8000;
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

/** firebase-config.js mot emulatorerna (samma exporter som originalet). */
async function emulatorConfig() {
  const orig = await readFile(join(ROOT, "src/firebase-config.js"), "utf8");
  const [fsHost, fsPort] = FS_HOST.split(":");
  return `${orig}
// --- QA: emulatorkoppling (admin/qa-emulator-server.mjs) ---
import { connectFirestoreEmulator as __cfe } from "${SDK}/firebase-firestore.js";
import { connectAuthEmulator as __cae } from "${SDK}/firebase-auth.js";
__cfe(db, "${fsHost}", ${Number(fsPort)});
__cae(auth, "http://${AUTH_HOST}", { disableWarnings: true });
console.info("[QA] Firebase → emulatorer ${FS_HOST} / ${AUTH_HOST}");
`;
}

createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const headers = { "Cache-Control": "no-cache, no-store, must-revalidate" };
    if (urlPath === "/src/firebase-config.js") {
      res.writeHead(200, { ...headers, "Content-Type": TYPES[".js"] });
      res.end(await emulatorConfig());
      return;
    }
    const filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) return void res.writeHead(403).end("Forbidden");
    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) return void res.writeHead(404).end("404");
    res.writeHead(200, { ...headers, "Content-Type": TYPES[extname(filePath)] || "application/octet-stream" });
    res.end(await readFile(filePath));
  } catch (e) {
    res.writeHead(500).end("Serverfel: " + e.message);
  }
}).listen(PORT, "0.0.0.0", () => console.log(`QA (emulator) på http://localhost:${PORT}`));
