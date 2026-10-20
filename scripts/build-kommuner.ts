// Builds data/kommuner.json (municipality code, name, county) from Kolada.
import { writeFileSync } from "node:fs";

const LAN: Record<string, string> = {
  "01": "Stockholms län", "03": "Uppsala län", "04": "Södermanlands län",
  "05": "Östergötlands län", "06": "Jönköpings län", "07": "Kronobergs län",
  "08": "Kalmar län", "09": "Gotlands län", "10": "Blekinge län",
  "12": "Skåne län", "13": "Hallands län", "14": "Västra Götalands län",
  "17": "Värmlands län", "18": "Örebro län", "19": "Västmanlands län",
  "20": "Dalarnas län", "21": "Gävleborgs län", "22": "Västernorrlands län",
  "23": "Jämtlands län", "24": "Västerbottens län", "25": "Norrbottens län",
};

async function main() {
  const res = await fetch("https://api.kolada.se/v3/municipality");
  const json = (await res.json()) as { values: { id: string; title: string; type: string }[] };
  const kommuner = json.values
    .filter((m) => m.type === "K")
    .map((m) => ({ kod: m.id, namn: m.title, lanskod: m.id.slice(0, 2), lan: LAN[m.id.slice(0, 2)] }))
    .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
  writeFileSync("data/kommuner.json", JSON.stringify({ lan: LAN, kommuner }, null, 1));
  console.log(`Wrote ${kommuner.length} kommuner`);
}

main();
