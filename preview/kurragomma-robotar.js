// Bara förhandsvisningen (#837): en lokal avatar-roster (ingen Firebase) och
// robot-sökare som vandrar runt på ön med motorns kollision, så att scenens
// interpolering (~150 ms) och billboard-figurerna kan ses utan server.
import { createAvatarRoster } from "../src/live/design/live-avatars.js";
import { kollidera } from "../src/live/formats/kurragomma/delat/kg-geometri.js";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import { MAX_FART, POS_MIN_INTERVALL_MS } from "../src/live/formats/kurragomma/delat/kg-config.js";
import { skapaPrng } from "../src/live/formats/kurragomma/delat/kg-prng.js";

export const DJUR = ["fox", "owl", "cat", "dog", "panda", "frog", "unicorn", "dragon", "lion", "penguin", "koala", "robot", "bjorn",
  "tiger", "rabbit", "pig", "cow", "monkey", "hamster", "mouse", "chick", "sheep", "hedgehog", "wolf", "deer", "raccoon",
  "turtle", "bee", "elephant", "goat"];
export const KLADER = [["trollkarlshatt", "cape"], ["krona", "medalj"], ["keps", "glasogon"], ["partyhatt", "ballong"],
  ["vikinghjalm", "cape"], ["strahatt", "blomma"], ["monokel", "fluga"], ["riddarhjalm", "svard", "cape"], ["kockmossa", "slips"], []];
export const NAMN = ["Jag", "Alma", "Omar", "Ines", "Leo", "Clara", "Sam", "Ella", "Noah", "Maja", "Elias", "Wilma", "Adam", "Saga", "Hugo",
  "Vera", "Liam", "Nora", "Ali", "Selma", "Melvin", "Tyra", "Isak", "Juni", "Otto", "Stella", "Malte", "Siri", "Ebbe", "Lova"];

/** Roster-stub: "jag" + e1..eN ur klassprojektionen i minnet (en läsning). */
export async function skapaRosterStub(antal = NAMN.length) {
  const members = {};
  for (let i = 0; i < antal; i++) {
    members[i === 0 ? "jag" : `e${i}`] = { namn: NAMN[i], avatarId: DJUR[i % DJUR.length], avatarItems: KLADER[i % KLADER.length] };
  }
  const roster = createAvatarRoster({ load: async () => ({ members }) });
  await roster.ensure(Object.keys(members).map((uid) => ({ uid, classId: "4b" })));
  return roster;
}

/**
 * Robot-sökare: går mot ett slumpat mål, byter mål när de är framme eller fastnat.
 * Skickar positioner till scen.sokare(...) högst var POS_MIN_INTERVALL_MS (5/s) som servern.
 */
export function skapaRobotar(scen, { antal = 5, fro = 7, fart = 0.6, forsta = 1 } = {}) {
  const slump = skapaPrng(fro).tal;
  const robotar = Array.from({ length: antal }, (_, i) => ({
    uid: `e${forsta + i}`, namn: NAMN[(forsta + i) % NAMN.length],
    x: Math.cos(slump() * 6.28) * 20, z: Math.sin(slump() * 6.28) * 20, yaw: 0, mal: null, stilla: 0,
  }));
  const nyttMal = () => { const a = slump() * 6.28, r = 4 + slump() * 24; return { x: Math.cos(a) * r, z: Math.sin(a) * r }; };
  let sist = performance.now(), sistSkick = 0, pa = true, raf = 0;
  function steg(nu) {
    raf = requestAnimationFrame(steg);
    const dt = Math.min(0.05, (nu - sist) / 1000);
    sist = nu;
    if (!pa) return;
    for (const r of robotar) {
      if (!r.mal || Math.hypot(r.mal.x - r.x, r.mal.z - r.z) < 0.5 || r.stilla > 0.7) { r.mal = nyttMal(); r.stilla = 0; }
      r.yaw = Math.atan2(r.mal.x - r.x, r.mal.z - r.z);
      const s = MAX_FART * fart * dt;
      const p = kollidera(r.x + Math.sin(r.yaw) * s, r.z + Math.cos(r.yaw) * s, ON);
      r.stilla = Math.hypot(p.x - r.x, p.z - r.z) < s * 0.2 ? r.stilla + dt : 0;
      r.x = p.x; r.z = p.z;
    }
    if (nu - sistSkick >= POS_MIN_INTERVALL_MS) {
      sistSkick = nu;
      scen.sokare(robotar.map((r) => ({ uid: r.uid, x: r.x, z: r.z, yaw: r.yaw, t: nu, namn: r.namn })));
    }
  }
  raf = requestAnimationFrame(steg);
  return {
    robotar,
    pa(v) { pa = v; },
    slumpad() { return robotar[Math.floor(slump() * robotar.length)]; },
    stopp() { cancelAnimationFrame(raf); },
  };
}
