// Schack slut-QA Etapp 3 (#792), steget "lazy" – vad hämtas när? Nätverksflikens vy: ingen
// guide-/pusselkod och ingen pussel-JSON vid uppstart, hemsidan eller schacksidan; guiden först när
// den öppnas; pussel-JSON (matt-i-ett/-tva) först när pusselvyn öppnas.
import { vila, anvandare, loggaInElev } from "../qa-schack-2/lib.mjs";

export default async function lazy({ br, PORTAR, ok }) {
  const A = await anvandare(br, PORTAR[0]);
  await A.p.s("Network.enable");
  const urls = [];
  const stopp = A.p.pa((m) => { if (m.method === "Network.requestWillBeSent") urls.push(m.params.request.url.replace(/^https?:\/\/[^/]+/, "")); });
  await loggaInElev(A, "4a02");
  const efterLogin = [...urls];
  const schackFiler = (l) => l.filter((u) => /\/src\/schack\//.test(u) || /pussel/.test(u));
  ok("vid uppstart + inloggning + husvärlden: ingen schackfil alls hämtas", schackFiler(efterLogin).length === 0, schackFiler(efterLogin).join(", ") || `${efterLogin.length} anrop`);
  urls.length = 0;
  await A.ev(`location.hash = "#/elev/schack"`);
  await A.vanta(`!!document.querySelector(".schack-sida")`, 20000);
  await vila(1200);
  const start = schackFiler(urls);
  const namn = (l) => l.map((u) => u.split("/").pop().split("?")[0]);
  ok("schacksidan (start): ingen guide-, lektions-, pussel-fil och inga JSON", !start.some((u) => /guide|lektion|pussel|stjarnjakt/.test(u)), namn(start).join(", "));
  ok("schacksidan: inga pussel-JSON", !urls.some((u) => /matt-i-(ett|tva)\.json/.test(u)));
  ok("schacksidan (start): motorn/dator-vyn hämtas inte heller i onödan (info)", true, namn(start).join(", "));
  urls.length = 0;
  await A.klick('[data-vy="lar"], [data-act="lar"], .schack-kort[data-kort="lar"]').catch(async () => { await A.ev(`location.hash = "#/elev/schack?vy=lar"`); });
  await A.vanta(`document.querySelectorAll(".schack-lektion-kort").length === 12`, 15000);
  await vila(500);
  const guide = schackFiler(urls);
  ok("guiden öppnad: guide-vy + lektioner hämtas nu, inget pussel", guide.some((u) => /schack-guide-vy/.test(u)) && !guide.some((u) => /pussel/.test(u)), namn(guide).join(", "));
  urls.length = 0;
  await A.ev(`location.hash = "#/elev/schack?vy=lar&lektion=2"`);
  await A.vanta(`!!document.querySelector(".schack-lektion")`, 15000);
  await vila(400);
  const l2 = schackFiler(urls);
  ok("lektion 2: inga pussel-filer; stjärnjakten kom redan med guiden (statiskt importerad av lektionsvyn)", !l2.some((u) => /pussel/.test(u)) && guide.some((u) => /stjarnjakt/.test(u)), namn(l2).join(", ") || "inga nya schackfiler");
  urls.length = 0;
  await A.ev(`location.hash = "#/elev/schack?vy=pussel"`);
  await A.vanta(`document.querySelectorAll(".schack-pussel-sort").length === 2`, 15000);
  await vila(1000);
  const pv = schackFiler(urls);
  ok("pusselvyn öppnad: pussel-modulerna och BÅDA JSON-filerna hämtas nu", pv.some((u) => /schack-pussel-vy/.test(u)) && pv.some((u) => /matt-i-ett\.json/.test(u)) && pv.some((u) => /matt-i-tva\.json/.test(u)), namn(pv).join(", "));
  const storlek = await A.ev(`Promise.all(["matt-i-ett.json", "matt-i-tva.json"].map((f) => fetch("/src/schack/pussel/" + f).then((r) => r.text()).then((t) => [f, t.length])))`);
  ok("JSON-storlek (info)", true, JSON.stringify(storlek));
  urls.length = 0;
  await A.ev(`location.hash = "#/elev/schack?vy=pussel&sort=ett"`);
  await A.vanta(`/Pussel \\d+ av 200/.test(document.querySelector(".schack-pussel-nr")?.textContent || "")`, 15000);
  await vila(400);
  ok("ett pussel öppnat efter valet: pusslet kommer ur cachen (JSON hämtas inte igen)", !urls.some((u) => /matt-i-(ett|tva)\.json/.test(u)), namn(urls.filter((u) => /schack|json/.test(u))).join(", ") || "inga anrop");
  stopp();
  // statiskt: bootgrafen
  const { execSync } = await import("node:child_process");
  const bfs = execSync("node admin/qa-bootgraf-bfs.mjs HEAD", { encoding: "utf8" }).trim().split("\n");
  ok("bootgrafen (BFS över statiska importer från app.js) = 107 filer, ingen under src/schack/", bfs.length === 107 && !bfs.some((f) => /schack/.test(f)), `${bfs.length} filer`);
}
