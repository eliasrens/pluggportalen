// ============================================================================
// Guldrushen 💰 – SPELREGLERNA som ren logik (#563, epic #562). Delas med
// servern (functions/guldrush/ = genererad kopia, se chests-config.js) så att
// Cloud Functionen och elevens offerlista avgör EXAKT samma sak. Servern är
// ändå den enda som skriver guld – klienten använder bara reglerna för att
// grå:a ut offer som servern ändå skulle neka.
// Logiken är den gemensamma kistmotorn (#651): src/live/kistspel/delat/
// ks-regler.js createKistRegler – här bara Guldrushens kisttabell, rattar och
// texter. Importerna är kistkonfigen + motorn (i kopian functions/guldrush/
// skrivs motorns väg om till ../kistspel/, admin/sync-guldrush-functions.mjs).
//
// Spelare (grPlayers-dokumentet, se docs/DATAMODELL.md "Guldrushen"):
//   { uid, gold, protectedUntil, lastVictimUid, … } – tider som ms eller
//   Firestore-Timestamp (toMs).
//
// ETT SKYDD (#588): protectedUntil. Skyddad = protectedUntil > nu – ingen kan
// stjäla från eller byta med eleven. Sköld-kistan → nu + GR_RULES.shieldMs
// (60 s; redan skyddad → förlängs till 60 s från nu), bestulen/bytt → nu +
// GR_RULES.protectionMs (30 s). Skyddet går ut av sig självt; servern prövar
// det i ögonblicket valet görs (victimProblem), slumpen tar bara oskyddade.
//
// TRYGGHET (§6.5) – kontrolleras här och av servern:
//   • skyddad elev (ovan) går inte att välja
//   • ingen stjäl/byter med samma elev två gånger i rad (lastVictimUid)
//   • ingen effekt nollställer: stöld ≤ 15 %, hål i fickan ≤ 10 %, byte bara
//     med någon som har MER guld och bara om man själv har guld
//
// API
//   GR_REGLER                       hela regelobjektet (createKistRegler) –
//                                   det kistspel-modulerna tar som `regler`
//   toMs(t)                         → ms | null
//   chestById(id)                   → kista | null
//   isVictimKind(chest)             → bool (stöld/byte – eleven väljer offer)
//   chestTable(stealSwap)           → [{ chest, weight }] – vikterna som gäller
//   rollChest(stealSwap, rng)       → kista (rng() i [0,1))
//   applySelfEffect(chest, gold)    → { delta, gold, protect }  (ej stöld/
//                                     byte; protect = kistan ger skydd)
//   isProtected(p, now)             → bool
//   protectedLeftMs(p, now)         → ms kvar av skyddet (0 = oskyddad)
//   shieldUntil(now)                → protectedUntil (ms) efter Sköld-kistan
//   hitProtectionUntil(p, now)      → protectedUntil (ms) efter bestulen/bytt
//   victimProblem(kind, thief, victim, now) → null | orsak ("sig-sjalv",
//                                     "saknas", "skyddad", "samma-igen",
//                                     "for-lite-guld", "inte-mer-guld",
//                                     "inget-eget-guld")
//   victimMessage(orsak, victim?)   → elevvänlig text ("🛡️ Alma hann skaffa
//                                     en sköld!")
//   eligibleVictims(kind, thief, players, now) → spelare som går att välja
//                                     (servern slumpar bland dem)
//   resolveVictim(kind, thief, victim) → { amount, thiefGold, victimGold }
//   eventText(ev, { names, short? }) → händelsens text (ev från grEvents);
//                                     short = flödets korta rad (feedText, #591)
//                                     ("{mynt}" = mynt-ikonens markör, #590)
// ============================================================================

import { GR_CHESTS, GR_EVENT_TEXTS, GR_ANON, GR_RULES, GR_COIN } from "./chests-config.js";
import { createKistRegler } from "../kistspel/ks-regler.js";

// Offerväljarens/serverns förklaring när ett val nekas ({namn} = offrets förnamn).
const MESSAGES = {
  "saknas": "Den eleven är inte med i matchen.",
  "sig-sjalv": "Du kan inte välja dig själv.",
  "skyddad": "🛡️ {namn} hann skaffa en sköld!",
  "samma-igen": "Du kan inte välja samma elev två gånger i rad.",
  "for-lite-guld": "Den eleven har för lite guld att knycka.",
  "inte-mer-guld": "Du kan bara byta med någon som har mer guld än du.",
  "inget-eget-guld": "Du behöver eget guld för att byta.",
};

export const GR_REGLER = createKistRegler({
  chests: GR_CHESTS,
  rules: GR_RULES,
  eventTexts: GR_EVENT_TEXTS,
  anon: GR_ANON,
  messages: MESSAGES,
  vars: { mynt: GR_COIN }, // markören står kvar – UI:t byter den mot mynt-ikonen
});

export const {
  toMs, chestById, isVictimKind, chestTable, rollChest, applySelfEffect, isProtected, protectedLeftMs,
  shieldUntil, hitProtectionUntil, victimProblem, victimMessage, eligibleVictims, resolveVictim, eventText,
} = GR_REGLER;
