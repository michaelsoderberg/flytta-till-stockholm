// Builds data/stockholm/schools.json: compulsory and upper-secondary schools (Skolverket) and preschools
// (Stockholms stad) in Stockholm, each placed in its DeSO, neighbourhood and borough.
// Statistics update about once a year (merit values in the autumn); run yearly:  npm run build-schools
//
// Sources:
//   Skolverket, Planned Educations API v3 (school units, coordinates, statistics)
//   Stockholms stad, Hitta service API (preschools, coordinates in SWEREF 99 18 00)
import { writeFileSync } from "node:fs";
import { desoLocator, fromSweref1800, mapLimit, type Location } from "./lib/geo";

const PE = "https://api.skolverket.se/planned-educations/v3";
const PE_HEADERS = { Accept: "application/vnd.skolverket.plannededucations.api.v3.hal+json" };
const HITTA = "https://apigw.stockholm.se/api/PublicHittaCMS/api";

type Stat = { value: string; valueType: string; timePeriod: string };

async function pe<T>(path: string): Promise<T>;
async function pe<T>(path: string, optional: true): Promise<T | null>;
async function pe<T>(path: string, optional = false): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${PE}${path}`, { headers: PE_HEADERS });
    if (res.ok) return ((await res.json()) as { body: T }).body;
    if (res.status === 404 && optional) return null;
    if (attempt >= 2) throw new Error(`Skolverket ${res.status} ${path}`);
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
}

/** Latest reported value; ".." (too few pupils) and "." (missing) become null. */
function latest(series: Stat[] | undefined): { value: number | null; period: string | null; suppressed: boolean } {
  const s = series?.[0];
  if (!s) return { value: null, period: null, suppressed: false };
  if (s.valueType !== "EXISTS" || s.value == null) return { value: null, period: s.timePeriod, suppressed: s.valueType.startsWith("OMITTED") };
  const n = Number(s.value.replace(/[^\d,.-]/g, "").replace(",", "."));
  return { value: Number.isFinite(n) ? n : null, period: s.timePeriod, suppressed: false };
}

type ListedUnit = { code: string; name: string; typeOfSchooling: { code: string }[]; principalOrganizerType: string };

async function schools(locate: (lon: number, lat: number) => Location | null) {
  const units: ListedUnit[] = [];
  for (let page = 0; ; page++) {
    const body = await pe<{ _embedded?: { listedSchoolUnits: ListedUnit[] }; page: { totalPages: number } }>(
      `/school-units?geographicalAreaCode=0180&size=100&page=${page}`,
    );
    units.push(...(body._embedded?.listedSchoolUnits ?? []));
    if (page + 1 >= body.page.totalPages) break;
  }
  const relevant = units.filter((u) => u.typeOfSchooling.some((t) => t.code === "gr" || t.code === "gy"));
  console.log(`${units.length} skolenheter, ${relevant.length} grundskolor/gymnasier`);

  const out = await mapLimit(relevant, 5, async (u) => {
    const types = u.typeOfSchooling.map((t) => t.code);
    const detail = await pe<{ wgs84_Lat: string; wgs84_Long: string; contactInfo?: { web?: string } }>(`/school-units/${u.code}`);
    const lat = Number(detail.wgs84_Lat);
    const lon = Number(detail.wgs84_Long);
    const loc = Number.isFinite(lat) && Number.isFinite(lon) ? locate(lon, lat) : null;
    const gr = types.includes("gr") ? await pe<Record<string, Stat[]>>(`/school-units/${u.code}/statistics/gr`, true) : null;
    const gy = !types.includes("gr") && types.includes("gy") ? await pe<Record<string, Stat[]>>(`/school-units/${u.code}/statistics/gy`, true) : null;
    const stats = gr ?? gy ?? {};
    const merit = latest(gr?.averageGradesMeritRating9thGrade);
    const pupils = stats.totalNumberOfPupils?.[0]?.value?.match(/\d[\d\s]*/)?.[0].replace(/\s/g, "");
    return {
      code: u.code,
      // Some names carry the unit code, e.g. "Blackebergs gymnasium 85152591".
      name: u.name.replace(/\s+\d{8}$/, ""),
      kind: types.includes("gr") ? "grundskola" : "gymnasium",
      grades: types.includes("gr") && types.includes("gy") ? "gr+gy" : null,
      owner: u.principalOrganizerType,
      lat: loc ? lat : null,
      lon: loc ? lon : null,
      ...(loc ?? { deso: null, regso: null, borough: null }),
      web: detail.contactInfo?.web ?? null,
      pupils: pupils ? Number(pupils) : null,
      merit9: merit.value,
      meritPeriod: merit.period,
      meritSuppressed: merit.suppressed,
      passedAll9: latest(gr?.ratioOfPupilsIn9thGradeWithAllSubjectsPassed).value,
      eligible9: latest(gr?.ratioOfPupils9thGradeEligibleForNationalProgramYR).value,
      certifiedTeachers: latest(stats.certifiedTeachersQuota).value,
      studentsPerTeacher: latest(stats.studentsPerTeacherQuota).value,
    };
  });
  const outside = out.filter((s) => !s.deso).length;
  if (outside) console.warn(`${outside} skolor saknar koordinater eller ligger utanför Stockholm`);
  return out.filter((s) => s.deso);
}

type HittaUnit = {
  id: string;
  attributes: { name: string; address?: { street?: string }; location?: { east: number; north: number } };
  links: { self: string };
};

async function preschools(locate: (lon: number, lat: number) => Location | null) {
  const forms = [
    { id: 29, owner: "Kommunal" },
    { id: 37, owner: "Fristående" },
    { id: 39, owner: "Föräldrakooperativ" },
  ];
  const out = [];
  for (const form of forms) {
    const url = `${HITTA}/serviceunits?filter[servicetype.id]=2&filter[organizationalForm.id]=${form.id}&page[limit]=1500&page[offset]=0&sort=name`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Hitta service ${res.status}`);
    const json = (await res.json()) as { data: HittaUnit[] };
    for (const u of json.data) {
      const l = u.attributes.location;
      if (!l?.east || !l?.north) continue;
      const [lon, lat] = fromSweref1800(l.east, l.north);
      const loc = locate(lon, lat);
      if (!loc) continue;
      const slug = u.links.self.split("/").at(-1);
      out.push({
        id: u.id,
        name: u.attributes.name,
        owner: form.owner,
        address: u.attributes.address?.street ?? null,
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        ...loc,
        web: slug ? `https://forskola.stockholm/hitta-forskola/forskola/${slug}` : null,
      });
    }
  }
  console.log(`${out.length} förskolor`);
  return out;
}

async function main() {
  const locate = await desoLocator();
  const [s, p] = [await schools(locate), await preschools(locate)];
  writeFileSync(
    "data/stockholm/schools.json",
    JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), schools: s, preschools: p }),
  );
  console.log(`Wrote data/stockholm/schools.json (${s.length} skolor, ${p.length} förskolor)`);
}

main();
