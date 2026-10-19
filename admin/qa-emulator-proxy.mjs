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
// Cloud Functions (lärarens "Redigera inloggning"): POST /<funktionsnamn> →
// Functions-emulatorn (5001, europe-west1) om den körs (--only functions,auth,
// firestore); config-varianten sätter globalThis.__PP_FUNCTIONS_URL = origin
// (data-student-login.js; SDK:t använder bara originet av en custom-domän).
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
const FN = (process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001").split(":");
const FN_BASE = `/${process.env.GCLOUD_PROJECT || "pluggportalen-so-2026"}/europe-west1`;
const FN_NAMES = new Set(["/updateStudentLogin", "/guldrushAnswer", "/guldrushOpenChest", "/guldrushChooseVictim", "/hittaRattSubmit",
  "/hittaRattSparaPack", "/hittaRattRaderaPack", "/hittaRattSattTopplista",
  "/datakuppAnswer", "/datakuppOpenFile", "/datakuppPickCode", "/datakuppChooseTarget", "/datakuppGuessCode",
  "/adminCreateTeacher", "/adminUpdateTeacher", "/adminSetTeacherPassword", "/adminSetTeacherActive", "/adminDeleteTeacher",
  "/brakresaStartRound", "/brakresaAnswer", "/brakresaRework", "/brakresaFinishRound", "/brakresaAbortRound", "/brakresaAckDragon", "/brakresaRenameDragon",
  "/brakresaHunt",
  "/schackVanta", "/schackSlutaVanta", "/schackGaMed", "/schackUtmana", "/schackSvara", "/schackDrag", "/schackGeUpp", "/schackRemi",
  "/schackKravaVinst", "/schackLarareAvsluta", "/schackLarareTopplista"]);
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
      `export const auth = getAuth(app);\n__cae(auth, location.origin, { disableWarnings: true });\nglobalThis.__PP_FUNCTIONS_URL = location.origin;\nconsole.info("[QA] Firebase → emulatorer via", location.origin);`);
}

// QA_RAKNA=1 (#743): räkna dokument som Firestore levererar (Listen = debiterade
// läsningar) och skrivna dokument (Write) för just den här porten/originet.
// GET /__qa/rakna visar summan per samlingsmönster, /__qa/rakna?nollstall nollar.
const RAKNA = !!process.env.QA_RAKNA;
const rakning = { lasningar: {}, skrivningar: {} };
const monster = (namn) => namn.split("/").map((d, i) => (i % 2 ? "*" : d)).join("/");
function raknaIn(typ, text, re) {
  for (const m of text.matchAll(re)) {
    const k = monster(m[1]);
    rakning[typ][k] = (rakning[typ][k] || 0) + 1;
  }
}
const LAS_RE = /"documentChange":\s*\{\s*"document":\s*\{\s*"name":\s*"projects\/[^/]+\/databases\/[^/]+\/documents\/([^"]+)"/g;
const SKRIV_RE = /"(?:update|delete)":\s*(?:\{\s*"name":\s*)?"projects\/[^/]+\/databases\/[^/]+\/documents\/([^"]+)"/g;

function proxy(req, res, [host, port], path = req.url) {
  const up = request({ agent: false, host, port: Number(port), method: req.method, path, headers: { ...req.headers, host: `${host}:${port}` } }, (r) => {
    res.writeHead(r.statusCode || 502, r.headers);
    if (RAKNA && path.includes("/Listen/channel")) {
      let rest = "";
      r.on("data", (c) => {
        const t = rest + c.toString("utf8");
        const sista = t.lastIndexOf('"documentChange"');
        raknaIn("lasningar", sista > 0 ? t.slice(0, sista) : t, LAS_RE);
        rest = sista > 0 ? t.slice(sista) : "";
      });
      r.on("end", () => raknaIn("lasningar", rest, LAS_RE));
    }
    r.pipe(res);
  });
  if (RAKNA && path.includes("/Write/channel") && req.method === "POST") {
    const delar = [];
    req.on("data", (c) => delar.push(c));
    req.on("end", () => {
      let t = Buffer.concat(delar).toString("utf8");
      try { t = decodeURIComponent(t.replace(/\+/g, " ")); } catch { /* inte url-kodat */ }
      raknaIn("skrivningar", t, SKRIV_RE);
    });
  }
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
  if (RAKNA && url.startsWith("/__qa/rakna")) {
    if (url.includes("nollstall")) { rakning.lasningar = {}; rakning.skrivningar = {}; }
    const summa = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    res.writeHead(200, { "Content-Type": TYPES[".json"], "Access-Control-Allow-Origin": "*" });
    return res.end(JSON.stringify({ summaLasningar: summa(rakning.lasningar), summaSkrivningar: summa(rakning.skrivningar), ...rakning }, null, 1));
  }
  // Strömmar (Listen/Write) + REST-anrop (transaktioner, getDocFromServer …).
  if (url.startsWith("/google.firestore") || url.startsWith("/v1/projects/")) return proxy(req, res, FS);
  if (url.startsWith("/identitytoolkit.googleapis.com") || url.startsWith("/securetoken.googleapis.com") || url.startsWith("/emulator/")) {
    return proxy(req, res, AUTH);
  }
  if (FN_NAMES.has(url.split("?")[0])) return proxy(req, res, FN, FN_BASE + url);
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
