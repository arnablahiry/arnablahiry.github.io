// Countries and places on the My Travels globe (travels.html).
// Written by the site editor (npm run edit, then Edit on My Travels); fine
// to edit by hand. Keys are ISO 3166-1 numeric country codes; folder is the
// photo folder under images/travels/. A place with lat/lng gets a pin on the
// globe ("type": "region" marks a whole region rather than a city); one
// without is only listed.
window.TRAVEL_PLACES = {
  "40": {
    "name": "Austria", "continent": "Europe", "folder": "austria",
    "places": [
      {"name": "Vienna", "region": "Vienna", "lat": 48.2085, "lng": 16.3721}
    ]
  },
  "56": {
    "name": "Belgium", "continent": "Europe", "folder": "belgium",
    "places": [
      {"name": "Brussels", "region": "Brussels-Capital Region", "lat": 50.8505, "lng": 4.3488},
      {"name": "Ghent", "region": "Flanders", "lat": 51.05, "lng": 3.7167}
    ]
  },
  "203": {
    "name": "Czechia", "continent": "Europe", "folder": "czechia",
    "places": [
      {"name": "Prague", "region": "Praha, Hlavní město", "lat": 50.088, "lng": 14.4208}
    ]
  },
  "250": {
    "name": "France", "continent": "Europe", "folder": "france",
    "places": [
      {"name": "Paris", "region": "Île-de-France", "lat": 48.8534, "lng": 2.3486},
      {"name": "Strasbourg", "region": "Grand-Est", "lat": 48.5839, "lng": 7.7455}
    ]
  },
  "276": {
    "name": "Germany", "continent": "Europe", "folder": "germany",
    "places": [
      {"name": "Heidelberg", "region": "Baden-Württemberg", "lat": 49.4077, "lng": 8.6908},
      {"name": "Jena", "region": "Thuringia", "lat": 50.9288, "lng": 11.5899},
      {"name": "Frankfurt", "region": "Hesse", "lat": 50.1155, "lng": 8.6842}
    ]
  },
  "300": {
    "name": "Greece", "continent": "Europe", "folder": "greece",
    "places": [
      {"name": "Heraklion", "region": "Crete Region", "lat": 35.3279, "lng": 25.1434},
      {"name": "Chania", "region": "Crete Region", "lat": 35.5112, "lng": 24.0292},
      {"name": "Rethymno", "region": "Crete Region", "lat": 35.3656, "lng": 24.4823},
      {"name": "Agios Nikolaos", "region": "Crete Region", "lat": 35.1911, "lng": 25.7152},
      {"name": "Athens", "region": "Attica Region", "lat": 37.9838, "lng": 23.7278},
      {"name": "Thessaloniki", "region": "Central Macedonia", "lat": 40.6436, "lng": 22.9309},
      {"name": "Meteora", "region": "Thessaly", "lat": 39.7217, "lng": 21.6306},
      {"name": "Delphi", "region": "Central Greece Region", "lat": 38.4794, "lng": 22.4936},
      {"name": "Plastiras", "region": "Karditsa Regional Unit", "lat": 39.2386, "lng": 21.7442},
      {"name": "Spárti", "region": "Peloponnese Region", "lat": 37.0745, "lng": 22.4301},
      {"name": "Kastrí", "region": "Crete Region", "lat": 34.8346, "lng": 24.0857},
      {"name": "Arkalochóri", "region": "Crete Region", "lat": 35.1463, "lng": 25.2654}
    ]
  },
  "356": {
    "name": "India", "continent": "Asia", "folder": "india",
    "places": [
      {"name": "Tirupati", "region": "Andhra Pradesh", "lat": 13.6355, "lng": 79.4199},
      {"name": "Kolkata", "region": "West Bengal", "lat": 22.5411, "lng": 88.3378},
      {"name": "Darjeeling", "region": "West Bengal", "lat": 27.0417, "lng": 88.2631},
      {"name": "Guwahati", "region": "Assam", "lat": 26.1844, "lng": 91.7458},
      {"name": "Dibrugarh", "region": "Assam", "lat": 27.5, "lng": 95},
      {"name": "Agra", "region": "Uttar Pradesh", "lat": 27.1833, "lng": 78.0167},
      {"name": "Delhi", "region": "Delhi", "lat": 28.652, "lng": 77.2315},
      {"name": "Pune", "region": "Maharashtra", "lat": 18.5196, "lng": 73.8554},
      {"name": "Mumbai", "region": "Maharashtra", "lat": 19.0728, "lng": 72.8826},
      {"name": "Nagpur", "region": "Maharashtra", "lat": 21.1463, "lng": 79.0849},
      {"name": "Yavatmal", "region": "Maharashtra", "lat": 20.15, "lng": 78.35},
      {"name": "Bhopal", "region": "Madhya Pradesh", "lat": 23.2547, "lng": 77.4029},
      {"name": "Chennai", "region": "Tamil Nadu", "lat": 13.0878, "lng": 80.2785},
      {"name": "Mysuru", "region": "Karnataka", "lat": 12.23, "lng": 76.42},
      {"name": "Bengaluru", "region": "Karnataka", "lat": 12.9719, "lng": 77.5937},
      {"name": "Golaghat", "region": "Assam", "lat": 26.4092, "lng": 93.9119},
      {"name": "Medinipur", "region": "West Bengal", "lat": 22.4333, "lng": 87.3333},
      {"name": "Bhubaneshwar", "region": "Odisha", "lat": 20.2724, "lng": 85.8339},
      {"name": "Puri", "region": "Odisha", "lat": 19.9, "lng": 85.6},
      {"name": "Digha", "region": "West Bengal", "lat": 21.68, "lng": 87.55}
    ]
  },
  "380": {
    "name": "Italy", "continent": "Europe", "folder": "italy",
    "places": [
      {"name": "Venice", "region": "Veneto", "lat": 45.4371, "lng": 12.3326},
      {"name": "Florence", "region": "Tuscany", "lat": 43.7793, "lng": 11.2463},
      {"name": "Catania", "region": "Sicily", "lat": 37.4717, "lng": 14.8473},
      {"name": "Bologna", "region": "Emilia-Romagna", "lat": 44.4667, "lng": 11.4333},
      {"name": "Rome", "region": "Lazio", "lat": 41.8919, "lng": 12.5113}
    ]
  },
  "528": {
    "name": "Netherlands", "continent": "Europe", "folder": "netherlands",
    "places": [
      {"name": "Amsterdam", "region": "North Holland", "lat": 52.374, "lng": 4.8897},
      {"name": "Middelburg", "region": "Zeeland", "lat": 51.5, "lng": 3.6139}
    ]
  },
  "616": {
    "name": "Poland", "continent": "Europe", "folder": "poland",
    "places": [
      {"name": "Krakow", "region": "Lesser Poland Voivodeship", "lat": 50.0726, "lng": 19.9325}
    ]
  },
  "642": {
    "name": "Romania", "continent": "Europe", "folder": "romania",
    "places": [
      {"name": "Turda", "region": "Cluj County", "lat": 46.5667, "lng": 23.7833},
      {"name": "Sibiu", "region": "Sibiu County", "lat": 45.8, "lng": 24.15},
      {"name": "Alba Iulia", "region": "Alba", "lat": 46.0667, "lng": 23.5833},
      {"name": "Sighisoara", "region": "Mureș County", "lat": 46.2169, "lng": 24.7911},
      {"name": "Bucharest", "region": "Bucharest", "lat": 44.4323, "lng": 26.1063}
    ]
  },
  "703": {
    "name": "Slovakia", "continent": "Europe", "folder": "slovakia",
    "places": [
      {"name": "Jasna", "region": "Žilina Region", "lat": 48.9636, "lng": 19.5867},
      {"name": "Bratislava", "region": "Bratislava Region", "lat": 48.1482, "lng": 17.1067}
    ]
  },
  "840": {
    "name": "United States", "continent": "North America", "folder": "united_states",
    "places": [
      {"name": "Chicago", "region": "Illinois", "lat": 41.85, "lng": -87.65},
      {"name": "Indiana Dunes", "region": "Indiana", "lat": 41.6533, "lng": -87.0524}
    ]
  },
  "704": {
    "name": "Vietnam", "continent": "Asia", "folder": "vietnam",
    "places": [
      {"name": "Hanoi", "region": "Hà Nội", "lat": 21.0245, "lng": 105.8412},
      {"name": "Hoi An", "region": "Quảng Nam", "lat": 15.8794, "lng": 108.335},
      {"name": "Da Nang", "region": "Đà Nẵng", "lat": 16.0678, "lng": 108.2208},
      {"name": "Ba Na Hills", "region": "Đà Nẵng", "lat": 15.9951, "lng": 107.9884},
      {"name": "Ninh Binh", "region": "Ninh Bình", "lat": 20.2581, "lng": 105.9797},
      {"name": "Trang An", "region": "Ninh Bình", "lat": 20.2547, "lng": 105.9024}
    ]
  }
};
