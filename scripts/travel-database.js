(function () {
  // Photo credits: who took each photo (Author column of
  // data/travel-captions.xlsx). Anyone without a picture here gets a
  // round initial instead.
  const DEFAULT_AUTHOR = 'Arnab';
  const AUTHOR_IMAGES = {
    Arnab: 'images/pfp_no_pixel.jpeg'
  };
  function initialAvatar(name) {
    const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
      + '<circle cx="32" cy="32" r="32" fill="#3a3320"/>'
      + '<text x="32" y="42" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="#feda4a">'
      + letter.replace(/[<&"]/g, '') + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function authorImage(name) {
    return AUTHOR_IMAGES[name] || initialAvatar(name);
  }

  const photo = (entry, desc, author) => {
    const src = (entry && typeof entry === 'object') ? entry.src : entry;
    const credit = author || DEFAULT_AUTHOR;
    return {
      src: src,
      thumbSrc: (entry && typeof entry === 'object' && entry.thumbSrc) || src,
      desc: desc || (entry && typeof entry === 'object' ? (entry.desc || entry.caption) : '') || '',
      credit: credit,
      creditImage: authorImage(credit)
    };
  };
  const manifest = (window.TRAVEL_PHOTO_MANIFEST && typeof window.TRAVEL_PHOTO_MANIFEST === 'object')
    ? window.TRAVEL_PHOTO_MANIFEST
    : {};
  const captionManifest = (window.TRAVEL_CAPTIONS && typeof window.TRAVEL_CAPTIONS === 'object')
    ? window.TRAVEL_CAPTIONS
    : {};

  function titleFromSlug(value) {
    return String(value || '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  // Captions are keyed by file name: { folder: { "file.jpg": {caption, author} } }
  // (older generated files used an array in photo order; still understood)
  function photosFromFolder(folder, countryName) {
    const files = Array.isArray(manifest[folder]) ? manifest[folder] : [];
    const captions = captionManifest[folder] || {};
    return files.map((entry, index) => {
      const file = String(entry && entry.src ? entry.src : entry).split('/').pop();
      const meta = Array.isArray(captions)
        ? { caption: captions[index] }
        : (captions[file] || {});
      const captionValue = typeof meta.caption === 'string' ? meta.caption.trim() : '';
      const fallback = `${countryName || titleFromSlug(folder)} photo ${index + 1}`;
      return photo(entry, captionValue || fallback, meta.author);
    });
  }

  // Visited countries and their places: scripts/travel-places.js (written by
  // the travel editor). Each place: { name, region, lat, lng }; `places`
  // keeps just the names, `pins` the places that have coordinates.
  const placeData = (window.TRAVEL_PLACES && typeof window.TRAVEL_PLACES === 'object')
    ? window.TRAVEL_PLACES
    : {};

  const coord = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

  function buildCountry(entry) {
    const name = String((entry && entry.name) || '').trim() || 'Unknown';
    const list = (entry && Array.isArray(entry.places) ? entry.places : [])
      .filter((p) => p && String(p.name || '').trim())
      .map((p) => ({ name: String(p.name).trim(), region: p.region || '', type: p.type || '', lat: coord(p.lat), lng: coord(p.lng) }));
    const folder = (entry && entry.folder) || '';
    return {
      name: name,
      continent: (entry && entry.continent) || '',
      places: list.map((p) => p.name),
      pins: list.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
      folder: folder,
      photos: folder ? photosFromFolder(folder, name) : []
    };
  }

  const countries = {};
  Object.keys(placeData).forEach((id) => {
    countries[Number(id)] = buildCountry(placeData[id]);
  });

  const placePhotos = {};
  const rows = [];

  Object.keys(countries).forEach((id) => {
    const country = countries[id];
    const places = Array.isArray(country.places) ? country.places.slice() : [];
    const photos = Array.isArray(country.photos) ? country.photos.filter(Boolean) : [];

    placePhotos[id] = {};
    places.forEach((place) => {
      placePhotos[id][place] = [];
    });

    if (places.length > 0 && photos.length > 0) {
      photos.forEach((ph, idx) => {
        const place = places[idx % places.length];
        placePhotos[id][place].push(ph);
      });
    }

    places.forEach((place) => {
      const linked = placePhotos[id][place];
      if (!linked.length) {
        rows.push({
          country_id: Number(id),
          country: country.name,
          place: place,
          photo_src: null,
          photo_desc: null
        });
      } else {
        linked.forEach((ph) => {
          rows.push({
            country_id: Number(id),
            country: country.name,
            place: place,
            photo_src: ph.src,
            photo_desc: ph.desc || ''
          });
        });
      }
    });
  });

  window.TRAVEL_DATABASE_COUNTRIES = countries;
  window.TRAVEL_BUILD_COUNTRY = buildCountry;
  window.TRAVEL_AUTHOR_IMAGE = authorImage;
  window.TRAVEL_DEFAULT_AUTHOR = DEFAULT_AUTHOR;
  window.TRAVEL_PLACE_PHOTOS = placePhotos;
  window.TRAVEL_DATABASE_ROWS = rows;
})();
