# Implementation history

How Kommunkollen Stockholm was planned and built, from the moment the idea was chosen: what was asked, which
options were proposed, what was decided, and what was then built. Each step is a round of conversation: a
request or feedback from the product owner, proposals from Claude, and a decision. For the full project
description, decisions and limitations, see [PROJECT.md](PROJECT.md).

---

## Step 1: Choosing Kommunkollen

**Starting point:** the brief was to build a webapp that solves a problem many people share, using free data from
[dataportal.se](https://www.dataportal.se), ideally by combining several APIs. Initially we bounced back and forward about the different APIs that dataportal offers and what kind of data and limitations to create API-keys there was.
(job search, commuting, outdoor planning, electricity prices) that weren't chosen, these were proposed:

| Idea             | Sources                                                    |
| ---------------- | ---------------------------------------------------------- |
| Medicinkollen    | Shortages and cheaper substitutes                          |
| Andas lätt       | Pollen and air quality                                     |
| Företagskollen   | Bolagsverket and job ads                                   |
| **Kommunkollen** | Kolada, SCB and Skolverket ("what do I get for my taxes?") |
| Läget nära mig   | A local crisis and disruption feed                         |

**Decision:** Kommunkollen, extended with:

- the number of police reports in the area, what kind of crime and where;
- a description of the people who live there, like the "people" section on hitta.se.

**Feasibility findings that shaped the plan:**

- **No street-level crime.** No open data places crimes at street level. Polisen's API only places events at
  county level (the municipality is in the title), and only returns the latest 500 events, so they must be
  stored over time. Brå's official crime rates per municipality were available through Kolada.
- **No hitta.se.** It is a private site and must not be scraped. SCB publishes the same kind of statistics
  openly for about 6,000 small DeSO areas: age, income, education, households and housing. An address is
  matched to its area through SCB's map service.

**Tech stack** (chosen by Author and approved as part of the plan): Next.js + TypeScript, Tailwind, Recharts,
Leaflet + OpenStreetMap, SQLite for police events, Vitest.

**Built:**

- municipality pages: Kolada indicators and Brå crime rates per type, with trends;
- police events stored in SQLite;
- area pages ("Vilka bor här?") with SCB statistics and a plain-language summary;
- a compare page and address search.

Problems found while building:

- `better-sqlite3` v13 crashed on Node 23.2, so it was pinned to v11.
- SCB's employment table has no municipality totals, so it is summed from the small areas.

## Step 2: Narrow down to Stockholm and its boroughs

**Feedback:** filter down to Stockholm only and compare each borough instead, to make the project more niche.

**Research findings:**

- **Stockholm has 11 boroughs, not 13.** Since 1 July 2023, Järva = Rinkeby-Kista + Spånga-Tensta, and
  Norra innerstaden = Norrmalm + Östermalm. This was verified against the city's site, Wikipedia and Brå.
- **Statistics:** all SCB statistics exist for the 569 DeSO areas and 127 neighbourhoods (RegSO) in Stockholm,
  so boroughs can be built by adding up areas.
- **Crime:** Brå has crime per borough in its statistics database, but no API. Kolada only goes down to
  municipality level.
- **Lost:** Kolada's service indicators (schools, elderly care) are per municipality, so they would be the same
  for every borough.

**Options and decisions:**

- **Scope:** pivot to Stockholm only, or add a Stockholm section to the national app. → **Pivot to Stockholm only.**
- **Crime per borough:** three options were proposed:
  - Brå tables plus police events placed by text matching;
  - text matching only;
  - skip crime per borough.

  → **Brå tables + police text matching.**

**Built:**

- **Borough lookup:** each DeSO area assigned to a borough by geometry, using Stockholm stad's 117 district
  polygons (CC0) and the official district → borough lists. All 569 DeSO and 127 RegSO were assigned, and no
  neighbourhood straddles two boroughs.
- **Crime data:** a script that replays Brå's web form and downloads 12 crime categories per borough for
  2015–2025. Boroughs that were merged are rebuilt from their predecessors, so the series run unbroken.
  - Brå's server omits an intermediate certificate, so it is added via `NODE_EXTRA_CA_CERTS`. TLS verification
    is never turned off.
- **Police events:** matched to boroughs by district, neighbourhood and landmark names in the text. This works
  for about two thirds of events.
  - Filtering the API with `?locationname=Stockholm` gives about six months of history straight away.
- **Pages:**
  - a start page with a choropleth map of the boroughs and a ranking;
  - borough pages;
  - neighbourhood pages;
  - a sortable compare page.
- **Removed:** the national municipality pages and the Kolada code.
- **Fixes along the way:**
  - CARTO map tiles now require an API key, so the map switched to OpenStreetMap tiles.
  - Address search was restricted to Stockholm municipality after "Götgatan 10" matched a street in Sundbyberg.

## Step 3: What would someone moving here want to know?

**Question:** if you lived in one of these areas, or wanted to move to, say, Blackeberg from another city, what
information is missing?

**Proposed:** a list of gaps, ranked by importance and by whether open data exists:

- commute time
- schools
- trends over time
- planned construction
- nature and water
- noise and air
- housing prices (weak in open data)
- perceived safety
- nearby services
- elections
- broadband
- flood risk

**Decision:** add schools, trends over time, planned construction, nature and water, housing prices (if
possible), shops/healthcare/restaurants, election results and flood risk. Commute time was not chosen.

**Research:** four parallel agents tested the sources live:

- Skolverket and Stockholm stad (schools and preschools);
- SCB, Bostadsförmedlingen and Stockholm växer (construction and housing);
- Naturvårdsverket, HaV, SCB and MCF (nature and flood risk);
- Valmyndigheten and OpenStreetMap (elections and services).

**Built:**

| Feature                        | Source and method                                                                                                                                                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trends since 2015              | SCB only publishes years up to 2023 for the 2018 area division, so the 544 older areas were also mapped to boroughs and neighbourhoods to join the series.                                                                                                              |
| Schools                        | 339 schools from Skolverket (grade average, eligibility, qualified teachers, pupils per teacher) and 872 preschools from Stockholm stad (whose coordinates use the local EPSG:3011 grid).                                                                               |
| Shops, healthcare, restaurants | 5,614 places from OpenStreetMap (Overpass), placed in areas.                                                                                                                                                                                                            |
| Nature and water               | Green space, water and protected nature per area, and 45 bathing spots with EU water quality.                                                                                                                                                                           |
| Flood risk                     | Länsstyrelsen's county model was tried first, but it had no data for southern Stockholm, so it was dropped. MCF's cloudburst map covers the whole city but is only published as images, so a script counts flooded pixels per area by legend colour, at 5 m resolution. |
| Housing                        | Rents for the inner city, Söderort and Västerort (SCB); queue times per district (Bostadsförmedlingen); 990 projects from Stockholm växer, about 77,000 planned homes. Sale prices only exist for the whole city or Greater Stockholm, which the page states.           |
| Elections 2026                 | Final results per voting district from Valmyndigheten, split across neighbourhoods by overlapping area. Turnout is compared like for like, since late-counted votes have no district.                                                                                   |
| Layered map                    | Toggle schools, preschools, shops, healthcare, bathing spots, projects, and MCF flood overlays.                                                                                                                                                                         |

New measures on the start page and compare page: green space, cloudburst flooding, school grade average and turnout.

## Step 4: Documentation

**Requests and results:**

1. **PROJECT.md:** what the project does, why, the tech stack, and decisions with their reasons.
2. **Limitations and known bugs:** a section was added to PROJECT.md.
   - Writing it surfaced a real bug: trend data is cached for the whole server lifetime. It is listed as an
     open item.
3. **CLAUDE.md:** enough context to continue in a new session.
4. **Restructure:** the session notes were moved into PROJECT.md. CLAUDE.md now holds the product owner's four
   questions with answers in Swedish (what the project does, the stack and why, architecture principles, what
   the agent must not do) plus an import of PROJECT.md.

---

## Recurring principles behind the decisions

- **Open public data only.** Private sources (hitta.se, Hemnet, Booli) were ruled out even where they would have
  been easier.
- **Verify before building.** Every source was tested live first. Assumptions were checked, for example 11 vs 13
  boroughs, and data gaps were spotted before building on them (e.g. Länsstyrelsen's flood model).
- **Be honest about limits.** Where data is missing or approximate, the page says so instead of guessing.
- **The product owner decides direction.** Claude proposes options with one recommendation, and the product
  owner chooses or redirects.
