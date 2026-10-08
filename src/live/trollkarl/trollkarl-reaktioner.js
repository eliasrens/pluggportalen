// ============================================================================
// Trollkarlsduellen (#539): MATCHREAKTIONER (§10) – figurerna reagerar på
// matchläget mellan attackerna: ledningsbyte (ny ledare jublar, den andra
// oroar sig), sista minuten (båda sneglar upp mot matchklockan) och snabb
// uppladdning (egen mätare nästan full → liten jubelgest). Lägsta prioritet:
// triggar BARA när regin är helt ledig (director.idle()) – poserna som används
// (cheer/worried, prio charge) viker sig dessutom själva för en riktig attack.
// Ren DOM-fri logik + WAAPI via wizard-API:t; reducedMotion → bara uttryck.
// ============================================================================

export function createReactions({ sides, director, reducedMotion = false }) {
  let ledare = null; // senaste ENTYDIGA ledaren (classId)
  let minutSagd = false;
  const naraForut = {};

  const lugnt = (d) => d.phase === "live" && !d.ended && director.idle();
  const wiz = (d, classId) => {
    const side = d.sides.find((s) => s.classId === classId)?.side;
    return side ? sides[side]?.wizard : null;
  };
  const spela = (w, pose, exp) => {
    if (!w) return;
    if (exp) w.setExpression(exp);
    w.play(pose).catch(() => {});
    if (exp) setTimeout(() => w.setExpression("neutral"), 2000);
  };

  // Blicken upp mot klockan (HUD:ens mitt) – liten huvudrörelse, inget mer.
  function sneglaPaKlockan(w) {
    if (!w) return;
    w.setExpression("surprised");
    if (!reducedMotion) {
      w.layer("head")?.animate([
        { transform: "translate(0px,0px) rotate(0deg)" },
        { transform: "translate(3px,-5px) rotate(-9deg)", offset: 0.3 },
        { transform: "translate(3px,-5px) rotate(-9deg)", offset: 0.75 },
        { transform: "translate(0px,0px) rotate(0deg)" },
      ], { duration: 1800, easing: "ease-in-out" });
    }
    setTimeout(() => w.setExpression("neutral"), 1900);
  }

  return {
    /** Anropas från vyn varje update: d = duelData, meters = magimätarna. */
    update(d, meters = {}) {
      if (!d || d.phase !== "live" || d.ended) {
        ledare = d?.leaderId ?? ledare;
        return;
      }
      // 1) Ledningsbyte: ny entydig ledare → jubel + oro hos motståndaren.
      if (d.leaderId && d.leaderId !== ledare) {
        const bytte = !!ledare; // första ledaren får en mildare reaktion
        if (lugnt(d)) {
          spela(wiz(d, d.leaderId), "cheer", "happy");
          if (bytte) {
            const andra = d.sides.find((s) => s.classId !== d.leaderId);
            if (andra) spela(wiz(d, andra.classId), "worried", "sad");
          }
        }
        ledare = d.leaderId;
      }
      // 2) Sista minuten: båda sneglar upp mot klockan (en gång per match).
      if (!minutSagd && d.msLeft > 0 && d.msLeft <= 60_000) {
        minutSagd = true;
        if (lugnt(d)) for (const s of d.sides) sneglaPaKlockan(wiz(d, s.classId));
      }
      // 3) Egen klass laddar snabbt: mätaren blir "nästan full" → jubelgest.
      for (const s of d.sides) {
        const nara = !!meters[s.classId]?.near;
        if (nara && !naraForut[s.classId] && lugnt(d)) spela(wiz(d, s.classId), "cheer", "happy");
        naraForut[s.classId] = nara;
      }
    },
  };
}
