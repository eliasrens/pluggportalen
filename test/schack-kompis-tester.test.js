// ============================================================================
// Schack 2B (#780) – testarens pinnar för fynd som inte rättats än.
// Körs med: node --test test/schack-kompis-tester.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const las = (p) => readFileSync(join(ROOT, p), "utf8");

describe("F1: utloggning lämnar en kvarglömd väntan i lobbyn", () => {
  // Verifierat i riktiga appen mot emulatorerna: Alva trycker "Vänta på en motståndare", loggar ut
  // via sidomenyn → Bilal ser "Alva väntar · 10 min" i upp till 10 min och kan trycka Spela! mot
  // en spöke. Orsak: logout-knappen anropar data.logout() (signOut) FÖRE hashchange; när
  // page-schack.js stänger lyssnaren är eleven redan utloggad och schackSlutaVanta nekas.
  it("logga-ut-knappen låter schacksidan ta bort väntan FÖRE data.logout()", () => {
    const ui = las("src/ui.js");
    const start = ui.indexOf('#logout-btn").addEventListener');
    assert.ok(start > 0, "logout-knappens lyssnare hittades");
    const handler = ui.slice(start, ui.indexOf("data.logout()", start));
    assert.match(handler, /schack/i, "ett schack-steg (t.ex. window.__ppSchackLamna) körs före data.logout()");
  });
});
