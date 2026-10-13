# Datakuppen – elevvyn (#653), skärmdumpar 1366×768

Allt syns utan scroll (scrollHeight = 768 i alla lägen).

| Fil | Läge | Källa |
| --- | --- | --- |
| 01-kodval-lobby | Lobbyn: välj kod bland 4 (monospace, siffror i cyan, snedstreckad nolla) + säkerhetstips | appen mot emulatorerna |
| 02-fraga | Spel: data, "Din kod", läge i MB (aldrig placering), fråga | appen mot emulatorerna |
| 03-filer | Tre krypterade filer efter rätt svar | appen mot emulatorerna |
| 04-dekryptering | Dekrypteringen: förloppsstapel + rullande tecken | förhandsvisningen (låtsasserver, långsam) |
| 05-hack-steg1 | Målväljaren: skyddade gråade med nedräkning, "Nyss hackad", "För lite data" | appen mot emulatorerna |
| 06-hack-steg2 | Tre stora kodkort | appen mot emulatorerna |
| 07-hack-fel-kod-struken | Fel kod: kortet stryks | appen mot emulatorerna |
| 08-hack-andra-forsoket-struken-borta | Andra försöket mot samma mål: den strukna koden är borta | appen mot emulatorerna |
| 09-hack-ratt-kod | Rätt kod: data flyttas | appen mot emulatorerna |
| 10-bli-hackad-notis | Notisen "Ivar knäckte din kod och tog 8 MB!" + skydd 0:30 | appen mot emulatorerna |
| 11-valj-ny-kod | "Välj ny kod" ovanför frågan – spelet fortsätter | appen mot emulatorerna |
| 12-slut | Slutskärmen: läget, data, tillsammans, säkerhetstips | förhandsvisningen |
| 13-quiz | Quiz (flerval) i Datakuppens stil | förhandsvisningen |

Emojierna syns som ▯ i den huvudlösa testwebbläsaren (inget emoji-typsnitt) – i Chrome/Windows ritas de.
Recept: `admin/qa-guldrush-preview.sh` (FS/AUTH/FN/PROXY-portar) + `admin/qa-datakuppen-elev.mjs lobby|start|hack [igen]|hackad|skydd|slut`, logga in som b01 / lilla123.
Förhandsvisningen: `preview/preview-datakuppen-elev.html` (simuleringspanel nere till vänster).
