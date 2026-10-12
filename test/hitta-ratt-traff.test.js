// ============================================================================
// Hitta rätt! – träffregeln för klickringar (#640). Ingen DOM.
// Körs med: node --test test/hitta-ratt-traff.test.js
// Täcker traff.js: ett klick på ett annat områdes yta väljer det området när
// ytan är liten (Israel under Palestina-ringen), ringen vinner nära sin mitt
// och över hav eller stora grannländer, och överlappande ringar avgörs av
// närmaste mitt.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { RING_R, ANDEL, ringRackvidd, valjTraff } from "../src/hitta-ratt/karta/traff.js";

test("ringRackvidd: hela ringen över hav, krymper med grannens smalaste mått", () => {
  assert.equal(ringRackvidd(null, 0), RING_R, "hav/bakgrund: hela ringen");
  assert.equal(ringRackvidd("FRA", 400), RING_R, "stort grannland: hela ringen");
  assert.equal(ringRackvidd("ISR", 4), 4 * ANDEL, "litet grannland: nästan ingen ring");
  assert.equal(ringRackvidd("X", -3), 0);
  assert.ok(ringRackvidd("X", 10) * 2 < 10, "ringen täcker aldrig grannens hela bredd");
});

test("valjTraff: klick på ett litet grannlands yta inne i ringen väljer grannlandet", () => {
  // Israel (4 px brett i helvy) under Palestina-ringen, 3 px från mitten.
  assert.equal(valjTraff({ yta: "ISR", smalast: 3.8, ringar: [{ id: "PSX", d: 3 }] }), "ISR");
  // Samma klick ovanpå tre ringar (Levanten).
  const tre = [{ id: "PSX", d: 4 }, { id: "LBN", d: 6 }, { id: "CYP", d: 10 }];
  assert.equal(valjTraff({ yta: "ISR", smalast: 3.8, ringar: tre }), "ISR");
});

test("valjTraff: nära ringens mitt eller på dess eget område vinner ringen", () => {
  assert.equal(valjTraff({ yta: "ISR", smalast: 3.8, ringar: [{ id: "PSX", d: 1 }] }), "PSX", "mycket nära mitten");
  assert.equal(valjTraff({ yta: "PSX", smalast: 1.9, ringar: [{ id: "PSX", d: 2 }, { id: "LBN", d: 1 }] }), "PSX",
    "klick på ringens eget lilla område väljer det, även om en annan ringmitt är närmare");
});

test("valjTraff: över hav eller ett stort grannland tar ringen hela sin yta", () => {
  assert.equal(valjTraff({ yta: null, ringar: [{ id: "MLT", d: 11.5 }] }), "MLT", "Malta: hav runt om");
  assert.equal(valjTraff({ yta: "ITA", smalast: 300, ringar: [{ id: "VAT", d: 11 }] }), "VAT", "Vatikanen i Italien");
  assert.equal(valjTraff({ yta: "FRA", smalast: 200, ringar: [{ id: "MCO", d: 9 }] }), "MCO");
  assert.equal(valjTraff({ yta: "FRA", smalast: 200, ringar: [] }), "FRA", "utanför ringen: ytan");
  assert.equal(valjTraff({ yta: null, ringar: [] }), null, "hav utan ring: inget val");
});

test("valjTraff: överlappande ringar – närmaste mitt vinner", () => {
  const ringar = [{ id: "CYP", d: 9 }, { id: "LBN", d: 4 }, { id: "PSX", d: 7 }];
  assert.equal(valjTraff({ yta: null, ringar }), "LBN");
  // Över en medelstor granne (Syrien, 18 px): bara ringar inom räckvidden räknas.
  assert.equal(valjTraff({ yta: "SYR", smalast: 18, ringar: [{ id: "LBN", d: 9 }, { id: "CYP", d: 11 }] }), "SYR");
  assert.equal(valjTraff({ yta: "SYR", smalast: 18, ringar: [{ id: "CYP", d: 11 }, { id: "LBN", d: 5 }] }), "LBN");
});
