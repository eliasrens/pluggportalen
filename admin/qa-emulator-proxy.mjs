// ============================================================================
// QA-proxy mot Firebase-EMULATORERNA (#458) – en origin för allt.
// ----------------------------------------------------------------------------
// Som qa-emulator-server.mjs, men webbläsaren pratar BARA med den här servern:
// Firestore- och Auth-anropen proxas vidare till emulatorerna. Då fungerar
// den riktiga appen även i en förhandsvisning på en annan maskin/origin
// (https-proxy, ingen åtkomst till 127.0.0.1:8080 från webbläsaren).
// Ingen produktionsdata läses eller skrivs; appkoden ändras INTE.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   PORT=8000 node admin/qa-emulator-proxy.mjs
// ============================================================================
import { createServer, request } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const FS = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const AU = (process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099").split(":");
const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
};

/** firebase-config.js mot emulatorerna via DEN HÄR origin (samma exporter). */
async function emulatorConfig() {
  const orig = await readFile(join(ROOT, "src/firebase-config.js"), "utf8");
  return orig
    .replace(/import \{ getFirestore \} from "[^"]+";/,
      `import { initializeFirestore } from "${SDK}/firebase-firestore.js";`)
    .replace(/import \{ getAuth \} from "[^"]+";/,
      `import { getAuth, connectAuthEmulator } from "${SDK}/firebase-auth.js";`)
    .replace(/export const db = getFirestore\(app\);/,
      `export const db = initializeFirestore(app, { host: location.host, ssl: location.protocol === "https:", experimentalForceLongPolling: true });`)
    .concat(`\nconnectAuthEmulator(auth, location.origin, { disableWarnings: true });
console.info("[QA] Firebase → emulatorer via", location.origin);\n`);
}

function proxy(req, res, [host, port]) {
  const up = request({ host, port, method: req.method, path: req.url, headers: { ...req.headers, host: `${host}:${port}` } }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502); res.end(`Emulatorn svarar inte: ${e.message}`); });
  req.pipe(up);
}

createServer(async (req, res) => {
  const url = req.url || "/";
  if (url.startsWith("/google.firestore") || url.startsWith("/v1/projects")) return proxy(req, res, FS);
  if (url.startsWith("/identitytoolkit.googleapis.com") || url.startsWith("/securetoken.googleapis.com") ||
      url.startsWith("/emulator/")) return proxy(req, res, AU);
  try {
    let p = decodeURIComponent(new URL(url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const headers = { "Cache-Control": "no-cache, no-store, must-revalidate" };
    if (p === "/src/firebase-config.js") {
      res.writeHead(200, { ...headers, "Content-Type": TYPES[".js"] });
      return void res.end(await emulatorConfig());
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
}).listen(PORT, "0.0.0.0", () => console.log(`QA-proxy (emulator) på http://localhost:${PORT}`));
