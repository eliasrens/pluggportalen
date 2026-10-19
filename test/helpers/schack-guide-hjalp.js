// Delade hjälpare för guidens tester (#790): spela en stjärnjakt med tryck.
import assert from "node:assert/strict";

/** Spela en väg (rutor) genom kontrollen med tryck: pjäsen, sedan målrutan. */
export function spela(k, vag) {
  for (const till of vag) {
    const fran = k.getState().pjaser[0].ruta;
    assert.equal(k.tryck(fran).typ, "vald", `välj ${fran}`);
    assert.equal(k.tryck(till).typ, "drag", `${fran}→${till}`);
  }
}
