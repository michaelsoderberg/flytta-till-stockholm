# Granskning av kodbasen

## Arkitektur

Granskning av kodbasen mot arkitekturprinciperna i `CLAUDE.md`, gjord 2026-10-20.

**Läget vid granskningen:** typkontrollen (`tsc`) och lint ger inga fel, och testerna går igenom (20 godkända, 2
hoppade live-tester).

Statussymboler: ✅ följer principen, ⚠️ följer den delvis, ❌ bryter mot den.

### Sammanfattning

| Princip | Status |
|---|---|
| DeSO som gemensam nyckel | ⚠️ |
| All extern I/O i ett lager | ⚠️ |
| Hämtning och beräkning isär | ⚠️ |
| Funktioner gör en sak | ⚠️ |
| Serverkomponenter som standard, Leaflet aldrig på servern | ✅ |
| Långsam data som statisk JSON | ✅ |
| Respektera källornas villkor | ❌ (MCF anropas per sidvisning) |
| Inga globala muterbara variabler (utom kommenterade cachar) | ⚠️ |
| Jämför lika med lika, källa och jämförelse på varje kort | ⚠️ |
| Svenska i UI, engelska i kod, tematokens | ⚠️ |
| Verifiering (typkontroll, lint, tester) | ✅ men tunt |

### Där koden bryter mot principerna

**1. MCF anropas direkt från webbläsaren, per sidvisning.** Det bryter mot både "Inte anropa … MCF per
sidvisning" och "all extern I/O i ett lager".
- `components/ExploreMap.tsx:9` hårdkodar MCF:s WMS-adress och laddar översvämningslagret direkt från klienten.
- Det sker bara när användaren slår på lagret, men inget cachas.

**2. Komponenter gör externa anrop.**
- OSM-kartbilderna hämtas direkt i tre komponenter, med samma URL kopierad tre gånger: `components/ExploreMap.tsx:28`,
  `components/BoroughMap.tsx:28` och `components/AreaMap.tsx:12`.
- Med Leaflet går det inte helt att undvika, men URL:erna borde ligga på ett ställe, t.ex. `lib/map-sources.ts`, så att
  källorna är samlade.

**3. Beräkningar ligger i sidor och komponenter i stället för i rena funktioner.**
- `app/stadsdel/[id]/page.tsx:61–79`: rangordning, brottsstaplar, trendserie, placerad andel och sorterade grannskap
  räknas direkt i sidan. Inget av det är testat.
- `components/LocalSections.tsx` (431 rader) räknar själv:
  - Stockholms snitt: `:122`, `:175`, `:228`, `:280`
  - värden per 10 000 invånare: `:176–183`
  - kösortering: `:316–317`
  - kartgruppernas innehåll: `:54` och framåt

  Det borde vara funktioner i `lib/local.ts`, som redan är rent och testat.
- Stockholms jämförelsevärden räknas om i varje kort vid varje rendering, i stället för en gång.

**4. Sidrendering har en sidoeffekt.**
- `app/stadsdel/[id]/page.tsx:52` anropar `collectIfStale()`, som hämtar från Polisen och skriver till SQLite mitt i
  renderingen.
- Hämtning och sidvisning blandas, och en långsam Polis-API kan fördröja sidan.

**5. Modulvariabler utan kommentar eller tidsgräns.**
- `lib/trends.ts:35`: `loading` cachar för all framtid. Det är den kända buggen; utan tidsgräns kommer ny data aldrig in.
- `lib/geocode.ts:6`: `cache` växer obegränsat och saknar kommentar.
- `lib/db.ts:7` och `lib/police-areas.ts:68` saknar kommentarer om att de är avsiktliga.
- `lib/scb.ts:47` är rätt gjord: kommenterad och med 24 timmars tidsgräns.

### Där koden delvis följer principerna

**6. DeSO som gemensam nyckel.**
- Skolor, platser, byggprojekt, natur och översvämning placeras alla i DeSO (`scripts/lib/geo.ts`, `desoLocator()`). ✅
- Men följande går inte via DeSO:
  - brott (per stadsdelsområde, `lib/crime.ts`)
  - polishändelser (stadsdelsområde via text, `lib/police-areas.ts`)
  - val (RegSO, `scripts/build-elections.ts`)
  - hyror (inre staden/Söderort/Västerort, `RENT_AREA` i `lib/local.ts`)
  - kötider (stadsdelsnamn)
- Det beror på hur datan publiceras. Principen borde säga "där källan tillåter", annars bryter koden mot den.

**7. Funktioner gör en sak.**
- `collectEvents()` i `lib/polisen.ts:69` både hämtar, tolkar och skriver till databasen.
- `statsFor()` i `lib/profile.ts:117` räknar ut femton mått i en funktion (rimligt som samlingsfunktion, men lång).
- `HousingCard` och `MapCard` i `components/LocalSections.tsx` är stora.

**8. Jämförelse på varje kort.**
- Källrad finns på alla kort. ✅
- Men tre kort saknar referensvärde för Stockholm:
  - polishändelserna (`components/PoliceEvents.tsx`)
  - grannskapstabellen (`app/stadsdel/[id]/page.tsx:197`)
  - listan över bostadsprojekt

**9. Engelska i koden.**
- Kommentarerna är på engelska. ✅
- Identifierare är ofta svenska:
  - `lib/kommuner.ts:3` (`kod`, `namn`, `lanskod`)
  - måttnycklar i `lib/metrics.ts:21` (`"brott"`, `"inkomst"`)
  - kategorinycklar i `lib/local.ts` (`"matbutik"`, `"vard"`)
  - fält som `homesPlanned` blandat med `status: "planeras"`
- Loggmeddelanden i skripten är på svenska.

**10. Tematokens och palett.**
- Övriga komponenter använder tokens. ✅
- Kartorna har hårdkodade hexfärger som inte följer mörkt läge: `components/LocalSections.tsx:52`,
  `components/BoroughMap.tsx:50,60`, `components/ExploreMap.tsx:32,44` och `components/AreaMap.tsx:17`.
- Kartmarkörerna använder sju färger, mer än palettens testade tak på tre.

**11. Kvarlevor från den nationella versionen.**
- `getEventsForKommun()` (`lib/polisen.ts:106`) och `getCollectionStart()` (`:121`) används inte längre.
- `lib/kommuner.ts` och `data/kommuner.json` behövs bara för att tolka polisens titlar.

### Där koden följer principerna

- **Serverkomponenter som standard.** De 13 klientkomponenterna är alla interaktiva (kartor, diagram, filter,
  sökning).
- **Leaflet laddas bara i webbläsaren**, via `dynamic(..., { ssr: false })` i `components/AreaMapLazy.tsx`,
  `components/ExploreMapLazy.tsx` och `components/BoroughExplorer.tsx:11`. Färgskalan ligger separat i
  `lib/ramp.ts`.
- **Hämtning och beräkning isär i lib-lagret.**
  - `lib/profile.ts`: `loadStockholm()` hämtar, och `stats()` och `summarize()` är rena.
  - `lib/scb.ts`: `StatTable` är ren, `queryTable` gör I/O.
  - `lib/local.ts` innehåller bara rena funktioner över statisk JSON och testas i `tests/local.test.ts`.
- **Statisk JSON för långsam data.** Sju byggskript skriver till `data/stockholm/`. Live-anrop görs bara mot SCB,
  WFS, Nominatim och Polisen (undantaget MCF i punkt 1).
- **Respekt för källorna i övrigt.**
  - SCB: retry med backoff (`lib/scb.ts`).
  - Nominatim: max ett anrop per sekund och User-Agent (`lib/geocode.ts:10`).
  - Skolverket: högst fem anrop samtidigt i `scripts/build-schools.ts`.
  - Brå: paus mellan anropen.
  - Overpass: anropas bara från skript.
  - TLS-verifieringen är påslagen; mellancertifikatet ligger i `scripts/certs/`.
- **Lika med lika.**
  - Medelvärden för aggregerade områden (`lib/profile.ts`, `weightedSchoolMean` i `lib/local.ts`).
  - Medianer jämförs bara när båda sidor har en (`summarize()`).
  - Valdeltagandet räknas på samma sätt för stad och område (`electionFor` i `lib/local.ts`).
- **Klientkomponenter går via egna API-rutter.** `components/SearchBox.tsx:31,46` anropar `/api/geocode` och
  `/api/deso`, aldrig externa tjänster.

### Förslag i prioritetsordning

1. **Proxa och cacha MCF:s WMS** via en egen API-rutt, och samla kart-URL:erna på ett ställe.
2. **Flytta beräkningarna** från `app/stadsdel/[id]/page.tsx` och `components/LocalSections.tsx` till rena funktioner
   i `lib/`, med tester. Räkna Stockholms referensvärden en gång.
3. **Ta bort sidoeffekten** `collectIfStale()` ur renderingen. Låt bakgrundspollningen eller cron-rutten sköta
   insamlingen.
4. **Modulvariablerna:** sätt 24 timmars tidsgräns på `loadTrends`, begränsa `geocode`-cachen, och kommentera alla
   modulvariabler.
5. **Ta bort den döda koden** i `lib/polisen.ts`. Bestäm också om identifierare ska vara på engelska, och uppdatera i
   så fall koden eller principen.
6. **Förtydliga principen om DeSO** till "där källan tillåter", och lägg till referensvärden på de tre korten som
   saknar jämförelse.

## Säkerhet

Genomgång av kodbasen, gjord 2026-10-20. Den letade efter hårdkodade hemligheter, saknad inputvalidering,
injektionsrisker (SQL, kommando, path traversal), känsliga data i loggar och osäkra standardvärden.

**Resultat:** inga hårdkodade hemligheter hittades, men det finns 14 fynd i de andra kategorierna. Två av dem är
bekräftade live mot den lokala servern:
- `/api/deso` utan parametrar anropar SCB med koordinaten (0,0).
- `/api/cron/polisen` svarar 200 för vem som helst. Testanropet startade därför en riktig insamling, vilket var
  ofarligt.

Allvarsgrad: **Hög**, **Medel** eller Låg.

### 1. Hårdkodade hemligheter eller uppgifter

Inga fynd. Det finns inga API-nycklar, lösenord eller tokens i koden. De källor som används kräver ingen nyckel.
- `CRON_SECRET` läses från miljön (`app/api/cron/polisen/route.ts:8`).
- `.env*` ignoreras av git (`.gitignore:34`).
- **Låg:** User-Agent-strängarna saknar kontaktuppgift, vilket Nominatims och Overpass användarvillkor kräver. Det
  är ingen hemlighet men ett villkorsbrott. Gäller `lib/geocode.ts:2`, `lib/polisen.ts:63`,
  `scripts/build-places.ts:48`, `scripts/build-housing.ts:61` och `scripts/fetch-bra-stockholm.ts:10`.

### 2. Saknad inputvalidering

| # | Allvar | Fil:rad | Fynd |
|---|---|---|---|
| 2.1 | **Medel** | `app/api/deso/route.ts:5–7` | Saknade parametrar slinker igenom. `Number(null)` blir `0`, som räknas som ett giltigt tal, så ett anrop utan `lat` och `lon` går vidare till SCB med (0,0). Det finns heller ingen kontroll av att koordinaterna ligger i Stockholm innan SCB anropas (bekräftat live). |
| 2.2 | **Medel** | `app/api/geocode/route.ts:5` + `lib/geocode.ts:6,10–14` | Ingen rate limit per klient. Varje unik sökning köas i `throttle()` (1,1 s per anrop) och sparas i en obegränsad cache. Många unika sökningar ger alltså en växande kö, växande minne, och kan få Nominatim att spärra servern. |
| 2.3 | Låg | `app/omrade/[deso]/page.tsx:64,102` | `adress` från URL:en visas på sidan utan längdgräns. React escapar texten, så det är ingen XSS, men vem som helst kan visa godtycklig text på sidan via en länk ("Området runt …"). |
| 2.4 | Låg | `app/jamfor/page.tsx` (`markera`) | Parametern valideras inte mot listan över stadsdelsområden. Ofarligt i dag, eftersom den bara jämförs med id:n. |
| 2.5 | Låg | `scripts/build-schools.ts:73` | Skolornas webbadress från Skolverket sparas utan kontroll av protokollet (`http(s)`). Adresser utan schema, t.ex. `www.skola.se`, blir dessutom trasiga relativa länkar. |

### 3. Injektionsrisker

**SQL: inga fynd.** Alla frågor använder förberedda satser med parametrar (`lib/polisen.ts:73,81,85,112–118,131–134`).
Strängarna i `lib/db.ts:14` och `lib/polisen.ts:138` är konstanter utan användardata.

**Kommando: inga fynd.** Det enda kommandoanropet, `execFileSync("unzip", [...])` i `scripts/build-elections.ts:99`,
tar en lista med argument utan skal.

**Path traversal:**

| # | Allvar | Fil:rad | Fynd |
|---|---|---|---|
| 3.1 | Låg | `scripts/build-elections.ts:97–100` | En nedladdad zip packas upp med `unzip -o`. Info-ZIP hoppar som standard över `../` och absoluta sökvägar, och målet är en ny tillfällig katalog, så risken för zip slip är låg. Den finns dock bara som byggsteg mot val.se, och bygger på att unzip-versionen beter sig så. |
| — | — | `lib/db.ts:5` | Databasens sökväg kommer från en miljövariabel, inte från användaren. Inget fynd. |

**CQL (frågefilter mot SCB:s kartserver):**

| # | Allvar | Fil:rad | Fynd |
|---|---|---|---|
| 3.2 | Låg | `lib/deso.ts:38` | `regsoName()` stoppar in `regsokod` från ett WFS-svar i ett CQL-filter utan kontroll. Värdet kommer från SCB, inte användaren, men validering saknas. Funktionen bredvid gör rätt: `lib/deso.ts:62` och `:68` kontrollerar koderna med regex först. |
| — | — | `lib/deso.ts:58` | `POINT(${lon} ${lat})` tar bara tal som redan kontrollerats med `Number.isFinite`. Inget fynd. |

**HTML/XSS:**

| # | Allvar | Fil:rad | Fynd |
|---|---|---|---|
| 3.3 | **Medel** | `components/ExploreMap.tsx:15,40–45` | Kartans popup byggs som HTML-sträng. Text escapas, men `href` kontrolleras inte, så en länk med `javascript:` i extern data körs vid klick. Leaflet saknar Reacts inbyggda skydd mot detta. Länkarna kommer från Skolverket (`scripts/build-schools.ts:73`) och Stockholm växer (`scripts/build-housing.ts:79`, där `new URL()` släpper igenom `javascript:`). |
| 3.4 | Låg | `components/BoroughMap.tsx:58` | Tooltip byggs med HTML utan escaping (`f.properties?.name`). Datan kommer från vår egen byggda GeoJSON, så risken är låg, men mönstret är osäkert. |
| — | — | `components/SchoolTable.tsx:64`, `components/LocalSections.tsx:383`, `components/PoliceEvents.tsx:132` | Externa länkar i JSX. React 19 blockerar `javascript:`-länkar, och `lib/polisen.ts:56` lägger `https://polisen.se` framför allt som inte börjar med `http`. Alla har `rel="noreferrer"`. Inget fynd. |

### 4. Känsliga data i loggar och svar

| # | Allvar | Fil:rad | Fynd |
|---|---|---|---|
| 4.1 | **Medel** | `app/api/cron/polisen/route.ts:16` | Felet returneras till anroparen som `String(err)`. Det kan avslöja interna detaljer (sökvägar, databasfel, externa URL:er), och eftersom rutten är öppen (5.1) kan vem som helst se dem. |
| 4.2 | Låg | `lib/scb.ts:72` | SCB:s hela svarstext läggs i felmeddelandet. Den hamnar i serverloggen och i felsidor under utveckling. |
| 4.3 | Låg | `app/api/geocode/route.ts:10`, `app/api/deso/route.ts:17`, `lib/polisen.ts:99` | Hela felobjekt loggas. Användarnas sökningar loggas inte i dag. |
| 4.4 | Låg | `lib/geocode.ts:6,32–34` | Integritet: användarnas adressökningar skickas till Nominatim (OpenStreetMap) och sparas i minnet utan tidsgräns. Det står inte på sidan eller i `/om`. |

### 5. Osäkra standardvärden

| # | Allvar | Fil:rad | Fynd |
|---|---|---|---|
| 5.1 | **Hög** | `app/api/cron/polisen/route.ts:8–9` | Cron-rutten är öppen som standard. Är `CRON_SECRET` inte satt, får alla köra insamlingen: två anrop till Polisens API och skrivningar till databasen per anrop. Det kan överbelasta Polisens API och få servern spärrad (bekräftat: 200 utan nyckel). Rutten borde vägra när nyckeln saknas, och jämföra nyckeln i konstant tid. |
| 5.2 | **Medel** | `next.config.ts` | Inga säkerhetsheaders: Content-Security-Policy, X-Frame-Options/frame-ancestors, Referrer-Policy och X-Content-Type-Options saknas. En CSP hade också begränsat effekten av 3.3. |
| 5.3 | **Medel** | `package-lock.json` | `npm audit` hittar sårbara beroenden. I produktion: `postcss` (hög) via `next`, alltså 2 sårbarheter. I dev: `braces` (hög, DoS) och `@vitest/mocker` (medel). |
| 5.4 | Låg | `instrumentation.ts:3` | Insamlingen från Polisen startar automatiskt i varje Node-process om den inte stängs av. Flera instanser ger flera pollare mot Polisen. |
| 5.5 | Låg | `lib/db.ts:5` | Databasen hamnar som standard i `data/` inne i projektet. Den är git-ignorerad (`.gitignore`, `data/*.db*`), men ligger i samma katalog som den publicerade datan. |
| 5.6 | Låg | `lib/geocode.ts:6`, `lib/trends.ts:35` | Cacharna saknar tak eller tidsgräns, vilket ger minnestillväxt (se 2.2). |

### Prioriterade åtgärder

1. **Stäng cron-rutten** (5.1). Neka anrop när `CRON_SECRET` saknas, jämför i konstant tid, och returnera inte
   `String(err)` (4.1).
2. **Rätta valideringen i `/api/deso`** (2.1). Kräv att parametrarna finns och att de ligger inom Stockholms gränser.
3. **Kontrollera länkarnas protokoll** (3.3, 2.5). Tillåt bara `https:`/`http:` i byggskripten, och escapa eller
   kontrollera `href` i Leaflet-popupen.
4. **Lägg till rate limit och cachetak** för `/api/geocode` (2.2, 5.6).
5. **Lägg till säkerhetsheaders och CSP** i `next.config.ts` (5.2).
6. **Uppdatera beroendena** (5.3) efter `npm audit` och testa.

## Kodkvalitet

Genomgång gjord 2026-10-20. Den letade efter funktioner som gör mer än en sak, otydlig namngivning, saknad
felhantering för externa anrop och kod som är svår att läsa utan kommentarer.

Här är de fem allvarligaste problemen, rangordnade efter hur stor risken är för fel i drift eller felaktiga siffror.
Bedömningen bygger på funktionernas längd och en genomläsning av koden.

### 1. Externa anrop saknar timeouts och felgränser, så en källa kan fälla eller låsa hela sidan

*Kategori: saknad felhantering för externa anrop.*

- **Ingen timeout någonstans.** Varken `AbortSignal` eller någon annan tidsgräns används. Svarar en tjänst långsamt
  hänger anropet tills operativsystemet ger upp, och sidan med det.
  - SCB: `lib/scb.ts:65`
  - SCB:s kartserver: `lib/deso.ts:32`
  - Nominatim: `lib/geocode.ts:34`
  - Polisen: `lib/polisen.ts:61`
- **Allt eller inget.** `loadStockholm()` (`lib/profile.ts:186`) kör tio SCB-anrop med `Promise.all`, så om en enda
  tabell misslyckas faller hela sidan. Detsamma gäller `Promise.all` i sidorna: `app/stadsdel/[id]/page.tsx:52` och
  `app/omrade/[deso]/page.tsx`.
- **Polisen bromsar sidan.** `app/stadsdel/[id]/page.tsx:52` väntar på `collectIfStale()` innan sidan visas, så ett
  långsamt Polis-API gör stadsdelssidan långsam.
- **Inga felgränser.** Det finns ingen `error.tsx` i `app/`. Fel från källorna visas som Next.js standardfelsida, i
  stället för att bara det berörda kortet säger "data saknas just nu".

### 2. `BoroughPage` och `AreaPage` gör allt på en gång

*Kategori: funktioner som gör mer än en sak.*

`BoroughPage` (`app/stadsdel/[id]/page.tsx:47`, 186 rader) gör följande, i en enda funktion:
- hämtar SCB-data och trenddata
- startar polisinsamlingen
- räknar ut brottsrang (`:61–64`), brottsstaplar (`:65–69`) och trendserien (`:70`)
- placerar och filtrerar polishändelser och räknar andelen placerade (`:73–75`)
- räknar ut statistik för varje grannskap och sorterar dem (`:77–79`)
- bygger `LocalArea`
- renderar tretton sektioner

`AreaPage` (`app/omrade/[deso]/page.tsx:56`, 121 rader) har samma upplägg.

Ingen av beräkningarna är testad, och de kan bara testas genom att rendera hela sidan. Samma sak i mindre skala gäller
`HousingCard` (`components/LocalSections.tsx:302`, 114 rader), som både räknar ut data och renderar fyra delvyer.

### 3. `collectEvents()` gör fyra saker, och felhanteringen kan belasta Polisen

*Kategorier: funktioner som gör mer än en sak, saknad felhantering för externa anrop.*

`lib/polisen.ts:69–88` gör allt detta i en funktion:
1. hämtar två flöden efter varandra (`:71`); misslyckas det ena går båda förlorade
2. tolkar händelserna
3. skriver dem till databasen med en extra `SELECT` per rad bara för att räkna nya (`:81`)
4. uppdaterar tidsstämpeln

Namnet "collect" avslöjar inte att den skriver till databasen. Det värsta är samspelet med `collectIfStale()`
(`:91–101`):
- Den sväljer felet.
- Tidsstämpeln uppdateras bara när allt lyckas.
- När Polisens API ligger nere, försöker därför **varje sidvisning** igen. Det belastar en tjänst som redan har
  problem, och gör samtidigt varje sida långsam (se punkt 1).

Ett liknande dolt beteende finns i `toFeature()` (`lib/deso.ts:42`). Namnet låter som en ren omvandling, men funktionen
gör ett extra nätverksanrop via `regsoName()`.

### 4. Otydliga variabelnamn i sidorna och statistikkoden

*Kategori: otydlig namngivning.*

- **Enbokstavsnamn för områdenas statistik.** I `app/omrade/[deso]/page.tsx:69–71` betyder `a` området, `b`
  stadsdelsområdet och `stad` hela Stockholm; i `app/stadsdel/[id]/page.tsx:53` betyder `a` stadsdelsområdet. Samma
  bokstav betyder olika saker i olika filer, och `b` krockar med `b` som loopvariabel för stadsdelsområden
  (`app/stadsdel/[id]/page.tsx:62`).
- **`n` betyder fyra olika saker i samma fil:** `app/omrade/[deso]/page.tsx:35`, `:44`, `:52` och `:74`.
- **Datafält som heter `a` och `b`** för "område" och "referens" i alla diagram (`components/charts/ComparisonBars.tsx`,
  `components/charts/TrendLine.tsx`) och i sidorna som fyller dem.
- **Korta namn i beräkningarna:**
  - `t`, `r`, `x` och `s` i `lib/profile.ts:117` (`statsFor`)
  - `t`, `sel` och `pick` i `lib/trends.ts:49–64`. `pick` beskriver inte att den väljer områdesindelning efter år.
  - `t` och `n` i `natureFor` (`lib/local.ts:96–99`)
- **Ett magiskt värde:** `election: { code: n?.code ?? "" }` (`app/omrade/[deso]/page.tsx:83`) använder en tom sträng
  som "inget grannskap" i stället för `null`.

### 5. Svårläst logik utan kommentar, varav en med ett dolt fel

*Kategori: svårläst kod utan kommentarer.*

**Det allvarligaste är i `lib/trends.ts:54`:** `if (v)` behandlar värdet `0` som "saknas". Det är avsiktligt, eftersom
SCB returnerar 0 för områdeskoder som saknar data det året. Men det står ingenstans, och det har två följder:
- En verklig nolla, t.ex. 0 hyresrätter i ett område, räknas bort.
- Om alla nya koder ger 0, växlar `pick()` tyst till den gamla indelningen.

Resultatet kan bli fel siffror utan att något syns. Andra beräkningar som är svåra att förstå utan förklaring:
- `StatTable.get()` (`lib/scb.ts:16–31`) räknar fram positionen i SCB:s platta värdelista (json-stat2) med `offset` och
  `stride`, utan att förklara formatet.
- `natureFor()` (`lib/local.ts:99`): `const t = n.landHa / (1 - n.waterShare)` räknar tillbaka den totala ytan från
  landyta och vattenandel, utan förklaring.
- `statsFor()` (`lib/profile.ts`): kvartilandelarna viktas med antal personer och delas med 100, eftersom SCB anger
  procent. Inte heller det förklaras.

### Sammanfattning

| # | Problem | Kategori | Huvudsaklig plats |
|---|---|---|---|
| 1 | Inga timeouts, allt-eller-inget-hämtning, inga felgränser | Felhantering | `lib/scb.ts:65`, `lib/deso.ts:32`, `lib/profile.ts:186`, `app/` (ingen `error.tsx`) |
| 2 | Sidorna hämtar, räknar och renderar i samma funktion | Mer än en sak | `app/stadsdel/[id]/page.tsx:47`, `app/omrade/[deso]/page.tsx:56` |
| 3 | `collectEvents` gör fyra saker; vid fel försöker varje sidvisning igen | Mer än en sak + felhantering | `lib/polisen.ts:69–101` |
| 4 | `a`/`b`/`n`/`t` med skiftande betydelse | Namngivning | `app/omrade/[deso]/page.tsx:35–83`, `lib/trends.ts:49–64` |
| 5 | `if (v)` tappar verkliga nollor tyst; okommenterad indexberäkning | Läsbarhet | `lib/trends.ts:54`, `lib/scb.ts:16–31`, `lib/local.ts:99` |

**Rekommenderad ordning:** börja med punkt 1 och 3, eftersom de påverkar driften. Därefter punkt 5 (den dolda
nollhanteringen kan ge fel siffror), och sist 2 och 4, som är omstrukturering och namnbyten.

## Åtgärdat

Åtgärdat 2026-10-20: en åtgärd från varje sektion ovan.

| Sektion | Fynd | Åtgärd | Filer |
|---|---|---|---|
| Arkitektur | Punkt 1: MCF anropades direkt från webbläsaren, per sidvisning | Översvämningskartan hämtas nu via en egen proxy. Den tar bara emot de två lager appen använder, i Stockholm och i projektionen EPSG:3857, med begränsad bildstorlek. Parametrarna byggs om från validerade värden. Bilderna cachas (30 dagar på servern, 1 dag i webbläsaren), och anropen till MCF har timeout. | `app/api/flood-map/route.ts` (ny), `components/ExploreMap.tsx:10` |
| Säkerhet | 5.1 och 4.1: cron-rutten var öppen och returnerade interna fel | Rutten är stängd som standard (503 utan `CRON_SECRET`) och jämför nyckeln i konstant tid (`timingSafeEqual`). Fel loggas bara på servern; anroparen får ett generellt meddelande. | `app/api/cron/polisen/route.ts` |
| Kodkvalitet | Punkt 1: inga timeouts, allt eller inget, inga felgränser | Det här åtgärdades: | `lib/http.ts` (ny), `lib/scb.ts`, `lib/deso.ts`, `lib/polisen.ts`, `lib/geocode.ts`, `app/stadsdel/[id]/page.tsx`, `app/omrade/[deso]/page.tsx`, `app/error.tsx` (ny) |

Kodkvalitet punkt 1 åtgärdades så här:
- **Timeouts:** alla externa anrop har nu timeout: SCB 20 s, kartservern 10 s, Polisen 10 s, Nominatim 8 s och MCF 10 s.
- **Trender:** trenddatan är valfri; misslyckas den, visas sidan utan den sektionen.
- **Polisen:** insamlingen körs i bakgrunden i stället för att blockera sidan. När Polisens API ligger nere görs
  bara ett nytt försök per 10 minuter.
- **Felsida:** en ny felsida visar ett tydligt meddelande med "Försök igen" när kärndata inte går att ladda.

**Verifierat:**
- Typkontroll och lint ger inga fel, och 25 tester går igenom. Fem av dem är nya, i `tests/routes.test.ts`:
  - cron-rutten utan nyckel och med fel nyckel
  - proxyns validering av lager, område, storlek och projektion
  - `optional()`
- Live mot den lokala servern: proxyn levererar kartbilder och avvisar ogiltiga förfrågningar med 400, cron-rutten
  svarar 503 utan nyckel, och alla sidor renderas.

Kvar att åtgärda: övriga punkter i respektive sektion ovan.
