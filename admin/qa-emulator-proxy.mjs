// ============================================================================
// QA-proxy mot Firebase-EMULATORERNA via SAMMA origin (#458 + #460).
// ----------------------------------------------------------------------------
// Som qa-emulator-server.mjs, men webbläsaren pratar aldrig direkt med
// 127.0.0.1:8080/9099 – allt går via den här servern:
//   /google.firestore.*, /v1/projects/…  → Firestore-emulatorn (8080)
//   /identitytoolkit.googleapis.com, /securetoken.googleapis.com, /emulator/
//                                  → Auth-emulatorn (9099)
// Därför fungerar den även i en förhandsvisning som körs på en annan dator/
// origin (https-proxy). firebase-config.js byts mot en variant som pekar
// Firestore (host + ssl) och Auth på location. Appkoden i repot ändras INTE.
//
//   firebase emulators:start --only auth,firestore --project pluggportalen-so-2026
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     node admin/qa-live-seed.mjs
//   PORT=8000 node admin/qa-emulator-proxy.mjs
// ============================================================================
import { createServer, request } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const FS = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const AUTH = (process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099").split(":");
const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
};

/** firebase-config.js mot emulatorerna via samma origin (samma exporter som originalet). */
async function emulatorConfig() {
  const orig = await readFile(join(ROOT, "src/firebase-config.js"), "utf8");
  return orig
    .replace(/import \{ getFirestore \} from "[^"]+";/, `import { initializeFirestore } from "${SDK}/firebase-firestore.js";\nimport { connectAuthEmulator as __cae } from "${SDK}/firebase-auth.js";`)
    .replace(/export const db = getFirestore\(app\);/,
      `export const db = initializeFirestore(app, { host: location.host, ssl: location.protocol === "https:", experimentalForceLongPolling: true });`)
    .replace(/export const auth = getAuth\(app\);/,
      `export const auth = getAuth(app);\n__cae(auth, location.origin, { disableWarnings: true });\nconsole.info("[QA] Firebase → emulatorer via", location.origin);`);
}

function proxy(req, res, [host, port]) {
  const up = request({ agent: false, host, port: Number(port), method: req.method, path: req.url, headers: { ...req.headers, host: `${host}:${port}` } }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    r.pipe(res);
  });
  up.on("error", (e) => {
    console.warn("proxy-fel", req.method, req.url.slice(0, 80), e.message);
    if (!res.headersSent) res.writeHead(502);
    res.end("Emulatorn svarar inte: " + e.message);
  });
  // Webbläsaren avbryter long-poll → avbryt även uppströms.
  res.on("close", () => up.destroy());
  req.pipe(up);
}

createServer(async (req, res) => {
  const url = req.url || "/";
  // Strömmar (Listen/Write) + REST-anrop (transaktioner, getDocFromServer …).
  if (url.startsWith("/google.firestore") || url.startsWith("/v1/projects/")) return proxy(req, res, FS);
  if (url.startsWith("/identitytoolkit.googleapis.com") || url.startsWith("/securetoken.googleapis.com") || url.startsWith("/emulator/")) {
    return proxy(req, res, AUTH);
  }
  try {
    let p = decodeURIComponent(new URL(url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const headers = { "Cache-Control": "no-cache, no-store, must-revalidate" };
    if (p === "/src/firebase-config.js") {
      res.writeHead(200, { ...headers, "Content-Type": TYPES[".js"] });
      return res.end(await emulatorConfig());
    }
    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      return res.end();
    }
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) return void res.writeHead(403).end("Forbidden");
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) return void res.writeHead(404).end("404");
    res.writeHead(200, { ...headers, "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch (e) {
    res.writeHead(500).end("Serverfel: " + e.message);
  }
}).listen(PORT, "0.0.0.0", () => console.log(`QA (emulator via samma origin) på http://localhost:${PORT}`));
