// Diagnos för regressionsfyndet F2 (svart ser inte 'Din tid är slut.') – isolerat.
import { db, vila, parti, anvandare, loggaInElev, drag } from "../qa-schack-2/lib.mjs";
import { farger, vantaMed, spelaMot, nollaKlass } from "../qa-schack-2/spel.mjs";

export default async function tidslut({ br, PORTAR, ok }) {
  const [PA, PB] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await nollaKlass();
  await vantaMed(A, "5");
  const id = await spelaMot(B, A);
  const f = await farger(id, A, B);
  await drag(f.vit, id, "d2", "d4");
  const pt = await parti(id);
  await db.doc(`schackPartier/${id}`).update({ klocka: { ...pt.klocka, svartMs: 2000, senastDragAt: Date.now() } });
  for (let i = 0; i < 12; i++) {
    await vila(1000);
    const s = await f.svart.text(".schack-kompis");
    const v = await f.vit.text(".schack-kompis");
    console.log(i, "svart:", s.slice(0, 170), "| vit:", v.slice(0, 120));
  }
  ok("diagnos klar", true);
}
