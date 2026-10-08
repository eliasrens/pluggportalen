// ============================================================================
// Bootgraf-kontroll (#515): BFS över de STATISKA importerna från app.js i en
// git-revision (dynamiska import() räknas inte). Jämför före/efter en epic:
//   node admin/qa-bootgraf-bfs.mjs 90c7569 > /tmp/fore.txt
//   node admin/qa-bootgraf-bfs.mjs HEAD    > /tmp/efter.txt && diff /tmp/fore.txt /tmp/efter.txt
// Ny fil i bootgrafen = risk för vit sida under Pages-deployen (incident 2026-09-10).
// ============================================================================
import { execSync } from "node:child_process";
import path from "node:path";
const rev = process.argv[2] || "HEAD";
const show = (p) => { try { return execSync(`git show ${rev}:${p}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
const start = show("app.js") !== null ? "app.js" : "src/app.js";
const seen = new Set([start]); const q = [start];
const re = /(?:^|[;\n])\s*(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g;
while (q.length) {
  const f = q.shift(); const src = show(f); if (src === null) { console.error("saknas", f); continue; }
  for (const m of src.matchAll(re)) {
    const s = m[1]; if (!s.startsWith(".")) continue;
    const p = path.posix.normalize(path.posix.join(path.posix.dirname(f), s));
    if (!seen.has(p)) { seen.add(p); q.push(p); }
  }
}
console.log([...seen].sort().join("\n"));
