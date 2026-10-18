// Schack-QA (#777) steg "bradet": spec §2.2–2.3 och §5 (regler i UI:t) i appen.
const vila = (ms) => new Promise((r) => setTimeout(r, ms));
const FORVANDLING = ["a4", "h6", "a5", "h5", "a6", "h4", "axb7", "h3"]; // vit bonde på b7, a8/c8 kan tas

export default async function bradet({ p, e, ok, skarm }) {
  await e.startaParti("bonden", "w");
  ok("partiet sparas per elev", /^pp:schack:dator:[A-Za-z0-9]+$/.test((await e.parti()).nyckel), (await e.parti()).nyckel);

  // Tryck-flytta, prickar, byta/avmarkera
  await e.injicera([]);
  let l = await e.lage();
  ok("bara egna pjäser är valbara (16 vita, inga svarta)", l.kan.length === 16 && l.kan.every((r) => /[12]$/.test(r)), l.kan.join());
  await e.tryck("g1");
  l = await e.lage();
  ok("tryck på springaren: markerad + prickar på f3/h3", l.vald[0] === "g1" && l.mal.sort().join() === "f3,h3", JSON.stringify(l));
  ok("aria-label markerad", /^g1, vit springare, markerad/.test(await e.etikett("g1")), await e.etikett("g1"));
  ok("aria-label möjligt drag", /^f3, tom, möjligt drag/.test(await e.etikett("f3")), await e.etikett("f3"));
  ok("prickarna syns (mal-klassen ritar något)", await p.ev(`(() => { const r = document.querySelector('.schack-bradet [data-ruta="f3"]');
    return ["::before", "::after"].some(ps => { const c = getComputedStyle(r, ps); return c.content !== "none" && (c.backgroundColor !== "rgba(0, 0, 0, 0)" || c.backgroundImage !== "none" || c.boxShadow !== "none"); }); })()`));
  await e.tryck("e2");
  l = await e.lage();
  ok("tryck på annan egen pjäs byter markering", l.vald[0] === "e2" && l.mal.sort().join() === "e3,e4");
  await e.tryck("e2");
  ok("tryck på samma pjäs avmarkerar", (await e.lage()).vald.length === 0);
  await e.tryck("e2");
  await e.tryck("a6");
  ok("tryck någon annanstans avmarkerar", (await e.lage()).vald.length === 0 && (await e.parti()).drag.length === 0);
  await e.tryck("e2");
  await e.tryck("e5");
  ok("tryck på en olaglig ruta flyttar inget", (await e.parti()).drag.length === 0);

  // Tangentbord + animation
  await p.ev(`document.querySelector('.schack-bradet [tabindex="0"]').focus()`);
  ok("tangentbord: fokus börjar på e2 (en tabbstopp)", (await p.ev(`document.activeElement.dataset.ruta + "/" + document.querySelectorAll('.schack-bradet [tabindex="0"]').length`)) === "e2/1");
  await e.tangent("ArrowRight");
  ok("tangentbord: pil höger → f2", (await p.ev(`document.activeElement.dataset.ruta`)) === "f2");
  await e.tangent("ArrowLeft");
  await e.tangent("Enter");
  ok("tangentbord: Enter väljer e2", (await e.lage()).vald[0] === "e2");
  await e.tangent("ArrowUp");
  await e.tangent("ArrowUp");
  ok("tangentbord: pil upp ×2 → e4", (await p.ev(`document.activeElement.dataset.ruta`)) === "e4");
  await p.ev(`window.__glid = []; new MutationObserver(() => { const pj = document.querySelector('.schack-bradet [data-ruta="e4"] .schack-pjas');
    if (pj) window.__glid.push(...pj.getAnimations().map(a => a.effect.getTiming().duration)); })
    .observe(document.querySelector('.schack-bradet [data-ruta="e4"]'), { childList: true, subtree: true, attributes: true })`);
  await e.tangent("Enter");
  await vila(20);
  const glid = await p.ev(`window.__glid`);
  ok("tangentbord: Enter flyttar e2–e4", (await e.parti()).drag[0] === "e4");
  ok("pjäsen glider ~150 ms", glid.includes(150), JSON.stringify(glid));
  ok("aria-label efter draget", /^e4, vit bonde.*senaste draget/.test(await e.etikett("e4")), await e.etikett("e4"));
  await e.vantaDrag(2);
  ok("draglistan dold som standard", !(await e.synlig(".schack-draglista")));
  await e.klick(".schack-drag-knapp");
  const lista = await p.ev(`document.querySelector(".schack-draglista").textContent.trim()`);
  ok("Visa drag fäller ut draglistan (aria-expanded)", (await e.synlig(".schack-draglista")) && (await p.ev(`document.querySelector(".schack-drag-knapp").getAttribute("aria-expanded")`)) === "true", lista);
  ok("draglistan '1. e4 …'", /^1\. e4 \S+/.test(lista), lista);

  await p.s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await e.injicera(["e4", "e5"]);
  await e.tryck("g1");
  await e.tryck("f3");
  const anim = await p.ev(`document.querySelector('.schack-bradet [data-ruta="f3"] .schack-pjas')?.getAnimations().length`);
  ok("reduced-motion: pjäsen hoppar direkt (ingen animation)", anim === 0, `animationer: ${anim}`);
  await e.klick(".schack-drag-knapp");
  ok("draglistan i svensk notation (Sf3)", await p.ev(`document.querySelector(".schack-draglista").textContent.includes("Sf3")`), await p.ev(`document.querySelector(".schack-draglista").textContent`));
  await p.s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });

  // Rockad (tryck vit, dra svart, lång)
  await e.injicera(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]);
  await e.tryck("e1");
  ok("rockad: g1 bland kungens mål", (await e.lage()).mal.includes("g1"), (await e.lage()).mal.join());
  await e.tryck("g1");
  ok("kort rockad (tryck): kung g1, torn f1", /vit kung/.test(await e.etikett("g1")) && /vitt torn/.test(await e.etikett("f1")) && (await e.parti()).drag[6] === "O-O");
  await e.injicera(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "d3", "Nf6", "Nc3"], { egenFarg: "b" });
  ok("svart: h8 nere till vänster", (await e.hornRuta()) === "h8");
  await e.dra("e8", "g8");
  ok("kort rockad (dra med mus, svart): kung g8, torn f8", /svart kung/.test(await e.etikett("g8")) && /svart torn/.test(await e.etikett("f8")), (await e.parti()).drag.join(" "));
  await e.injicera(["d4", "d5", "Nc3", "Nc6", "Bf4", "Bf5", "Qd2", "Qd7"]);
  await e.tryck("e1");
  await e.tryck("c1");
  ok("lång rockad: kung c1, torn d1", /vit kung/.test(await e.etikett("c1")) && /vitt torn/.test(await e.etikett("d1")) && (await e.parti()).drag[8] === "O-O-O");

  // En passant
  await e.injicera(["e4", "a6", "e5", "d5"]);
  await e.tryck("e5");
  ok("en passant: d6 visas som slag (ring)", (await e.lage()).malTar.includes("d6"), JSON.stringify(await e.lage()));
  await skarm("app-en-passant");
  await e.tryck("d6");
  ok("en passant: bonde på d6, d5 tom", /vit bonde/.test(await e.etikett("d6")) && /^d5, tom/.test(await e.etikett("d5")) && (await e.parti()).drag[4] === "exd6");
  ok("tagen bonde visas vid elevens spelarrad", await p.ev(`document.querySelector('.schack-spelare[data-plats="botten"] .schack-tagna, .schack-spelare[data-plats="botten"] [class*="tagn"]')?.querySelectorAll("svg").length >= 1`));

  // Förvandling: väljaren, tryck, Escape, touch-drag + Enter
  await e.injicera(FORVANDLING);
  await e.tryck("b7");
  await e.tryck("a8");
  const knappar = await p.ev(`[...document.querySelectorAll(".schack-forvandling [data-pjas]")].map(b => b.dataset.pjas + (b.classList.contains("forvald") ? "*" : "")).join()`);
  ok("förvandlingsväljaren: dam först och förvald, torn, löpare, springare", knappar === "q*,r,b,n", knappar);
  ok("väljaren visar bilder (svg), inga unicode-schacktecken", await p.ev(`(() => { const f = document.querySelector(".schack-forvandling"); return f.querySelectorAll("svg").length >= 4 && !/[\\u2654-\\u265F]/.test(f.textContent); })()`));
  ok("damen har fokus i väljaren", await p.ev(`document.activeElement?.dataset.pjas === "q"`));
  await skarm("app-forvandling");
  await e.klick(`.schack-forvandling [data-pjas="n"]`);
  ok("förvandling till springare", /vit springare/.test(await e.etikett("a8")) && (await e.parti()).drag[8].startsWith("bxa8=N"), (await e.parti()).drag[8]);
  await e.injicera(FORVANDLING);
  await p.s("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await e.dra("b7", "c8", { touch: true });
  ok("touch-drag till sista raden öppnar väljaren", await e.synlig(".schack-forvandling"));
  await e.tangent("Escape");
  ok("Escape stänger väljaren, bonden står kvar på b7", !(await e.synlig(".schack-forvandling")) && /vit bonde/.test(await e.etikett("b7")));
  await e.dra("b7", "c8", { touch: true });
  await e.tangent("Enter");
  ok("Enter på förvalda damen → dam på c8", /vit dam/.test(await e.etikett("c8")), (await e.parti()).drag[8]);
  // Touch: olagligt släpp, lagligt drag
  await e.injicera([]);
  await e.dra("d2", "d5", { touch: true });
  ok("olagligt släpp (finger): pjäsen tillbaka och fortfarande markerad", /^d2, vit bonde/.test(await e.etikett("d2")) && (await e.lage()).vald[0] === "d2" && (await e.parti()).drag.length === 0);
  await e.dra("d2", "d4", { touch: true });
  ok("dra-och-släpp med finger d2–d4", (await e.parti()).drag[0] === "d4");
  ok("touch-action: none på brädets ram (fingret skrollar inte sidan)", (await p.ev(`getComputedStyle(document.querySelector(".schack-ram")).touchAction`)) === "none");
  await p.s("Emulation.setTouchEmulationEnabled", { enabled: false });
  await e.vantaDrag(2);
  await e.dra("g1", "f3");
  ok("dra-och-släpp med mus g1–f3", (await e.parti()).drag[2] === "Nf3", (await e.parti()).drag.join(" "));

  // Olagliga drag visas inte
  await e.injicera(["d3", "e5", "Nc3", "Bb4"]);
  await e.tryck("c3");
  l = await e.lage();
  ok("bunden springare c3: inga mål visas", l.vald[0] === "c3" && !l.mal.length && !l.malTar.length, JSON.stringify(l));
  await e.dra("c3", "d5");
  ok("bunden springare: dra till d5 går inte", /^c3, vit springare/.test(await e.etikett("c3")) && (await e.parti()).drag.length === 4);

  // Schack: röd glöd, status, bara räddande drag
  await e.injicera(["e4", "f5", "Qh5+"], { egenFarg: "b" });
  l = await e.lage();
  ok("kung i schack: röd glöd på e8", l.schack.join() === "e8", l.schack.join());
  ok("aria-label 'i schack'", /^e8, svart kung, i schack/.test(await e.etikett("e8")), await e.etikett("e8"));
  ok("status 'Schack! Din tur – rädda kungen!'", /^Schack! Din tur – rädda kungen!/.test(await e.status()), await e.status());
  ok("glöden ritas", await p.ev(`(() => { const r = document.querySelector('.schack-bradet [data-ruta="e8"]');
    return [getComputedStyle(r), getComputedStyle(r, "::before"), getComputedStyle(r, "::after")].some(c => (c.boxShadow && c.boxShadow !== "none") || (c.backgroundImage && c.backgroundImage !== "none")); })()`));
  await skarm("app-schack-glod");
  await e.tryck("g7");
  ok("i schack: bara räddande drag (g7 → bara g6)", (await e.lage()).mal.join() === "g6", (await e.lage()).mal.join());
  await e.tryck("d7");
  ok("i schack: d7 har inga mål", !(await e.lage()).mal.length && !(await e.lage()).malTar.length);
}
