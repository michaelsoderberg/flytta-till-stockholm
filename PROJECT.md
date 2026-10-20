# Kommunkollen Stockholm

A web app that describes every part of Stockholm, borough by borough and neighbourhood by neighbourhood, using
only free, open data from Swedish public agencies (found via [Sveriges dataportal](https://www.dataportal.se)).

## What it does

You search for an address, a neighbourhood or a borough, or click on the map. You get a page that answers
the questions people ask when they live somewhere or are thinking of moving there:

| Question | What the app shows | Source |
|---|---|---|
| Who lives here? | Age, households, income, education, employment, tenure, house type, cars, building age, and a plain-language summary | SCB |
| How is the area changing? | Population, income, share of rentals and share of children since 2015 | SCB |
| Is it safe? | Reported crimes per 100 000 inhabitants for 12 crime types (2015–2025), the borough's rank, and recent police events placed in the area | Brå, Polisen |
| What are the schools like? | Every school with grade average for year 9, eligibility for upper-secondary school, qualified teachers, pupils per teacher, plus all preschools | Skolverket, Stockholms stad |
| What is nearby? | Grocery stores, restaurants, cafés, health centres, pharmacies, dentists, gyms, playgrounds and libraries, per 10 000 residents | OpenStreetMap |
| Is there nature and water? | Share of green space, water and protected nature, and the nearest bathing spots with EU water quality | SCB, Naturvårdsverket, HaV |
| Does it flood? | Share of land with standing water in a 100-year cloudburst, plus map layers for cloudburst and Lake Mälaren flooding | MCF (formerly MSB) |
| What does housing cost, and what is being built? | Rents by number of rooms, queue time for rental flats, city-level prices, planned homes and construction projects | SCB, Bostadsförmedlingen, Stockholm växer |
| How do people vote? | 2026 national and municipal election results and turnout | Valmyndigheten |

Everything is compared with a reference:
- **A borough** is compared with Stockholm as a whole.
- **A neighbourhood** is compared with its borough.

### Pages

- **`/`:** a map of the 11 boroughs, coloured by a measure you choose, with a ranking and a search box.
- **`/stadsdel/[id]`:** a borough page with all sections, the borough's neighbourhoods, and a layered map.
- **`/omrade/[code]`:** a neighbourhood page (SCB RegSO, 127 in Stockholm), or a small-area page (SCB DeSO, 569).
- **`/jamfor`:** sortable tables with all boroughs side by side.
- **`/om`:** the data sources and their limitations.

## Why

When you move, change job or start a family, you need to know what an area is like. That information
exists, but it is spread over a dozen agencies, in different formats and at different geographic levels. Commercial
sites show parts of it, often as a black box. Kommunkollen:

- **solves a common problem**, not a personal one: anyone choosing where to live, or wanting to understand their own area;
- **uses only open public data**, so every number can be traced to an agency and checked;
- **brings the sources together** on a shared geography, so they can be compared side by side;
- **is honest about limits**: each section states its source, year and caveats, for example that sale prices per
  area don't exist as open data.

### How the project evolved

1. **Brief:** build a web app that solves a common problem using free data from dataportal.se.
2. **First version:** municipality level for all of Sweden ("what do I get for my taxes?").
3. **Second version:** narrowed to Stockholm by borough. Finer geography is more useful, and it makes the
   project more specialised (niche).
4. **Third version:** extended with what a person moving to an area actually wants to know: schools, trends,
   construction, nature, housing, services, elections and flood risk.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 15** (App Router, server components) with **TypeScript** |
| Styling | **Tailwind CSS v4**, theme tokens for light and dark mode, from a validated colour palette |
| Charts | **Recharts** (bars and line charts with tooltips) |
| Maps | **Leaflet** with OpenStreetMap tiles; MCF flood maps as WMS overlays |
| Storage | **SQLite** via `better-sqlite3`, for collected police events |
| Geodata in build scripts | **Turf.js** (intersections, point in polygon), **proj4** (SWEREF 99 TM / 18 00 → WGS84), `shapefile`, `pngjs`, SheetJS (`xlsx`) |
| Tests | **Vitest**: unit tests, data sanity tests, and optional live API tests (`LIVE=1`) |
| Scripts | `tsx` build scripts that produce static JSON in `data/stockholm/` |

### Architecture in short

```
Live at request time (cached):            Pre-built by scripts (JSON in data/stockholm/):
  SCB statistics (PxWeb v2, POST)           areas.json      DeSO/RegSO → borough mapping
  SCB area boundaries (WFS)                 crime.json      Brå, per borough 2015–2025
  Nominatim address search                  schools.json    Skolverket + Stockholm stad
  Polisen events → SQLite (every 10 min)    places.json     OpenStreetMap (Overpass)
                                            nature.json     SCB, Naturvårdsverket, HaV
                                            flood.json      MCF cloudburst map, per DeSO
                                            housing.json    SCB, Bostadsförmedlingen, Stockholm växer
                                            elections.json  Valmyndigheten, per neighbourhood
```

The shared key is SCB's **DeSO** area (569 in Stockholm). Every source is placed in a DeSO, by its
code, by coordinates or by overlapping area. Neighbourhoods and boroughs are then just sets of DeSOs.

## Decisions and why

### Scope and product

| Decision | Why |
|---|---|
| **A "know your area" app instead of a single-topic tool** (I first proposed job search, commuting, electricity prices and others) | The user preferred combining several sources around one shared problem. The area is the natural join key for most public data. |
| **Pivot from all municipalities to Stockholm by borough** | Municipality averages hide large differences: in Stockholm, average income differs by a factor of almost three between boroughs. A smaller area with finer detail is more useful, and it makes the project more specialised. |
| **11 boroughs, not 13** | Stockholm merged into 11 stadsdelsområden on 1 July 2023 (Järva and Norra innerstaden are new). I verified this against the city's site, Wikipedia and Brå's own region list, and used the current division. |
| **Two levels: borough and neighbourhood (RegSO), plus DeSO via address** | Boroughs match how the city is run and how Brå reports crime. Neighbourhoods (127, named, such as Blackeberg) match how people think about where they live. |
| **Swedish UI, English documentation** | The users are people in Stockholm. Code and docs follow the repository's language. |
| **Comparisons always shown** (area vs borough vs city) | A number alone means little. "56 % rentals" only tells you something next to "Bromma 28 %". |
| **Limitations stated on the page** | Open data has gaps: no sale prices per area, county-level police coordinates, approximate vote splits. Saying so builds trust and stops misreadings. |

### Data and methods

| Decision | Why |
|---|---|
| **Assign DeSO areas to boroughs by geometry** (interior point inside the city's 117 district polygons, then a district → borough table from Stockholms stad) | SCB has no borough codes. A spatial join is reproducible, and it is checked: all 569 DeSO and 127 RegSO were assigned, and no neighbourhood straddled two boroughs. |
| **Sum DeSO areas for boroughs; use the mean instead of the median for income** | Counts and shares add up exactly, and borough populations match the city total within 0.02 %. Medians cannot be combined, so aggregated areas use the person-weighted mean, and the app never compares a median with a mean. |
| **Load all Stockholm SCB data in one request per table** (POST, cached in memory for 24 hours) | About 700 region codes are too long for a URL. One request per table serves every page and stays within SCB's 30 requests / 10 s limit. A retry with backoff handles the occasional dropped connection. |
| **Join SCB's 2018 and 2025 area divisions for trends** | SCB publishes years up to 2023 under the 2018 codes and later years under the 2025 codes. Mapping the old areas spatially to boroughs and neighbourhoods gives continuous series since 2015. The page notes that small jumps can come from boundary changes. |
| **Crime from Brå, downloaded by script, not Kolada** | Kolada stops at municipality level. Brå's database (SOL) has every borough since 2002 but no API, so a script replays the web form once a year. Boroughs merged in 2021 and 2024 are rebuilt from their predecessors so the series run unbroken back to 2015. |
| **Brå's TLS certificate added via `NODE_EXTRA_CA_CERTS`** | Brå's server omits its intermediate certificate. I added the official DigiCert intermediate instead of turning off TLS verification. |
| **Police events placed by place names in the text** | Polisen only gives "Stockholm" as the location. Matching district, neighbourhood and landmark names in the summary places about two thirds of events. It prefers the longest and earliest match, and has tests for word boundaries. The rest are not counted, and the page says so. |
| **Store police events in SQLite and poll every 10 minutes** | The API only returns the latest 500 events. Polling `?locationname=Stockholm` gives about six months of history straight away, and collection keeps building on it. |
| **Elections split by overlapping area** | Valmyndigheten's 606 voting districts don't follow SCB's areas. Splitting votes by intersecting area is transparent and loses no votes, which the tests check. Turnout is compared like for like: late-counted votes, which have no district, are left out everywhere. |
| **Flood risk measured from MCF's map images** | Länsstyrelsen's vector model turned out to have no data at all for southern Stockholm, which would have shown 0 % there. MCF's cloudburst map covers the whole city but is only published as images. The script reads the legend colours, counts flooded pixels per DeSO at 5 m resolution, and leaves out depths over 1.5 m (existing lakes). It is labelled as an indication. |
| **Housing prices only at the level where they exist** | SCB's open price data is for the whole city or Greater Stockholm, and the private sources (Booli, Hemnet, Mäklarstatistik) have no open API. The app shows rents for three parts of the city, queue times per district and city-level prices, and points to the private sites for local prices. |
| **Static JSON for slow-changing data, live calls for SCB and geometry** | Schools, crime, elections and similar data change yearly or less. Building them offline keeps pages fast, avoids hammering shared services such as Overpass and Skolverket, and makes every number reproducible from a script. |
| **OpenStreetMap for shops and healthcare** | No official open register covers grocery stores, restaurants and healthcare with coordinates. 1177's search API works but is undocumented and has no licence, so I left it out. OSM is ODbL-licensed and covers this well. Attribution is shown. |
| **A few sources without a stated licence are used with attribution** (Stockholm växer, Bostadsförmedlingen's statistics, Stockholm's Hitta service) | They are public-sector data published openly on the web. They are fetched at build time only and credited, and the README flags them for review before public launch. |

### Technical

| Decision | Why |
|---|---|
| **Next.js with server components** | Server-side fetching hides API details, gets around CORS (SCB, Skolverket), and sends little JavaScript. Only maps and interactive charts are client components. |
| **`better-sqlite3` pinned to v11** | v13 segfaults on the Node version in use (23.2). v11 has working prebuilt binaries. |
| **Leaflet loaded only in the browser** | Leaflet touches `window` on import. The colour ramp was moved to its own module so server code never imports Leaflet. |
| **OpenStreetMap tiles instead of CARTO** | CARTO's basemaps now require an API key and showed a watermark. |
| **Nominatim search on submit, not autocomplete** | Nominatim's usage policy forbids autocomplete. Neighbourhoods and boroughs are suggested instantly from local data, and addresses are searched when you press Sök, limited to Stockholm municipality. |
| **SCB's map service (WFS) for "which area is this address in?"** | SCB's WFS answers a point query directly and returns the boundary, so no polygon files need to be shipped for lookups. |
| **Chart colours from a validated palette; single-series bars where possible** | The palette is checked for colour-blind contrast. Election results use one colour for the area and grey for the reference instead of party colours, which keeps the chart readable without relying on hue. |
| **Chart animations turned off** | They hid data in static renders, and they add nothing for reading numbers. |
| **Build scripts in TypeScript next to the app** | They share code (`lib/scb.ts`, area mapping) with the app, and one language covers everything. |

## Limitations and known bugs

### Gaps in the data

- **No sale prices per area.** Open price data exists only for the whole city (houses) or Greater
  Stockholm (bostadsrätter). Rents exist only for three parts of the city: inner city, Söderort and Västerort.
- **Crime is per resident, not per visitor.** Brå counts crimes where they happen. Areas with many visitors
  (Norra innerstaden, Södermalm) therefore get high rates. Small boroughs and rare crime types can swing a
  lot from year to year.
- **Police events have no exact location.** About a third of Stockholm events cannot be placed in a
  borough. The history only goes back to April 2026 (the first collection) and grows from there.
- **School statistics are incomplete.** Only about half of the compulsory schools have a published grade
  average for year 9 (small schools and schools without year 9 have none). Periods are mixed (2024/25 and
  2025/26). A school *in* an area is not necessarily where its children go, since families choose schools across the city.
- **OpenStreetMap is volunteer data.** Coverage of shops, clinics and gyms is good but not complete, and
  varies between areas.
- **Green space data is from 2020** and only covers built-up areas (tätorter).
- **Protected-nature types are missing.** The INSPIRE source lacks designation types for most areas, so
  most are shown as just "Skyddad natur".
- **Flood risk covers cloudbursts only.** Flooding from Mälaren and the sea is only shown as map layers,
  not computed per area.

### Approximations in the methods

- **Votes are split by area.** Voting districts don't follow SCB's areas, so votes are split by overlapping
  area. A district that is mostly park or water but has its homes in one corner gets spread out wrongly.
  Results for small neighbourhoods are therefore approximate. Area turnout excludes late-counted votes, which
  have no district.
- **The flood share is measured from images.** It comes from counting coloured pixels in MCF's map images at
  5 m resolution. Depths over 1.5 m are left out to skip existing lakes, but that also leaves out the rare deep
  flooding on land.
- **Trends switch area divisions between 2023 and 2024.** They join two SCB divisions (2018 and 2025).
  Boundary differences can cause small jumps between those years; Järva, for example, rises 2.8 % in one year.
- **Housing projects are parsed from free text.** The number of homes is extracted from the description, which
  worked for 237 of 422 projects. Status (planned, being built, finished) is guessed from keywords and is
  unknown for about half.
- **Queue times rest on few flats.** Some districts had fewer than ten flats mediated in a year.
- **Average age is estimated** from five-year age bands.
- **SCB adds random noise.** Since 2025 it adds small random noise to protect individuals, so small numbers
  in single DeSO areas may be slightly off.
- **Some sources are hand-maintained.** The borough table for districts is maintained manually, and has to be
  updated if Stockholm reorganises its boroughs again.

### Fragile or unofficial sources

- **Three sources have no stated licence:** Stockholm växer (scraped from the web page), Bostadsförmedlingen's
  statistics (an undocumented endpoint) and Stockholm's Hitta service (preschools). Check their terms before a
  public launch.
- **Brå has no API.** The download script replays its web form, which breaks if the site changes. It also
  needs the extra TLS certificate shipped in `scripts/certs/`.
- **val.se download URLs change** when files are replaced, so the election script needs new links after each
  election.
- **Overpass (OpenStreetMap) is often overloaded.** The places script falls back to mirrors.

### Known bugs and technical issues

- **Trend data is never refreshed while the server runs.** `loadTrends()` caches its result for the lifetime of
  the process (unlike the other SCB data, which expires after 24 hours), so new SCB trend data only appears after
  a restart.
- **The first page load is slow.** It loads every SCB table for all of Stockholm, which takes about 5–6 s. Later
  requests use the in-memory cache, but a server restart or a new serverless instance starts cold.
- **Police collection needs a long-running server.** It runs inside the Node server (`instrumentation.ts`). On
  serverless hosting it only works if something calls `/api/cron/polisen` on a schedule and the SQLite file is on
  persistent storage.
- **Address search sometimes can't find a house number.** Nominatim may return only the street (for example
  "Götgatan 10" gives street segments), so the area found can be a neighbouring one.
- **The geocoding cache is unbounded.** It is kept in memory and grows with every new query.
- **DeSO pages mix two levels.** A DeSO page shows population statistics for the DeSO but schools, services,
  housing and elections for the whole neighbourhood. The page doesn't make this clear enough.
- **The layered map ignores dark mode.** Marker colours and the base map are always light, and the markers
  use more categories (7) than the palette's tested limit (3), relying on the legend and popups.
- **The overview map is redundant.** The small map at the top duplicates the layered map further down, and the
  pages are long.
- **Phone layout is not tested on a real phone.** It was only checked in headless Chrome, which cannot go
  narrower than about 500 px.
- **`better-sqlite3` is pinned to v11.** v13 crashes on Node 23.2, so check before upgrading either one.

## Running and refreshing

See [README.md](README.md) for setup (`npm install`, `npm run dev`), tests, and the order and frequency of the
data build scripts.

## Context for continuing work

Working notes for an AI agent (or a new developer) picking up the project: history, status, commands, code map, gotchas, conventions and open items.

### The project in one paragraph

**Kommunkollen Stockholm**: a Next.js web app that describes Stockholm's **11 boroughs**
(stadsdelsområden, the division since 2023-07-01) and **127 neighbourhoods** (SCB RegSO). It combines free,
open data from Swedish agencies (the brief: "solve a common problem with free data from dataportal.se"). Each
area page covers:
- who lives there, and trends since 2015
- crime and police events
- schools, and shops/healthcare/restaurants
- nature and water, and cloudburst flood risk
- housing, and the 2026 election

The UI is in **Swedish**; code, comments and docs are in **English**.

### History (so you know why things look the way they do)

1. It started as a national municipality app (Kolada-based). The user then asked to pivot to **Stockholm by
   borough** to make it more specialised (niche). The `/kommun` pages and `lib/kolada.ts` were deleted.
2. The user then asked for: schools, trends over time, planned construction, nature and water, housing
   prices (if possible), shops/healthcare/restaurants, election results and flood risk. **All of these are
   built.**
3. They then asked for `PROJECT.md`, which has the decisions and the limitations/bugs.

### Status

- Everything works. Type check, lint, 20 Vitest tests and `next build` pass (last checked 2026-10-10).
- **Nothing is committed** beyond create-next-app's initial commit. Commit only when the user asks, and branch
  first.
- The user runs the app with `npm run dev` on http://localhost:3000. They asked to have it running to look at.

### Commands

```bash
npm run dev            # dev server, port 3000 (also polls Polisen every 10 min)
npm test               # vitest; LIVE=1 npm test also hits real APIs
npx tsc --noEmit && npx eslint .
npm run build          # stop the dev server first: both use .next/. Use DISABLE_POLISEN_POLLING=1 when building
```

Data build scripts (write to `data/stockholm/`, run in this order):
`build-areas` → `build-schools` → `build-places` → `build-nature` → `build-flood` (~4 min, uses nature's land
areas) → `build-housing` → `build-elections` → `fetch-bra` (needs `NODE_EXTRA_CA_CERTS`; the npm script sets it).

### Code map

- `app/page.tsx`: start page with the borough choropleth (`components/BoroughExplorer.tsx` + `BoroughMap.tsx`) and search.
- `app/stadsdel/[id]/page.tsx`: borough page. `app/omrade/[deso]/page.tsx`: neighbourhood (`0180Rnnn`) or DeSO
  (`0180[A-C]nnnn`) page. `app/jamfor`: sortable compare tables. `app/om`: sources.
- `app/api/geocode`: Nominatim, restricted to Stockholm. `app/api/deso`: point → DeSO via SCB WFS.
  `app/api/cron/polisen`: police collector.
- `lib/stockholm.ts`: boroughs, neighbourhoods, DeSO lookups (from `data/stockholm/areas.json`).
- `lib/profile.ts`: `loadStockholm()` loads all SCB tables for all of Stockholm in one POST per table.
  `stats(data, ref)` computes any area. `AreaRef = { scb: codes to sum, work: DeSO codes for the employment table }`.
- `lib/trends.ts`: time series across SCB's 2018 and 2025 DeSO divisions.
- `lib/local.ts`: schools, places, nature, flood, housing and elections per set of DeSO codes (static JSON).
- `lib/crime.ts` (Brå JSON), `lib/polisen.ts` + `lib/db.ts` (SQLite), `lib/police-areas.ts` (place-name matching).
- `lib/scb.ts`: PxWeb v2 client (POST, 24 h memo, retries) and json-stat2 `StatTable.get({dim: code})`.
- `lib/metrics.ts` + `lib/borough-rows.ts`: the measures on the start page and compare page.
- `components/LocalSections.tsx`: all the newer cards (map, schools, services, nature, flood, housing, elections).
  `components/ProfileSections.tsx`: tiles, charts, summary. `components/TrendsCard.tsx`.
  `components/ExploreMap.tsx`: layered Leaflet map with MCF WMS overlays.
- `scripts/*.ts`: build scripts. `scripts/lib/geo.ts` has proj4 definitions (EPSG:3006, 3011), the WFS area
  fetch, `desoLocator()` and `mapLimit()`.

### Gotchas learned the hard way

**SCB**
- PxWeb v2 lives at `https://api.scb.se/OV0104/v2beta/api/v2`.
- DeSO 2025 codes look like `0180C1010_DeSO2025`, RegSO like `0180R009_RegSO2025`. Codes without a suffix are
  the **2018** division and only have years ≤ 2023.
- TAB6680 (employment) has no municipality or country rows; the app sums DeSOs.
- If `ContentsCode` has more than one value you must select one (e.g. TAB6420 needs `000007E1` for hectares),
  otherwise `StatTable.get` returns null.
- Wildcards: `*_DeSO2025` works, `0180*_DeSO2025` doesn't. `from(2015)` and `top(1)` work.

**Geometry and coordinates**
- SCB WFS (`geodata.scb.se/geoserver/stat/wfs`): the geometry field is `sp_geometry`, and CQL points are
  `POINT(lon lat)`.
- Stockholm stad's APIs (Hitta service, Stockholm växer) use **EPSG:3011** (SWEREF 99 18 00), not 3006.

**Polisen**
- The API returns 500 events. `?locationname=Stockholm` gives about six months for Stockholm.
- The location is at county level; the municipality is the last comma segment of `name`.

**Brå**
- No API. `scripts/fetch-bra-stockholm.ts` replays the SOL form (menu 101).
- The server omits its intermediate certificate, so `scripts/certs/` holds the DigiCert intermediate. Never
  disable TLS verification.

**MCF flood maps**
- Raster only. WMS layers: `57` (cloudburst, Stockholm), `78` (Mälaren 100-year). EPSG:3857 works for Leaflet.
- `build-flood` counts legend-coloured pixels from REST `export` (layer 201).

**Other sources**
- Valmyndigheten publishes XLSX only, and download URLs change when files are replaced. Voting districts are
  in EPSG:3006. Rows such as "Röstberättigade", "Valdeltagande" and "Summa giltiga röster" sit in the party
  column and must be excluded.
- Overpass: overpass-api.de is often busy; the script falls back to mirrors.
- Nominatim: no autocomplete (usage policy). Max 1 request/s, with a User-Agent.
- CARTO tiles now need a key, so use OSM tiles.

**Next.js and libraries**
- `better-sqlite3` **v11** (v13 segfaults on Node 23.2). It is in `serverExternalPackages`.
- Leaflet must never be imported server-side: use `*Lazy.tsx` wrappers with `dynamic(..., { ssr: false })`, and
  keep shared constants (e.g. `lib/ramp.ts`) out of Leaflet files.
- Recharts: keep `isAnimationActive={false}` (animations hid data in renders) and `itemSorter={null}` on legends.

**Shell**
- Shell `rm` with variable paths is blocked by a safety check. Use `"${VAR:?}"` or literal paths.

### Conventions

- Match existing style: Tailwind theme tokens (`bg-surface`, `text-ink-2`, `border-line`, `text-muted`,
  `text-accent`, `text-good`/`text-bad`), cards via `components/Card.tsx` (optional `id` for the section menu).
- Colours come from the validated palette (the dataviz skill's reference palette) in `app/globals.css`, with
  light and dark tokens. Comparison charts use the area in `--series-1` (blue) and the reference in `--reference`
  (grey). Map categorical colours are in `LocalSections.tsx` (`COLORS`).
- Always show a comparison (area vs borough vs Stockholm) and a source line on every card. State caveats on the
  page instead of hiding them.
- Aggregated areas use means, never medians. Compare like with like (see `summarize()` and the turnout handling
  in `electionFor`).
- Static JSON for slow-changing data, built by scripts. Live calls only for SCB statistics, geometry, geocoding
  and police events.
- Verify visually: `curl` the routes, then take headless Chrome screenshots, e.g.
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --window-size=1280,3000 --virtual-time-budget=10000 --screenshot=out.png URL`.
  Chrome doesn't exit by itself while the dev server keeps a connection, so poll for the file, then `pkill`
  it. Crop tall images with `sips`.

### Open items and ideas (not started unless the user asks)

- **Bug:** `loadTrends()` in `lib/trends.ts` caches its promise forever (no 24 h TTL like `queryTable`). The
  user was offered a fix; no answer yet.
- **UX:** the small overview map duplicates the layered map. Pages are long (tabs were suggested). DeSO pages
  mix DeSO statistics with neighbourhood-level local sections without saying so clearly.
- **Commute time** (Trafiklab, free key) was suggested earlier but not chosen by the user.
- **Before public launch:** check licences for Stockholm växer, Bostadsförmedlingen statistics and the Hitta
  service API. Test on a real phone.
- The full list of limitations and bugs is in `PROJECT.md` → "Limitations and known bugs".

### Working with this user

- They write in English. Give them a recommendation, not an exhaustive survey. They like being shown several
  options with one recommended.
- They are interested in the product side ("what would someone moving here want?"), so explain data gaps
  plainly.
- They asked to see the app running locally; restart `npm run dev` after builds.
