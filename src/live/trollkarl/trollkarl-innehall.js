// ============================================================================
// Trollkarlsduellen (#536): MANIFESTET – alla attack-, final- och ljudmoduler.
// En ny attack (del C/D) eller final/ljud (del E) = en egen modul som
// registrerar sig (trollkarl-register.js) + EN importrad här.
// Platshållarna används bara tills riktiga attacker/finaler finns.
// ============================================================================

import "./trollkarl-platshallare-effekter.js";
// Del C (#538): attacker 1–8. Del D lägger sina moduler (attack 9–15) här.
import "./attacker/attacker-forvandling.js"; // 1 GRODIFIX! · 2 HÖNUS PANIKUS! · 3 POTATUS TOTALUS!
import "./attacker/attacker-vader.js"; //       4 REGNUS MAXIMUS! · 8 FJÄDRUS STORMUS!
import "./attacker/attacker-kladd.js"; //       5 STINKUS MAXIMUS! · 6 BANANUS HALKUS! · 7 SLEMMUS BLÄÄÄUS!
// Del E (#540): ljud (§12) + finaler (§14).
import "./trollkarl-ljud.js"; //         alla ljudnycklar (Web Audio) + reserv "*"
import "./final/final-vinst.js"; //      energikula · potatis-gigantus · drakus-finalus
import "./final/final-oavgjort.js"; //   magisk-krock (§14.4)
