# CLAUDE.md

## Vad projektet ska göra och vilket problem det löser

**Kommunkollen Stockholm** blir en webbapp som beskriver levnadsförhållanden, befolkning, trygghet, service och
boendemiljö i olika delar av Stockholms kommun. Den ska göra det på tre geografiska nivåer:

- **Stadsdelsområden (11 st):** stadens indelning sedan 1 juli 2023, t.ex. Järva, Södermalm och Bromma.
- **Grannskap (127 st):** SCB:s regionala statistikområden (RegSO), t.ex. Blackeberg, Tensta och Hammarbyhöjden.
- **DeSO-områden (569 st):** SCB:s minsta statistikområden, som man ska hamna i när man
  söker på en adress.

För varje område ska appen visa:

- **Siffror:** befolkningens sammansättning (ålder, hushållstyper, ekonomisk standard, utbildningsnivå,
  sysselsättning, upplåtelseform, hustyp, utländsk bakgrund, bilinnehav och bebyggelsens ålder).
- **Utveckling:** hur befolkning, inkomst, andel hyresrätter och andel barn har förändrats sedan 2015.
- **En sammanfattning** i klartext.
- **En jämförelse** med det större området: grannskap jämförs med sitt stadsdelsområde, stadsdelsområden med hela
  Stockholm.

Appen ska bara använda fri, öppen data från svenska myndigheter, hittad via Sveriges dataportal.

Man ska kunna söka på en adress, ett grannskap eller ett stadsdelsområde och få svar på det man undrar där man
bor, eller om man funderar på att flytta dit:

- vilka som bor där och hur området har förändrats sedan 2015
- brottslighet och polisens händelser
- skolor och förskolor
- butiker, vård och restauranger
- natur och vatten, och översvämningsrisk vid skyfall
- hyror, kötider, priser och byggprojekt
- hur man röstade i valet 2026

Allt ska jämföras med stadsdelsområdet eller hela Stockholm.

**Problemet:** informationen finns, men den är spridd över ett dussintal myndigheter, i olika format och på
olika geografiska nivåer. Kommersiella sajter visar delar av den, ofta som en svart låda. Kommunkollen ska samla
källorna på en gemensam geografi (SCB:s DeSO-områden), så att de går att jämföra. Varje siffra ska kunna spåras
till en myndighet, och appen ska vara öppen med vad datan inte kan svara på. Källhänvisning och transparens är
viktigt.

## Vald teknikstack och varför

Valen är bestämda.

| Del        | Val                                                                                                                       | Varför                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ramverk    | **Next.js 15** (App Router, serverkomponenter) + **TypeScript**. Next.js är ett ramverk jag inte har jobbat med tidigare. | Data ska hämtas på servern, så att API-detaljer döljs och CORS-problemen som vissa av API:erna har (SCB, Skolverket) undviks. Lite JavaScript skickas till webbläsaren. Typningen ska fånga fel i datahanteringen. |
| Styling    | **Tailwind CSS v4** med tematokens                                                                                        | Snabbt att bygga ett konsekvent UI. Ljust och mörkt läge ska styras från en validerad färgpalett.                                                                                                                  |
| Diagram    | **Recharts**                                                                                                              | Enkla stapel- och linjediagram med tooltips, som React-komponenter.                                                                                                                                                |
| Kartor     | **Leaflet** + OpenStreetMap-kartbilder, MCF:s översvämningskartor som WMS                                                 | Gratis, utan API-nyckel. Klarar GeoJSON-områden, punkter och WMS-lager.                                                                                                                                            |
| Lagring    | **SQLite** via `better-sqlite3`                                                                                           | Polisens API visar bara de senaste 500 händelserna, så de måste sparas löpande. En fil räcker; ingen databasserver behövs.                                                                                         |
| Byggskript | **tsx**-skript med **Turf.js**, **proj4**, `shapefile`, `pngjs`, SheetJS                                                  | Långsamt föränderlig data ska byggas till statisk JSON. Samma språk och samma kod (API-klienter, områdeskoppling) delas med appen.                                                                                 |
| Tester     | **Vitest**                                                                                                                | Snabbt och TypeScript-vänligt. Ska testa parsning, beräkningar och data, med valfria live-tester mot API:erna.                                                                                                     |

## Arkitekturprinciper

- **DeSO är den gemensamma nyckeln.** Varje källa ska placeras i ett DeSO-område, via kod, koordinater eller
  överlappande yta. Grannskap och stadsdelsområden är bara mängder av DeSO-områden.
- **All extern I/O ska ske i ett lager:** API-klienter samlas i `lib/` och byggskript i `scripts/`. Komponenter
  ska aldrig anropa externa API:er direkt.
- **Hämtning och beräkning hålls isär.** Beräkningar (statistik per område, sammanfattningar, jämförelser) ska
  vara rena funktioner som tar data in och ger resultat ut, så att de går att testa utan nätverk.
- **Funktioner ska göra en sak** (separation of concerns), med tydliga namn och genomgående samma mönster.
- **Serverkomponenter som standard.** Klientkomponenter används bara för interaktivitet (kartor, diagram,
  filter). Leaflet får aldrig importeras i serverkod.
- **Långsamt föränderlig data blir statisk JSON** i `data/stockholm/`, byggd av skript. Live-anrop görs bara för
  SCB-statistik, geometri, adressökning och polishändelser.
- **Respektera källornas villkor:** cacha, håll rate limits, anropa aldrig delad infrastruktur per sidvisning,
  och ange källa och licens.
- **Inga globala muterbara variabler**, utom avsiktliga cachar och databasanslutningen på modulnivå. De ska vara
  tydligt kommenterade.
- **Jämför lika med lika.** Varje kort ska visa en jämförelse och en källrad, och redovisa osäkerhet och
  begränsningar på sidan i stället för att dölja dem. Aggregerade områden visar medelvärden, aldrig medianer.
- **Gränssnittet ska vara på svenska; kod, kommentarer och dokumentation på engelska.** Använd tematokens och
  den validerade färgpaletten.
- **Ändringar ska verifieras:** typkontroll, lint och tester ska gå igenom, och sidor ska kontrolleras med curl
  och skärmdumpar.

## Saker agenten INTE ska göra

- **Inte committa, pusha eller skapa PR:er** utan att användaren ber om det. Skapa en branch först.
- **Inte lägga till externa beroenden** (npm-paket, tjänster, API-nycklar) utöver stacken ovan utan att fråga.
- **Inte byta databas, ramverk, kart- eller diagrambibliotek**, och inte uppgradera `better-sqlite3` från v11
  eller Node utan att testa och fråga.
- **Inte stänga av TLS-verifiering** (t.ex. för Brå, vars server saknar ett mellancertifikat). Lägg i stället till
  certifikatet.
- **Absolut inte använda privata eller betalda källor**, eller skrapa sajter som Hemnet, Booli eller hitta.se.
  Appen ska bara bygga på öppna myndighetsdata.
- **Inte hitta på eller gissa data**, och inte dölja begränsningar. Saknas data ska sidan säga det.
- **Inte anropa** Overpass, Skolverket, Valmyndigheten, Brå eller MCF per sidvisning.
- **Inte ändra stadsdelsindelningen** (11 områden från 2023) eller områdeskopplingen för hand. Ändringar görs i
  skripten, som sedan körs om.
- **Inte radera eller skriva över** byggd data eller polisdatabasen utan att fråga, eftersom polishistoriken
  inte går att hämta igen.
- **Inte slå på diagramanimationer**, och inte blanda medianer och medelvärden i jämförelser.
- **Inte publicera appen** eller dela data externt innan alla licenser för de öppna API:erna är utförligt
  verifierade.
- **Aldrig manipulera datan på ett sätt som ändrar dess innebörd.** Om agenten manipulerar eller fritt tolkar
  data utan att motivera varför, kan det ge en missvisande bild av ett område.
