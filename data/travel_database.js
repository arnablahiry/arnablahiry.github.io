(function () {
  const photo = (src, desc) => ({ src: src, desc: desc });

  const countries = {
    356: {
      name: 'India',
      continent: 'Asia',
      places: ['Too many to list here hahaha'],
      photos: [
        photo('images/travels/india/india_1.png', 'Taj Mahal, Agra'),
        photo('images/travels/india/india_2.png', 'Himalayan peaks, Uttarakhand'),
        photo('images/travels/india/india_3.png', 'Cloudy valley, Shillong, Meghalaya'),
        photo('images/travels/india/india_4.png', 'India photo 4'),
        photo('images/travels/india/india_5.png', 'India photo 5'),
        photo('images/travels/india/india_6.png', 'India photo 6')
      ]
    },
    250: { name: 'France', continent: 'Europe', places: ['Paris', 'Strasbourg'], photos: [null, null] },
    276: { name: 'Germany', continent: 'Europe', places: ['Heidelberg', 'Jena', 'Frankfurt'], photos: [null, null, null] },
    616: { name: 'Poland', continent: 'Europe', places: ['Krakow'], photos: [null] },
    703: { name: 'Slovakia', continent: 'Europe', places: ['Jasna', 'Bratislava'], photos: [null, null] },
    203: { name: 'Czechia', continent: 'Europe', places: ['Prague'], photos: [null] },
    380: {
      name: 'Italy',
      continent: 'Europe',
      places: ['Venice', 'Florence', 'Catania', 'Bologna'],
      photos: [
        photo('images/travels/italy/italy_1.png', 'Italy photo 1'),
        photo('images/travels/italy/italy_2.png', 'Italy photo 2'),
        photo('images/travels/italy/italy_3.png', 'Italy photo 3'),
        photo('images/travels/italy/italy_4.png', 'Italy photo 4'),
        photo('images/travels/italy/italy_5.png', 'Italy photo 5'),
        photo('images/travels/italy/italy_6.png', 'Italy photo 6'),
        photo('images/travels/italy/italy_7.png', 'Italy photo 7'),
        photo('images/travels/italy/italy_8.png', 'Italy photo 8'),
        photo('images/travels/italy/italy_9.png', 'Italy photo 9')
      ]
    },
    300: {
      name: 'Greece',
      continent: 'Europe',
      places: ['Heraklion', 'Chania', 'Rethymno', 'Agios Nikolaos', 'Athens', 'Thessaloniki', 'Meteora', 'Delphi', 'Plastiras'],
      photos: [
        photo('images/travels/greece/greece_1.png', 'Greece photo 1'),
        photo('images/travels/greece/greece_2.png', 'Greece photo 2'),
        photo('images/travels/greece/greece_3.png', 'Greece photo 3'),
        photo('images/travels/greece/greece_4.png', 'Greece photo 4'),
        photo('images/travels/greece/greece_5.png', 'Greece photo 5'),
        photo('images/travels/greece/greece_6.png', 'Greece photo 6')
      ]
    },
    528: { name: 'Netherlands', continent: 'Europe', places: ['Amsterdam', 'Middelburg'], photos: [null, null] },
    56: { name: 'Belgium', continent: 'Europe', places: ['Brussels', 'Ghent'], photos: [null, null] },
    40: { name: 'Austria', continent: 'Europe', places: ['Vienna'], photos: [null] },
    704: {
      name: 'Vietnam',
      continent: 'Asia',
      places: ['Hanoi', 'Hoi An', 'Da Nang', 'Ba Na Hills', 'Ninh Binh', 'Trang An'],
      photos: [
        photo('images/travels/vietnam/vietnam_1.png', 'Vietnam photo 1'),
        photo('images/travels/vietnam/vietnam_2.png', 'Vietnam photo 2'),
        photo('images/travels/vietnam/vietnam_3.png', 'Vietnam photo 3'),
        photo('images/travels/vietnam/vietnam_4.png', 'Vietnam photo 4'),
        photo('images/travels/vietnam/vietnam_5.png', 'Vietnam photo 5'),
        photo('images/travels/vietnam/vietnam_6.png', 'Vietnam photo 6'),
        photo('images/travels/vietnam/vietnam_7.png', 'Vietnam photo 7'),
        photo('images/travels/vietnam/vietnam_8.png', 'Vietnam photo 8'),
        photo('images/travels/vietnam/vietnam_9.png', 'Vietnam photo 9')
      ]
    },
    840: {
      name: 'United States',
      continent: 'North America',
      places: ['Chicago', 'Indiana Dunes'],
      photos: [
        photo('images/travels/united_states/united_states_1.png', 'United States photo 1'),
        photo('images/travels/united_states/united_states_2.png', 'United States photo 2'),
        photo('images/travels/united_states/united_states_3.png', 'United States photo 3'),
        photo('images/travels/united_states/united_states_4.png', 'United States photo 4'),
        photo('images/travels/united_states/united_states_5.png', 'United States photo 5'),
        photo('images/travels/united_states/united_states_6.png', 'United States photo 6')
      ]
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
