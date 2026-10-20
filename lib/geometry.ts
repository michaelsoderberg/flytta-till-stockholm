/** Centre of a polygon geometry's bounding box, as [lat, lon]. */
export function geometryCenter(g: GeoJSON.Geometry): [number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === "number") {
      const [x, y] = c as number[];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    } else c.forEach(visit);
  };
  if ("coordinates" in g) visit(g.coordinates);
  return [(minY + maxY) / 2, (minX + maxX) / 2];
}
