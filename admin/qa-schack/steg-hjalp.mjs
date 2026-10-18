// Schack-QA (#777) steg "hjalp": spec §3.3 + §4 (Varna mig, Ångra, Tips, slut, omladdning) i appen.
const vila = (ms) => new Promise((r) => setTimeout(r, ms));
const varnText = (p) => p.ev(`document.querySelector("#schack-varna-text").textContent`);

export default async function hjalp({ p, e, ok, skarm, ORIGIN }) {
  await e.startaParti("bonden", "w");

  // Varna mig: matt i ett
  await e.injicera(["f3", "e5"], { niva: "bonden" });
  await e.tryck("g2");
  await e.tryck("g4");
  ok("Varna mig: g4 (datorn kan göra matt) varnar", await e.synlig(".schack-varna-ruta"), await varnText(p));
  ok("Varna mig: pjäsen väntar halvgenomskinlig på g4", (await e.lage()).vantar.includes("g4"));
  ok("Varna mig: status 'Vänta – läs varningen!'", /Vänta/.test(await e.status()), await e.status());
  ok("Varna mig: knapparna Ångra + Flytta ändå", await p.ev(`[...document.querySelectorAll(".schack-varna-ruta button")].map(b => b.textContent).join() === "Ångra,Flytta ändå"`));
  await skarm("app-varna-matt");
  await e.klick(`[data-act="varna-angra"]`);
  ok("Varna mig → Ångra: bonden tillbaka på g2, inget drag", /^g2, vit bonde/.test(await e.etikett("g2")) && (await e.parti()).drag.length === 2 && !(await e.synlig(".schack-varna-ruta")));
  ok("Varna mig → Ångra: status Din tur", /^Din tur/.test(await e.status()), await e.status());
  await e.tryck("d2");
  await e.tryck("d3");
  ok("Varna mig: vanligt drag (d3) varnar inte", !(await e.synlig(".schack-varna-ruta")) && (await e.parti()).drag.length >= 3);
  // Varna mig: damen kan tas
  await e.injicera(["e4", "e5", "Qh5", "Nc6"], { niva: "springaren" });
  await e.tryck("h5");
  await e.tryck("h6");
  ok("Varna mig: damen till h6 (kan tas gratis) varnar", await e.synlig(".schack-varna-ruta"), await varnText(p));
  ok("varningstexten nämner damen", /dam/.test(await varnText(p)));
  await skarm("app-varna-dam");
  await e.klick(`[data-act="varna-anda"]`);
  ok("Flytta ändå → draget görs", (await e.parti()).drag[4] === "Qh6");
  // Tornet: av som standard
  await e.injicera(["e4", "e5", "Qh5", "Nc6"], { niva: "tornet", varna: false });
  ok("Tornet: Varna mig av", !(await p.ev(`document.querySelector('[data-act="varna"]').checked`)));
  await e.tryck("h5");
  await e.tryck("h6");
  ok("Tornet utan Varna mig: ingen varning, draget görs", !(await e.synlig(".schack-varna-ruta")) && (await e.parti()).drag[4] === "Qh6");
  // Damen: slå på manuellt, sparas; datorn gör matt i ett
  await e.injicera(["f3", "e5"], { niva: "damen", varna: false });
  await e.klick(`[data-act="varna"]`);
  ok("Varna mig går att slå på och sparas i partiet", (await e.parti()).varna === true);
  await e.tryck("g2");
  await e.tryck("g4");
  ok("Damen + Varna mig på: g4 varnar", await e.synlig(".schack-varna-ruta"));
  await e.klick(`[data-act="varna-anda"]`);
  await e.vantaDrag(4);
  await vila(400);
  ok("Damen hittar matt i ett (Dh4#)", (await e.parti()).drag[3] === "Qh4#", (await e.parti()).drag.join(" "));
  ok("status 'Schack matt – datorn vann.'", /^Schack matt – datorn vann\./.test(await e.status()), await e.status());
  ok("slutrutan: Spela igen, Byt nivå, Titta på brädet", await p.ev(`(() => { const s = document.querySelector(".schack-slut");
    return !s.hidden && ["Spela igen", "Byt nivå", "Titta på brädet"].every(t => s.textContent.includes(t)); })()`));
  await skarm("app-slut-forlust");
  // Eleven gör matt
  await e.injicera(["f3", "e5", "g4"], { egenFarg: "b", niva: "tornet" });
  await e.tryck("d8");
  await e.tryck("h4");
  ok("eleven gör matt: 'Schack matt – du vann! 🎉'", /^Schack matt – du vann! 🎉/.test(await e.status()), await e.status());
  await skarm("app-slut-vinst");
  await e.klick(`.schack-slut button:last-of-type`);
  ok("Titta på brädet stänger slutrutan", await p.ev(`document.querySelector(".schack-slut").hidden`));
  await e.klick(`[data-act="angra"]`);
  ok("Ångra efter matt: partiet öppnas igen", !(await e.parti()).slut && (await e.parti()).drag.length === 3, (await e.parti()).drag.join(" "));
  // Spela igen
  await e.injicera(["f3", "e5", "g4"], { egenFarg: "b", niva: "tornet" });
  await e.tryck("d8");
  await e.tryck("h4");
  await p.ev(`[...document.querySelectorAll(".schack-slut button")].find(b => b.textContent === "Spela igen").click()`);
  await vila(800);
  ok("Spela igen: nytt parti, samma nivå och färg", (await e.parti()).drag.length <= 1 && (await e.parti()).niva === "tornet" && (await e.parti()).egenFarg === "b");

  // Ångra + Tips
  await e.injicera(["e4", "e5"], { niva: "springaren" });
  await e.tryck("g1");
  await e.tryck("f3");
  await e.vantaDrag(4);
  await vila(100);
  await e.klick(`[data-act="angra"]`);
  ok("Ångra tar tillbaka elevens drag + datorns svar", (await e.parti()).drag.length === 2 && /^g1, vit springare/.test(await e.etikett("g1")), (await e.parti()).drag.join(" "));
  await e.klick(`[data-act="tips"]`);
  await p.vanta(`/Tips:/.test(document.querySelector(".schack-tips-text").textContent)`, 8000);
  const tips = await p.ev(`document.querySelector(".schack-tips-text").textContent`);
  ok("Tips: text + pil på brädet", /^Tips: \S+/.test(tips) && (await p.ev(`document.querySelector(".schack-pilar").children.length`)) > 0, tips);
  await skarm("app-tips-pil");
  await e.elevDrag();
  ok("pilen försvinner vid nästa drag", (await p.ev(`document.querySelector(".schack-pilar").children.length`)) === 0);
  await e.vantaDrag(4);
  await vila(100);
  await e.elevDrag({ helstSlag: false });
  await e.klick(`[data-act="angra"]`);
  await vila(1500);
  ok("Ångra medan datorn tänker: bara elevens drag, inget sent svar", (await e.parti()).drag.length === 4 && /^Din tur/.test(await e.status()), `${(await e.parti()).drag.length} drag, ${await e.status()}`);
  ok("Tips finns bara på elevens tur (knappen aktiv nu)", !(await p.ev(`document.querySelector('[data-act="tips"]').disabled`)));

  // Omladdning + Fortsätt partiet
  await e.elevDrag();
  await e.vantaDrag(6);
  await vila(100);
  const sparat = (await e.parti()).drag.join(" ");
  await e.oppna("#/elev/schack");
  await p.vanta(`!!document.querySelector(".schack-kort")`, 20000);
  ok("startsidan: pågående parti överst med Fortsätt partiet", await p.ev(`(() => { const s = document.querySelector(".schack-pagaende");
    return !!s && !!(s.compareDocumentPosition(document.querySelector(".schack-kort-rad")) & 4) && /Fortsätt partiet/.test(s.textContent); })()`),
  await p.ev(`document.querySelector(".schack-pagaende")?.innerText.replace(/\\n/g, " ")`));
  await skarm("app-start-pagaende");
  await e.klick(`[data-act="fortsatt"]`);
  await e.bradeKlart();
  await vila(300);
  ok("Fortsätt partiet: samma drag som före omladdningen", (await e.parti()).drag.join(" ") === sparat, sparat);
  ok("hashen skrivs om till ?vy=dator", (await p.ev("location.hash")) === "#/elev/schack?vy=dator");
  await p.laddaOm();
  await e.bradeKlart();
  await vila(300);
  ok("omladdning direkt i partiet fortsätter det", (await e.parti()).drag.join(" ") === sparat && (await e.lage()).senast.length === 2);

  // Ge upp
  await e.klick(`[data-act="geupp"]`);
  ok("Ge upp: frågan i en ruta på sidan", await e.synlig(".schack-geupp-ruta"));
  await e.klick(`[data-act="geupp-ja"]`);
  ok("Ge upp: 'Du gav upp – datorn vann.'", /Du gav upp/.test(await e.status()), await e.status());
  ok("Ångra går inte efter Ge upp", await p.ev(`document.querySelector('[data-act="angra"]').disabled`));
  await e.oppna("#/elev/schack");
  await p.vanta(`!!document.querySelector(".schack-kort")`, 20000);
  ok("avslutat parti visas inte som pågående", !(await p.ev(`!!document.querySelector(".schack-pagaende")`)));
  ok("inga confirm()/alert() användes", !p.konsol.some((k) => /confirm|alert/.test(k)));
}
