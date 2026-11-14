// Yttre proxy #857: /qa-cov = ruleCoverage, /qa-rest[?nollstall] = REST-räkning (transaktioner:
// batchGet-dokument = läsningar, commit-writes = skrivningar), resten → inre qa-emulator-proxy.
import { createServer, request } from "node:http";
const { PORT, INRE, FS, GCLOUD_PROJECT: P } = process.env;
let r = { batchGetDok: 0, batchGetAnrop: 0, commitWrites: 0, commitAnrop: 0, ovrigt: {} };
const nolla = () => { r = { batchGetDok: 0, batchGetAnrop: 0, commitWrites: 0, commitAnrop: 0, ovrigt: {} }; };
createServer((req, res) => {
  if (req.url.startsWith("/qa-rest")) {
    const ut = JSON.stringify(r); if (req.url.includes("nollstall")) nolla();
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); return res.end(ut);
  }
  const cov = req.url.startsWith("/qa-cov");
  const rest = !cov && req.url.startsWith("/v1/projects/") && req.method === "POST";
  const m = rest && req.url.match(/documents:([a-zA-Z]+)/);
  const op = m ? m[1] : null;
  const opt = cov
    ? { host: "127.0.0.1", port: FS, path: `/emulator/v1/projects/${P}:ruleCoverage`, method: "GET" }
    : { host: "127.0.0.1", port: INRE, path: req.url, method: req.method, headers: req.headers };
  const body = [];
  const up = request(opt, (u) => {
    res.writeHead(u.statusCode, u.headers);
    if (op === "batchGet") {
      const delar = [];
      u.on("data", (c) => delar.push(c));
      u.on("end", () => { r.batchGetAnrop++; r.batchGetDok += (Buffer.concat(delar).toString().match(/"found"/g) || []).length; });
    }
    u.pipe(res);
  });
  up.on("error", (e) => { if (!res.headersSent) res.writeHead(502); res.end(String(e)); });
  res.on("close", () => up.destroy());
  if (cov) return up.end();
  if (op) {
    req.on("data", (c) => body.push(c));
    req.on("end", () => {
      if (op === "commit") { r.commitAnrop++; try { r.commitWrites += (JSON.parse(Buffer.concat(body).toString()).writes || []).length; } catch { r.commitWrites += -1000; } }
      else if (op !== "batchGet") r.ovrigt[op] = (r.ovrigt[op] || 0) + 1;
    });
  }
  req.pipe(up);
}).listen(Number(PORT), "0.0.0.0");
