import { CRIME_FETCHED } from "@/lib/crime";

export const metadata = { title: "Om datan – Kommunkollen Stockholm" };

const SOURCES = [
  {
    name: "SCB – statistikdatabasen (PxWeb API v2)",
    use: "Befolkning, hushåll, inkomst, utbildning, boende, bilar och sysselsättning för Stockholms 569 DeSO-områden och 127 grannskap (RegSO). Stadsdelsområdena summeras från sina DeSO-områden.",
    url: "https://api.scb.se/OV0104/v2beta/api/v2",
  },
  {
    name: "SCB – öppna geodata (WFS)",
    use: "Gränser för DeSO och RegSO. Används för att hitta vilket område en adress ligger i och för att rita kartorna.",
    url: "https://geodata.scb.se/geoserver/stat/wfs",
  },
  {
    name: "Brå – statistikdatabasen över anmälda brott (SOL)",
    use: `Anmälda brott per stadsdelsområde och brottstyp 2015–. Brå saknar API, så tabellerna laddas ner en gång per år med ett skript (senast ${CRIME_FETCHED}).`,
    url: "https://statistik.bra.se/solwebb/action/index",
  },
  {
    name: "Polisen – händelser",
    use: "Polisens publicerade händelser i Stockholm. Placeras i stadsdelsområden när texten nämner en känd plats.",
    url: "https://polisen.se/api/events?locationname=Stockholm",
  },
  {
    name: "Stockholms stad – stadsdelar (CC0)",
    use: "Gränser för stadens 117 stadsdelar, som används för att koppla varje DeSO-område till rätt stadsdelsområde (indelningen från 2023).",
    url: "https://github.com/krasch/stockholm-stadsdelar",
  },
  {
    name: "Skolverket – skolenheter och statistik",
    use: "Grundskolor och gymnasier med läge, huvudman, meritvärde, behörighet, andel legitimerade lärare och elever per lärare.",
    url: "https://api.skolverket.se/planned-educations/v3",
  },
  {
    name: "Stockholms stad – Hitta service och Stockholm växer",
    use: "Förskolor med läge och huvudman, samt stadens bostads- och byggprojekt (planerade och pågående).",
    url: "https://apigw.stockholm.se/api/PublicHittaCMS · https://vaxer.stockholm/projekt",
  },
  {
    name: "Valmyndigheten – valresultat 2026",
    use: "Slutligt antal röster och valdeltagande per valdistrikt i riksdags- och kommunvalet, fördelade på grannskap efter yta.",
    url: "https://www.val.se/valresultat",
  },
  {
    name: "MCF (tidigare MSB) – översvämningskarteringar",
    use: "Skyfallskartering för Stockholm (100-årsregn) och Mälarens 100-årsflöde. Visas på kartan; andel mark med stående vatten räknas fram per område.",
    url: "https://gis-tjanster.mcf.se/arcgis/rest/services/Oversvamningskarteringar",
  },
  {
    name: "Naturvårdsverket, Havs- och vattenmyndigheten och SCB:s grönområden",
    use: "Skyddad natur, badplatser med EU-klassning av vattenkvaliteten, grönområden och vattenareal per område.",
    url: "https://geodata.naturvardsverket.se · https://gw.havochvatten.se",
  },
  {
    name: "SCB – hyror och bostadspriser, Bostadsförmedlingen – kötider",
    use: "Medianhyror för inre staden, Söderort och Västerort, priser för villor och bostadsrätter (bara kommun/Stor-Stockholm), kötider per stadsdel.",
    url: "https://bostad.stockholm.se/statistik",
  },
  {
    name: "OpenStreetMap / Nominatim",
    use: "Butiker, restauranger, vård, apotek, gym och lekplatser (Overpass API, ODbL), adressökning och bakgrundskartor.",
    url: "https://nominatim.openstreetmap.org",
  },
];

export default function AboutPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Om datan</h1>
      <p className="text-ink-2">
        Kommunkollen Stockholm samlar öppna data från svenska myndigheter, listade på{" "}
        <a href="https://www.dataportal.se" className="text-accent hover:underline">Sveriges dataportal</a>, och bryter ner dem
        på Stockholms 11 stadsdelsområden och 127 grannskap.
      </p>
      <ul className="flex flex-col gap-3">
        {SOURCES.map((s) => (
          <li key={s.name} className="rounded-xl border border-line bg-surface p-4">
            <div className="font-semibold">{s.name}</div>
            <p className="mt-1 text-sm text-ink-2">{s.use}</p>
            <code className="mt-2 block break-all text-xs text-muted">{s.url}</code>
          </li>
        ))}
      </ul>
      <h2 className="text-xl font-semibold">Begränsningar</h2>
      <ul className="list-disc space-y-2 pl-5 text-sm text-ink-2">
        <li>Brott per 100 000 invånare räknas där brottet begicks. Områden med många besökare, som city, får därför höga tal.</li>
        <li>Brottsstatistiken gäller anmälda brott – inte alla brott anmäls, och anmälningsbenägenheten varierar.</li>
        <li>
          Polisen anger bara &quot;Stockholm&quot; som plats. Händelser placeras utifrån platsnamn i texten, vilket fungerar för ungefär
          två av tre händelser och ibland kan bli fel.
        </li>
        <li>SCB lägger sedan 2025 till en liten slumpmässig osäkerhet i små områden för att skydda enskilda.</li>
        <li>För stadsdelsområden visas genomsnittlig ekonomisk standard, eftersom medianer inte kan summeras.</li>
        <li>Områdesbeskrivningen visar genomsnitt för hela området och säger inget om enskilda personer.</li>
        <li>Bostadspriser finns inte som öppna data per stadsdel – bara för hela kommunen eller Stor-Stockholm.</li>
        <li>Valdistrikt följer inte SCB:s områden; rösterna fördelas efter yta och är därför ungefärliga för små grannskap.</li>
        <li>Översvämningsandelen är uträknad från en kartbild och är en indikation, inte en exakt beräkning.</li>
      </ul>
    </div>
  );
}
