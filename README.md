# Kommunkollen Stockholm

Kommunkollen hjälper den som bor i Stockholm, eller funderar på att flytta dit, att jämföra stadsdelar och
grannskap genom att samla öppna data om befolkning, trygghet, skolor, service och boende från ett tiotal
myndigheter, data som annars är spridd i olika format och på olika geografiska nivåer.

**Live:** https://flytta-till-stockholm.vercel.app

## Vad det gör

Du söker på en adress, ett grannskap eller ett stadsdelsområde, eller klickar på kartan. Då får du en sida om
området med befolkning, inkomst och utbildning, utvecklingen sedan 2015, anmälda brott och polisens händelser,
skolor och förskolor, butiker och vård, grönområden och översvämningsrisk vid skyfall, hyror, kötider och
byggprojekt samt valresultatet 2026. Varje siffra jämförs med det större området: ett grannskap med sitt
stadsdelsområde och ett stadsdelsområde med hela Stockholm. Varje kort anger också källa, år och begränsningar.

Appen täcker tre nivåer: 11 stadsdelsområden, 127 grannskap (SCB:s RegSO) och 569 DeSO-områden, som är där man
hamnar när man söker på en adress. På `/jamfor` finns sorterbara tabeller med alla stadsdelsområden bredvid
varandra, och på `/om` finns källorna och deras begränsningar.

## Kom igång

### Krav

- Node.js 24 (låst i `package.json`, och det är den version som produktion och CI kör; lokalt fungerar Node 20+)
- npm
- Inga API-nycklar behövs för att köra lokalt. Alla källor är öppna.
- Bara för produktion: ett konto på [Vercel](https://vercel.com) (Hobby), en databas hos [Turso](https://turso.tech)
  och GitHub Actions. Alla tre är gratis.

### Installation

```bash
git clone https://github.com/michaelsoderberg/flytta-till-stockholm
cd flytta-till-stockholm
npm install
```

### Konfiguration

Lokalt behövs ingen konfiguration. Polisens händelser sparas då i SQLite-filen `data/kommunkollen.db`.

I produktion sätts miljövariablerna i Vercel. Vill du testa dem lokalt kan du skapa en `.env.local`-fil i
projektets rot (alla `.env*`-filer ignoreras av git):

```bash
TURSO_DATABASE_URL=libsql://din-databas.turso.io   # polisdatabas i Turso i stället för lokal fil
TURSO_AUTH_TOKEN=ditt-värde
CRON_SECRET=ditt-värde                              # krävs för /api/cron/polisen, t.ex. openssl rand -hex 32
SITE_PUBLIC=1                                       # gör sajten öppen på Vercel
BASIC_AUTH_USER=ditt-värde                          # lösenordsskydd på Vercel om SITE_PUBLIC saknas
BASIC_AUTH_PASSWORD=ditt-värde
```

Valfria variabler: `KOMMUNKOLLEN_DB` (sökväg till den lokala SQLite-filen), `NOMINATIM_USER_AGENT` (User-Agent
för adressökningen) och `DISABLE_POLISEN_POLLING=1` (stänger av insamlingen av polishändelser, t.ex. vid
`npm run build`).

För driftsättning läggs samma `CRON_SECRET` och variabeln `APP_URL` in i GitHub (Settings → Secrets and
variables → Actions), tillsammans med `VERCEL_TOKEN`, `VERCEL_ORG_ID` och `VERCEL_PROJECT_ID` för CI/CD.

### Kör projektet

```bash
npm run dev            # http://localhost:3000, hämtar även polisens händelser var tionde minut
npm test               # enhetstester
LIVE=1 npm test        # testar även mot de riktiga API:erna
npx tsc --noEmit && npx eslint .
```

Den statiska datan i `data/stockholm/` är redan byggd och finns i repot. Så här byggs den om, i den här ordningen:

```bash
npm run build-areas && npm run build-schools && npm run build-places && npm run build-nature \
  && npm run build-flood && npm run build-housing && npm run build-elections && npm run fetch-bra
```

Skolor och brott uppdateras en gång om året, butiker och byggprojekt varje vecka, och valdata efter varje val.

## Arkitektur

SCB:s DeSO-områden är den gemensamma nyckeln. Varje källa placeras i ett DeSO-område, via kod, koordinater eller
överlappande yta, och grannskap och stadsdelsområden är bara mängder av DeSO-områden. Data som ändras sällan
(skolor, brott, val, natur, översvämning, bostäder) byggs av skript till statisk JSON. Bara SCB-statistik,
områdesgränser, adressökning och polishändelser hämtas live, och de cachas. All extern I/O sker i `lib/` och
`scripts/`, och beräkningarna är rena funktioner som testas utan nätverk. Sidorna är serverkomponenter. Bara
kartor, diagram och filter körs i webbläsaren.

```
flytta-till-stockholm/
├── app/                # Sidor och API-routes: start, /stadsdel, /omrade, /jamfor, /om, /api
├── components/         # Kort, diagram (Recharts) och kartor (Leaflet, laddas bara i webbläsaren)
├── lib/                # API-klienter (SCB, Polisen, Nominatim), områdeskoppling och beräkningar
├── scripts/            # Byggskript som hämtar källorna och skriver JSON till data/stockholm/
├── data/stockholm/     # Färdigbyggd statisk data: områden, brott, skolor, platser, natur, val m.m.
├── tests/              # Vitest: parsning, beräkningar, routes och valfria live-tester
├── .github/workflows/  # CI/CD (lint, typkontroll, test, bygg, deploy) och insamling av polishändelser
├── middleware.ts       # Lösenordsskydd på Vercel tills licenserna är granskade
└── instrumentation.ts  # Startar insamlingen av polishändelser i den lokala servern
```

## Teknisk stack

| Komponent  | Val                                                        | Anledning                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ramverk    | Next.js 15 (App Router) + TypeScript                       | Data hämtas på servern, vilket döljer API-detaljer och undviker CORS-problem hos SCB och Skolverket. Typningen fångar fel i datahanteringen.                                |
| Styling    | Tailwind CSS v4 med tematokens                             | Konsekvent UI och ljust/mörkt läge från en färgpalett som är kontrollerad för färgblindhet.                                                                                 |
| Diagram    | Recharts                                                   | Enkla stapel- och linjediagram med tooltips som React-komponenter.                                                                                                          |
| Kartor     | Leaflet + OpenStreetMap, MCF:s översvämningskartor som WMS | Gratis och utan API-nyckel. Klarar områden, punkter och WMS-lager.                                                                                                          |
| Databas    | SQLite lokalt, Turso i produktion (`@libsql/client`)       | Polisens API visar bara de senaste 500 händelserna, så de måste sparas löpande. Vercel saknar beständig disk, därför Turso.                                                 |
| Byggskript | tsx med Turf.js, proj4, shapefile, pngjs och SheetJS       | Geodata (ytor, koordinatsystem, kartbilder, Excel-filer) bearbetas i samma språk och med samma kod som appen.                                                               |
| Tester     | Vitest                                                     | Snabbt och TypeScript-vänligt.                                                                                                                                              |
| Drift      | Vercel Hobby + GitHub Actions                              | Gratis. CI kör lint, typkontroll, tester och bygg på varje PR, och deployar bara när allt går igenom på `main`. Ett schemalagt jobb hämtar polishändelser var tionde minut. |

## Begränsningar

- **Inga försäljningspriser per område.** Öppna prisdata finns bara för hela staden eller Storstockholm, och
  hyror bara för innerstaden, Söderort och Västerort. För lokala priser hänvisar appen till privata sajter.
- **Polisens händelser saknar exakt plats.** Polisen anger bara "Stockholm". Appen placerar händelser utifrån
  ortnamn i texten, vilket lyckas för ungefär två tredjedelar. Historiken börjar i april 2026.
- **Brott räknas per invånare, inte per besökare.** Områden med många besökare, som Norra innerstaden och
  Södermalm, får därför höga tal.
- **Flera siffror är uppskattningar.** Röster fördelas efter överlappande yta, eftersom valdistrikten inte följer
  SCB:s områden. Översvämningsrisken räknas fram ur pixlar i MCF:s kartbilder. Antalet bostäder i byggprojekt
  tolkas ur fritext och lyckades för 237 av 422 projekt.
- **Trenderna byter områdesindelning mellan 2023 och 2024**, vilket kan ge små hopp i serierna.
- **Skolstatistiken är ofullständig.** Bara ungefär hälften av grundskolorna har ett publicerat meritvärde för
  årskurs 9.
- **Tre källor saknar angiven licens** (Stockholm växer, Bostadsförmedlingens statistik och Stockholms stads
  Hitta service). Sajten är en demo och ska inte lanseras publikt innan villkoren är granskade.
- **Kända tekniska brister:** första sidladdningen tar 5–6 sekunder eftersom all SCB-data hämtas på en gång,
  trenddatan uppdateras inte förrän servern startas om, adressökningen hittar ibland bara gatan och inte
  husnumret, och mobillayouten är inte testad på en riktig telefon.

Den fullständiga listan finns i [PROJECT.md](PROJECT.md) under "Limitations and known bugs".

## Utvecklat med

Claude Code (agentdriven utveckling) som del av kursen Next-Generation Software Development with AI.

## CV-punkt

Designade och utvecklade en webbapp i Next.js 15, TypeScript och SQLite (Turso) med hjälp av agentdriven
utveckling (Claude Code). Appen samlar öppna data från tio myndigheter och kommunala källor (bl.a. SCB, Brå,
Skolverket och Valmyndigheten) på en gemensam geografi med 569 statistikområden, så att Stockholms 11
stadsdelsområden och 127 grannskap kan jämföras med källa angiven för varje siffra. Målgruppen är människor som önskar bosätta sig i Stockholm och vill ta del av hur dom olika områdena i Stockholm skiljer sig utifrån tidigare nämnda myndigheter/kommuners data.
Deployad på Vercel, databas via Turso med CI/CD
via GitHub Actions och tillgänglig på https://flytta-till-stockholm.vercel.app.
