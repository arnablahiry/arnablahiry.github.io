#!/usr/bin/env node

// Builds data/world-map.json, the map behind the My Travels globe:
// Natural Earth 1:50m countries (world-atlas) and large lakes, simplified to
// the detail a globe a few hundred pixels across can show, in one TopoJSON.
//
//   npm run travel:map
//
// The 1:50m map has ten times the points of the 1:110m one the globe used
// before; drawn as is, spinning it would drop to a few frames a second on
// phones. Simplifying keeps the shapes (fjords, islands, small countries)
// while dropping points closer together than the globe can show.

const fs = require('fs');
const path = require('path');
const https = require('https');
const { feature, quantize } = require('topojson-client');
const { topology } = require('topojson-server');
const { presimplify, simplify, quantile, sphericalTriangleArea } = require('topojson-simplify');

const repoRoot = path.resolve(__dirname, '..');
const outPath = path.join(repoRoot, 'data', 'world-map.json');
const LAKES_URL = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_lakes.geojson';
const KEEP_POINTS = 0.3;        // share of the 1:50m points kept
const MIN_LAKE_KM2 = 1500;      // smaller lakes are a pixel or two on the globe
const EARTH_KM = 6371;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`${url}: HTTP ${res.statusCode}`)); res.resume(); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

// Area of a lon/lat ring in km² (fine for comparing lake sizes)
function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    const k = Math.cos(((y1 + y2) / 2) * Math.PI / 180);
    sum += (x2 - x1) * k * (y2 + y1);
  }
  const deg = Math.PI / 180 * EARTH_KM;
  return Math.abs(sum / 2) * deg * deg;
}

function polygonArea(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.reduce((s, rings) => s + ringArea(rings[0]) - rings.slice(1).reduce((h, r) => h + ringArea(r), 0), 0);
}

function countPoints(topo) {
  return topo.arcs.reduce((s, arc) => s + arc.length, 0);
}

async function main() {
  const world = require('world-atlas/countries-50m.json');
  const countries = feature(world, world.objects.countries);
  countries.features.forEach((f) => { f.properties = { name: f.properties.name }; });

  const lakeSource = await fetchJson(LAKES_URL);
  const lakes = {
    type: 'FeatureCollection',
    features: lakeSource.features
      .filter((f) => f.geometry && polygonArea(f.geometry) >= MIN_LAKE_KM2)
      .map((f) => ({ type: 'Feature', properties: {}, geometry: f.geometry }))
  };

  // simplify on plain coordinates, then quantize (small integer deltas)
  let topo = topology({ countries, lakes });
  const before = countPoints(topo);
  topo = presimplify(topo, sphericalTriangleArea);
  topo = simplify(topo, quantile(topo, KEEP_POINTS));   // quantile(p): the weight that keeps the top p of points
  // simplify leaves each point's weight as a third value; drop it
  topo.arcs = topo.arcs.map((arc) => arc.map((p) => [p[0], p[1]]));
  topo = quantize(topo, 1e5);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(topo));
  const after = countPoints(topo);
  console.log(`Wrote ${path.relative(repoRoot, outPath)}: ${countries.features.length} countries, ${lakes.features.length} lakes, `
    + `${after} of ${before} points, ${Math.round(fs.statSync(outPath).size / 1024)} KB`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
