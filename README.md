# Kommunkollen Stockholm

Compare Stockholm's 11 boroughs (stadsdelsområden) and 127 neighbourhoods using open data from Swedish
public agencies (found via [Sveriges dataportal](https://www.dataportal.se)).

- **Start page** (`/`): a map of the boroughs, coloured by a measure you choose (reported crime, income,
  education, employment, rental housing, households with children, age, cars, population), with a ranking.
- **Borough page** (`/stadsdel/[id]`) has these sections:
  - a summary of who lives there compared with Stockholm as a whole, and trends since 2015
  - reported crimes by type and over time (Brå), and police events placed in the borough
  - schools and preschools; shops, healthcare and restaurants
  - nature and bathing water, and cloudburst flood risk
  - rents, queue times, prices and construction projects
  - 2026 election results, a layered map, its neighbourhoods, and population charts
- **Area page** (`/omrade/[kod]`): the same profile for a neighbourhood (RegSO, e.g. `0180R031`) or a
  small area (DeSO, e.g. `0180C1010`), compared with its borough. Address search lands here.
- **Compare** (`/jamfor`): sortable tables with every borough side by side.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
LIVE=1 npm test    # also tests against the real APIs
```

Requires Node 20+. No API keys are needed.

## Data

| Data | Source | How |
|---|---|---|
| Who lives there (DeSO/RegSO) | SCB PxWeb API v2 | Live, cached for a day. Boroughs are summed from their DeSO areas |
| Area boundaries, address → area | SCB open geodata WFS | Live |
| Reported crimes per borough | Brå statistics database (SOL) | `npm run fetch-bra` → `data/stockholm/crime.json` |
| Police events | `polisen.se/api/events` | Collected every 10 minutes into SQLite |
| Which borough each area belongs to | Stockholms stad stadsdelar (CC0) + SCB DeSO | `npm run build-areas` → `data/stockholm/` |
| Schools (merit, teachers) | Skolverket Planned Educations API v3 | `npm run build-schools` |
| Preschools | Stockholms stad Hitta service API | `npm run build-schools` |
| Shops, restaurants, healthcare | OpenStreetMap via Overpass (ODbL) | `npm run build-places` |
| Green space, water, protected nature, bathing | SCB, Naturvårdsverket, HaV | `npm run build-nature` |
| Cloudburst flood risk | MCF (formerly MSB) flood map for Stockholm | `npm run build-flood` (pixel count per DeSO) |
| Rents, prices, queue times, projects | SCB, Bostadsförmedlingen, Stockholm växer | `npm run build-housing` |
| Election results 2026 | Valmyndigheten, per voting district | `npm run build-elections` |
| Trends since 2015 | SCB (2018 and 2025 DeSO divisions joined) | Live |
| Address search, base map | OpenStreetMap / Nominatim | Live |

### Yearly update of crime statistics

Brå has no API. `scripts/fetch-bra-stockholm.ts` replays the SOL web form and downloads reported crimes
for 12 crime categories per borough from 2015 onwards. Borough mergers (Hägersten-Älvsjö in 2021, Järva and
Norra innerstaden in 2024) are reconstructed from their predecessors so every series is continuous. Run
it after Brå publishes the final annual statistics (usually in March):

```bash
npm run fetch-bra
```

Brå's server does not send its intermediate certificate, so the script passes it to Node via
`NODE_EXTRA_CA_CERTS` (`scripts/certs/`).

### Borough boundaries

`scripts/build-stockholm-areas.ts` assigns each of Stockholm's 569 DeSO areas to one of the 11 boroughs
(as of 1 July 2023). It finds the stadsdel polygon each area lies in and looks that stadsdel up in a
borough table taken from Stockholms stad. It also merges the borough polygons for the map.

### Police events

Polisen only gives "Stockholm" as the location. `lib/police-areas.ts` places an event in a borough when
its text names a stadsdel, neighbourhood or well-known place ("…på Södermalm", "…vid Odenplan"). That
works for about two thirds of events. The collector polls both the national feed and
`?locationname=Stockholm` (the latest 500 Stockholm events, about six months). For serverless hosting, call
`GET /api/cron/polisen` on a schedule (protect it with `CRON_SECRET`).

### Refreshing the static data

The build scripts write JSON to `data/stockholm/`. Run them in this order, because the area mapping is
needed first and the flood script uses the land areas from the nature script:

```bash
npm run build-areas && npm run build-schools && npm run build-places && npm run build-nature \
  && npm run build-flood && npm run build-housing && npm run build-elections && npm run fetch-bra
```

Suggested refresh rate:
- **Weekly:** places, housing projects.
- **Yearly:** schools in the autumn, crime in March, everything else when SCB publishes.
- **After each election:** elections. The val.se download URLs change when files are replaced.

Notes on methods:
- **Elections:** voting districts don't follow SCB's areas, so votes are split by overlapping area.
- **Flood risk:** MCF only publishes the cloudburst map as images. The script counts flooded pixels per DeSO
  at 5 m resolution, using the legend colours, and leaves out depths over 1.5 m (existing lakes).

## Structure

- `lib/stockholm.ts`: boroughs, neighbourhoods and DeSO lookups
- `lib/profile.ts`: loads all SCB statistics for Stockholm and computes any area
- `lib/crime.ts`: Brå crime data
- `lib/trends.ts`: time series across SCB's 2018 and 2025 area divisions
- `lib/local.ts`: schools, services, nature, flood, housing and election data per area
- `components/LocalSections.tsx`, `components/ExploreMap.tsx`: the area sections and the layered map
- `lib/police-areas.ts`, `lib/polisen.ts`, `lib/db.ts`: police events, storage and place matching
- `lib/scb.ts`, `lib/deso.ts`, `lib/geocode.ts`: API clients
