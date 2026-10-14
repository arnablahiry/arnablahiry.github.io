// Countries, regions and cities for the My Travels editor
// (scripts/travel-edit.js, served by scripts/edit-server.js), and the writer
// for scripts/travel-places.js, the list of visited countries and places.
//
// Data: world-countries (ISO numeric codes as used by the globe's map,
// continents) and country-state-city (regions and cities with coordinates).
// The city list is ~8 MB, so it is read on first use only.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const placesPath = path.join(__dirname, 'travel-places.js');
const assetsDir = path.join(repoRoot, 'node_modules', 'country-state-city', 'lib', 'assets');
const FOLDER_RE = /^[a-z0-9][a-z0-9_-]*$/;

let countryList = null;
let geo = null;

function num(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 1e4) / 1e4 : null;
}

function continentOf(c) {
  if (c.region === 'Americas') return c.subregion === 'South America' ? 'South America' : 'North America';
  if (c.region === 'Antarctic') return 'Antarctica';
  return c.region;
}

// [{ id, iso2, name, continent, lat, lng }], by name. id is the ISO 3166-1
// numeric code as a number (the world-atlas feature id).
function countries() {
  if (countryList) return countryList;
  countryList = require('world-countries')
    .filter((c) => c.ccn3)
    .map((c) => ({
      id: Number(c.ccn3),
      iso2: c.cca2,
      name: c.name.common,
      continent: continentOf(c),
      lat: num(c.latlng[0]),
      lng: num(c.latlng[1])
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countryList;
}

function loadGeo() {
  if (geo) return geo;
  const states = JSON.parse(fs.readFileSync(path.join(assetsDir, 'state.json'), 'utf8'));
  const cities = JSON.parse(fs.readFileSync(path.join(assetsDir, 'city.json'), 'utf8'));
  const statesBy = new Map();
  states.forEach((s) => {
    if (!statesBy.has(s.countryCode)) statesBy.set(s.countryCode, []);
    statesBy.get(s.countryCode).push(s);
  });
  // city rows: [name, countryCode, stateCode, lat, lng]
  const citiesBy = new Map();
  cities.forEach((c) => {
    if (!citiesBy.has(c[1])) citiesBy.set(c[1], []);
    citiesBy.get(c[1]).push(c);
  });
  geo = { statesBy, citiesBy };
  return geo;
}

// Regions of one country, each with its cities:
//   [{ name, lat, lng, cities: [[name, lat, lng], ...] }]
// Regions without coordinates in the data get the mean of their cities, or
// the country's centre.
function regions(countryId) {
  const country = countries().find((c) => c.id === Number(countryId));
  if (!country) return null;
  const { statesBy, citiesBy } = loadGeo();
  const byCode = new Map();
  (statesBy.get(country.iso2) || []).forEach((s) => {
    byCode.set(s.isoCode, { name: s.name, lat: num(s.latitude), lng: num(s.longitude), cities: [] });
  });
  (citiesBy.get(country.iso2) || []).forEach((c) => {
    const region = byCode.get(c[2]);
    const lat = num(c[3]);
    const lng = num(c[4]);
    if (region && lat !== null && lng !== null) region.cities.push([c[0], lat, lng]);
  });
  const list = Array.from(byCode.values());
  list.forEach((r) => {
    if (r.lat === null || r.lng === null) {
      if (r.cities.length) {
        r.lat = num(r.cities.reduce((s, c) => s + c[1], 0) / r.cities.length);
        r.lng = num(r.cities.reduce((s, c) => s + c[2], 0) / r.cities.length);
      } else {
        r.lat = country.lat;
        r.lng = country.lng;
      }
    }
    r.cities.sort((a, b) => a[0].localeCompare(b[0]));
  });
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

// "Côte d'Ivoire" -> "cote_d_ivoire" (folder under images/travels/)
function folderFor(name) {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'country';
}

function cleanPlace(p) {
  if (!p || typeof p !== 'object') return null;
  const name = String(p.name || '').trim();
  if (!name) return null;
  const out = { name };
  const region = String(p.region || '').trim();
  if (region) out.region = region;
  if (p.type === 'region') out.type = 'region';
  const lat = num(p.lat);
  const lng = num(p.lng);
  if (lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    out.lat = lat;
    out.lng = lng;
  }
  return out;
}

// { id: { name, continent, folder, places: [...] } } from the editor, checked
// and normalised. Countries keep the folder they had; new ones get one from
// their name.
function cleanPlaces(input) {
  const known = new Map(countries().map((c) => [String(c.id), c]));
  const out = {};
  Object.keys(input || {}).forEach((id) => {
    if (!/^\d{1,3}$/.test(id)) return;
    const entry = input[id] || {};
    const ref = known.get(String(Number(id)));
    const name = String(entry.name || (ref && ref.name) || '').trim();
    if (!name) return;
    const folder = FOLDER_RE.test(String(entry.folder || '')) ? entry.folder : folderFor(name);
    out[String(Number(id))] = {
      name,
      continent: String(entry.continent || (ref && ref.continent) || '').trim(),
      folder,
      places: (Array.isArray(entry.places) ? entry.places : []).map(cleanPlace).filter(Boolean)
    };
  });
  return out;
}

function formatPlaces(places) {
  const ids = Object.keys(places).sort((a, b) => places[a].name.localeCompare(places[b].name));
  const body = ids.map((id) => {
    const c = places[id];
    const head = `  ${JSON.stringify(id)}: {\n    "name": ${JSON.stringify(c.name)}, "continent": ${JSON.stringify(c.continent)}, "folder": ${JSON.stringify(c.folder)},\n`;
    const list = c.places.length
      ? `    "places": [\n${c.places.map((p) => `      {${Object.keys(p).map((k) => `${JSON.stringify(k)}: ${JSON.stringify(p[k])}`).join(', ')}}`).join(',\n')}\n    ]\n`
      : '    "places": []\n';
    return `${head}${list}  }`;
  });
  return [
    '// Countries and places on the My Travels globe (travels.html).',
    '// Written by the site editor (npm run edit, then Edit on My Travels); fine',
    '// to edit by hand. Keys are ISO 3166-1 numeric country codes; folder is the',
    '// photo folder under images/travels/. A place with lat/lng gets a pin on the',
    '// globe ("type": "region" marks a whole region rather than a city); one',
    '// without is only listed.',
    `window.TRAVEL_PLACES = {\n${body.join(',\n')}\n};`,
    ''
  ].join('\n');
}

// Writes scripts/travel-places.js; the previous version goes to
// .edit-trash/travel-places/.
function writePlaces(input) {
  const places = cleanPlaces(input);
  if (fs.existsSync(placesPath)) {
    const trashDir = path.join(repoRoot, '.edit-trash', 'travel-places');
    fs.mkdirSync(trashDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(placesPath, path.join(trashDir, `${stamp}_travel-places.js`));
  }
  fs.writeFileSync(placesPath, formatPlaces(places));
  return places;
}

module.exports = { countries, regions, writePlaces, folderFor };
