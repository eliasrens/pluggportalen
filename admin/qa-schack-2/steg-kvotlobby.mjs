// Schack slut-QA Etapp 2 (#782), steget "kvotlobby" – se qa.mjs. Lobbyn med många öppna sidor
// (Cleo i QA_LOBBY_SIDOR flikar, standard 25, samma origin = samma räknande proxy): varje ändring i
// klassdokumentet ska kosta 1 läsning per öppen sida, och inget ska läsas/skrivas utan händelser.
import { vila, anvandare, loggaInElev, tillLobby } from "./lib.mjs";
import { vantaMed, nollaKlass } from "./spel.mjs";

const ANTAL_OPPNA = Number(process.env.QA_LOBBY_SIDOR || 25);
const kort = (r) => `läs ${r.summaLasningar} (${Object.entries(r.lasningar).map(([k, v]) => `${k}: ${v}`).join(", ") || "–"}), skriv ${r.summaSkrivningar}`;
const las = (r, monster) => Object.entries(r.lasningar).filter(([k]) => k.startsWith(monster)).reduce((a, [, v]) => a + v, 0);

export default async function kvotlobby({ br, PORTAR, BILDER, ok }) {
  const [PA, PB, , PC] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await nollaKlass();
  // lobbyn: många öppna sidor (Cleo, samma origin) – varje ändring i klassdokumentet = 1 läsning per sida
  const C = await anvandare(br, PC);
  await loggaInElev(C, "4a03");
  const sidor = [C];
  for (let i = 1; i < ANTAL_OPPNA; i++) {
    // Egen host per flik (t1.localhost …): Chrome har högst 6 HTTP/1.1-anslutningar per host och
    // proxyn kör Firestore som long-poll – i produktionen går det över HTTP/2 utan den gränsen.
    const u = await anvandare(br, PC, { bredd: 800, hojd: 600, host: `t${i}.localhost` });
    await loggaInElev(u, "4a03");
    await u.ev(`location.hash = "#/elev/schack?vy=kompis"`);
    await u.vanta(`!!document.querySelector(".schack-lobby-ny, .schack-lobby-vantar-du")`, 60000)
      .catch(async () => { throw new Error(`flik ${i}: ${(await u.text("body")).slice(0, 200)}`); });
    sidor.push(u);
  }
  await tillLobby(C);
  await vila(2000);
  await C.rakna(true);
  await tillLobby(B);
  await vantaMed(A, "5");
  await vila(1500);
  await A.klick('[data-act="sluta-vanta"]');
  await vila(2500);
  const lob = await C.rakna();
  ok(`lobbyn med ${ANTAL_OPPNA} öppna sidor: 2 ändringar (vänta + sluta vänta) = ${2 * ANTAL_OPPNA} läsningar`, las(lob, "schackKlass") === 2 * ANTAL_OPPNA, kort(lob));
  await C.rakna(true);
  await vila(15_000);
  const lobTyst = await C.rakna();
  ok(`lobbyn: 15 s utan händelser med ${ANTAL_OPPNA} sidor öppna = 0 läsningar/skrivningar (ingen närvaro-ping)`, lobTyst.summaLasningar === 0 && lobTyst.summaSkrivningar === 0, kort(lobTyst));
  await C.bild(BILDER, "lobby-25-oppna");
}
