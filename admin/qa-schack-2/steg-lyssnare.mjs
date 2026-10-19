// Schack slut-QA Etapp 2 (#782), steget "lyssnare" – se qa.mjs. Hur många onSnapshot som
// faktiskt är öppna mot Firestore, mätt på tråden: Firestore-SDK:t skickar addTarget/removeTarget
// i Listen-kanalens POST-kroppar (Network.requestWillBeSent). Per sida räknas de aktiva målen på
// schackKlass/ och schackPartier/ i lobbyn, i partiet, efter partiet, hos läraren och efter att
// sidan lämnats.
import { vila, anvandare, loggaInElev, loggaInLarare, tillLobby } from "./lib.mjs";
import { vantaMed, spelaMot, callFran, nollaKlass } from "./spel.mjs";

/** Följer Listen-målen för en sida. aktiva() → ["schackKlass/4a", …] (bara schack). */
async function bevaka(u) {
  const mal = new Map(); // targetId → dokumentväg eller "fråga:<samling>"
  let tillagda = 0;
  const las = (text) => {
    let t = text;
    try { t = decodeURIComponent(text.replace(/\+/g, " ")); } catch { /* inte url-kodat */ }
    for (const m of t.matchAll(/req\d+___data__=(\{.*?\})(?=&req\d+___data__=|$)/gs)) {
      let d;
      try { d = JSON.parse(m[1]); } catch { continue; }
      if (d.addTarget) {
        const doc = d.addTarget.documents?.documents?.[0];
        const q = d.addTarget.query?.structuredQuery?.from?.[0]?.collectionId;
        const vag = doc ? doc.replace(/^projects\/[^/]+\/databases\/[^/]+\/documents\//, "") : `fråga:${q || "?"}`;
        if (/^schack/.test(vag) || /fråga:schack/.test(vag)) { if (!mal.has(d.addTarget.targetId)) tillagda++; }
        mal.set(d.addTarget.targetId, vag);
      }
      if (d.removeTarget != null) mal.delete(d.removeTarget);
    }
  };
  await u.p.s("Network.enable", { maxPostDataSize: 65536 });
  u.p.pa(async (m) => {
    if (m.method !== "Network.requestWillBeSent") return;
    const r = m.params.request;
    if (r.method !== "POST" || !r.url.includes("/Listen/channel")) return;
    if (r.postData) return las(r.postData);
    if (r.hasPostData) {
      try { las((await u.p.s("Network.getRequestPostData", { requestId: m.params.requestId })).postData); } catch { /* borta */ }
    }
  });
  return {
    aktiva: () => [...mal.values()].filter((v) => /schack/.test(v)).sort(),
    tillagda: () => tillagda,
  };
}

export default async function lyssnare({ br, PORTAR, ok }) {
  const [PA, PB, PT] = PORTAR;
  const A = await anvandare(br, PA), B = await anvandare(br, PB), T = await anvandare(br, PT);
  const la = await bevaka(A), lb = await bevaka(B), lt = await bevaka(T);
  await loggaInElev(A, "4a01"); await loggaInElev(B, "4a02");
  await nollaKlass();
  const visa = (l) => JSON.stringify(l.aktiva());

  ok("utanför schack: 0 schacklyssnare", !la.aktiva().length, visa(la));
  await A.ev(`location.hash = "#/elev/schack"`);
  await A.vanta(`!!document.querySelector('[data-act="kompis"]')`, 20000);
  await vila(1500);
  ok("startsidan: exakt 1 lyssnare (schackKlass/4a)", visa(la) === '["schackKlass/4a"]', visa(la));
  await tillLobby(A);
  await vila(1500);
  ok("startsida → lobby: samma enda lyssnare (ingen ny)", visa(la) === '["schackKlass/4a"]' && la.tillagda() === 1, `${visa(la)}, tillagda ${la.tillagda()}`);
  await vantaMed(A, "10");
  const id = await spelaMot(B, A);
  await vila(3500); // lobbylyssnaren stängs 2 s efter att partiet öppnats
  ok("i partiet: exakt 1 lyssnare (partiet), lobbyn stängd – A", visa(la) === `["schackPartier/${id}"]`, visa(la));
  ok("i partiet: exakt 1 lyssnare – B", visa(lb) === `["schackPartier/${id}"]`, visa(lb));

  await loggaInLarare(T);
  await vila(1500);
  ok("lärarsektionen: exakt 1 lyssnare (schackKlass/4a)", visa(lt) === '["schackKlass/4a"]', visa(lt));
  await T.klick(`[data-titta="${id}"]`);
  await T.vanta(`document.querySelectorAll(".sl-ask .schack-bradet [data-ruta]").length === 64`);
  await vila(1000);
  ok("åskådarläget: klassdokumentet + partiet (2)", visa(lt) === `["schackKlass/4a","schackPartier/${id}"]`, visa(lt));
  await T.klick("[data-tillbaka]");
  await vila(1000);
  ok("← Alla partier: partilyssnaren stängd", visa(lt) === '["schackKlass/4a"]', visa(lt));

  await callFran(B, "schackGeUpp", { partiId: id });
  await vila(2500);
  ok("efter partiet (slutrutan): partiet + lobbyn för utmaningsrutan (2)", visa(la) === `["schackKlass/4a","schackPartier/${id}"]`, visa(la));
  await A.klickText("Till lobbyn", ".schack-kompis .schack-slut-knappar");
  await vila(1500);
  ok("Till lobbyn: bara klassdokumentet", visa(la) === '["schackKlass/4a"]', visa(la));
  await A.ev(`location.hash = "#/elev/hem"`);
  await T.ev(`location.hash = "#/larare/klasser?klass=4a&sektion=fokus"`);
  await vila(2500);
  ok("eleven lämnade schacksidan: 0 schacklyssnare", !la.aktiva().length, visa(la));
  ok("läraren lämnade sektionen: 0 schacklyssnare", !lt.aktiva().length, visa(lt));
  // tio vybyten inom schacksidan ska inte stapla lyssnare
  await A.ev(`location.hash = "#/elev/schack"`);
  for (let i = 0; i < 5; i++) {
    await tillLobby(A);
    await A.ev(`location.hash = "#/elev/schack"`);
    await A.vanta(`!!document.querySelector('[data-act="kompis"]')`, 10000);
  }
  await vila(2500);
  ok("10 vybyten startsida ↔ lobby: fortfarande 1 lyssnare", visa(la) === '["schackKlass/4a"]', `${visa(la)}, tillagda totalt ${la.tillagda()}`);
}
