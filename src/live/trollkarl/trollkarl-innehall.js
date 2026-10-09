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
// Del D (#539): attacker 9–15 + två extra (§8 kreativ frihet).
import "./attacker/attacker-rorelse.js"; //     9 SNURRUS YRUS! · 12 BLIXTUS HOPPUS! · 15 STUDSUS MAXIMUS!
import "./attacker/attacker-objekt.js"; //      10 HATTUS GIGANTUS! · 11 BUBBLUS FLYGUS! · 13 NYSUS MEGUS! · 14 DRAKUS MINIUS!
import "./attacker/attacker-extra.js"; //       16 FÅRUS RAMMUS! · 17 DANSUS DISCUS!
// Del E (#540): ljud (§12) + finaler (§14).
import "./trollkarl-ljud.js"; //         alla ljudnycklar (Web Audio) + reserv "*"
import "./final/final-vinst.js"; //      energikula · potatis-gigantus · drakus-finalus
import "./final/final-oavgjort.js"; //   magisk-krock (§14.4)
