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

Requires Node 20+. No API keys are needed. Production (Vercel) and CI run Node 24, pinned by `engines` in
`package.json`; the Vercel CLI used for deploys rejects newer versions set in the Vercel project.

## Data

| Data | Source | How |
|---|---|---|
| Who lives there (DeSO/RegSO) | SCB PxWeb API v2 | Live, cached for a day. Boroughs are summed from their DeSO areas |
| Area boundaries, address → area | SCB open geodata WFS | Live |
| Reported crimes per borough | Brå statistics database (SOL) | `npm run fetch-bra` → `data/stockholm/crime.json` |
| Police events | `polisen.se/api/events` | Collected every 10 minutes into SQLite (Turso in production) |
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
`GET /api/cron/polisen` on a schedule with `Authorization: Bearer <CRON_SECRET>`. The route is closed by default:
without `CRON_SECRET` set it refuses every request (503).

Locally, events are stored in the SQLite file `data/kommunkollen.db` (not in git). In production they are stored
in [Turso](https://turso.tech) (hosted SQLite) when `TURSO_DATABASE_URL` is set.

## Deploying to Vercel (free)

The app runs on Vercel's free Hobby plan. Three free services are involved:

| Need | Service | Why |
|---|---|---|
| Next.js server | **Vercel Hobby** | Deploys from GitHub on every push |
| Police event database | **Turso** (free plan) | Vercel has no persistent disk, so the SQLite file can't live there |
| Polling Polisen every 10 min | **GitHub Actions** (`.github/workflows/polisen-cron.yml`) | Vercel Hobby cron runs at most once a day |

1. **Turso:** create a database (web dashboard or `turso db create kommunkollen`) and an auth token
   (`turso db tokens create kommunkollen`). Copy the existing police history into it, since Polisen's API
   can't give it back:
   `TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run migrate-police` (safe to run again; it never
   overwrites).
2. **Vercel:** import the GitHub repository (framework Next.js, no other settings). Add these environment
   variables for Production and Preview:
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
   - `CRON_SECRET`: a long random string, e.g. `openssl rand -hex 32`
   - `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`: the site is password-protected on Vercel until the licences
     of all sources are verified (see CLAUDE.md). Without them every page answers 503. After the review,
     set `SITE_PUBLIC=1` instead.
3. **GitHub:** in the repository's Settings → Secrets and variables → Actions, add the secret `CRON_SECRET`
   (same value as on Vercel) and the variable `APP_URL` (e.g. `https://kommunkollen.vercel.app`). The
   workflow only runs on its schedule once it is on the default branch; run it once by hand
   (Actions → Collect police events → Run workflow) to check it answers `{"fetched":…,"inserted":…}`.

Caveats: GitHub may delay scheduled runs, and disables them after 60 days without commits in a public
repository (re-enable in the Actions tab). Each Vercel function instance keeps its own SCB cache, so a cold
instance takes a few seconds on the first request. Vercel Hobby is for non-commercial use.

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
