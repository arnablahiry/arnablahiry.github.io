(function () {
  const photo = (entry, desc) => {
    if (entry && typeof entry === 'object') {
      return {
        src: entry.src,
        thumbSrc: entry.thumbSrc || entry.src,
        desc: desc || entry.desc || entry.caption || ''
      };
    }
    return { src: entry, thumbSrc: entry, desc: desc };
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

  function photosFromFolder(folder, countryName) {
    const files = Array.isArray(manifest[folder]) ? manifest[folder] : [];
    const captions = Array.isArray(captionManifest[folder]) ? captionManifest[folder] : [];
    return files.map((entry, index) => {
      const hasCaption = typeof captions[index] === 'string';
      const fallback = `${countryName || titleFromSlug(folder)} photo ${index + 1}`;
      return photo(entry, hasCaption ? captions[index] : fallback);
    });
  }

  const countries = {
    356: {
      name: 'India',
      continent: 'Asia',
      places: ['Too many to list here hahaha'],
      photos: photosFromFolder('india', 'India')
    },
    250: { name: 'France', continent: 'Europe', places: ['Paris', 'Strasbourg'], photos: photosFromFolder('france', 'France') },
    276: { name: 'Germany', continent: 'Europe', places: ['Heidelberg', 'Jena', 'Frankfurt'], photos: photosFromFolder('germany', 'Germany') },
    616: { name: 'Poland', continent: 'Europe', places: ['Krakow'], photos: photosFromFolder('poland', 'Poland') },
    703: { name: 'Slovakia', continent: 'Europe', places: ['Jasna', 'Bratislava'], photos: photosFromFolder('slovakia', 'Slovakia') },
    203: { name: 'Czechia', continent: 'Europe', places: ['Prague'], photos: photosFromFolder('czechia', 'Czechia') },
    380: {
      name: 'Italy',
      continent: 'Europe',
      places: ['Venice', 'Florence', 'Catania', 'Bologna'],
      photos: photosFromFolder('italy', 'Italy')
    },
    300: {
      name: 'Greece',
      continent: 'Europe',
      places: ['Heraklion', 'Chania', 'Rethymno', 'Agios Nikolaos', 'Athens', 'Thessaloniki', 'Meteora', 'Delphi', 'Plastiras'],
      photos: photosFromFolder('greece', 'Greece')
    },
    528: { name: 'Netherlands', continent: 'Europe', places: ['Amsterdam', 'Middelburg'], photos: photosFromFolder('netherlands', 'Netherlands') },
    56: { name: 'Belgium', continent: 'Europe', places: ['Brussels', 'Ghent'], photos: photosFromFolder('belgium', 'Belgium') },
    40: { name: 'Austria', continent: 'Europe', places: ['Vienna'], photos: photosFromFolder('austria', 'Austria') },
    642: { name: 'Romania', continent: 'Europe', places: ['Turda', 'Sibiu', 'Alba Iulia', 'Sighisoara', 'Bucharest'],
      photos: photosFromFolder('romania', 'Romania')
    },
    704: {
      name: 'Vietnam',
      continent: 'Asia',
      places: ['Hanoi', 'Hoi An', 'Da Nang', 'Ba Na Hills', 'Ninh Binh', 'Trang An'],
      photos: photosFromFolder('vietnam', 'Vietnam')
    },
    840: {
      name: 'United States',
      continent: 'North America',
      places: ['Chicago', 'Indiana Dunes'],
      photos: photosFromFolder('united_states', 'United States')
    }
  };

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
  window.TRAVEL_PLACE_PHOTOS = placePhotos;
  window.TRAVEL_DATABASE_ROWS = rows;
})();
