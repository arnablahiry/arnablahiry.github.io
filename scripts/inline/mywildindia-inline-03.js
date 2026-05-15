    const PHOTO_POOL = [
      { src: 'images/travels/india/india_1.png', caption: 'Travel frame 1 across India.' },
      { src: 'images/travels/india/india_2.png', caption: 'Travel frame 2 across India.' },
      { src: 'images/travels/india/india_3.png', caption: 'Travel frame 3 across India.' },
      { src: 'images/about/photo1.png', caption: 'Memory frame 1 from the archives.' },
      { src: 'images/about/photo2.png', caption: 'Memory frame 2 from the archives.' },
      { src: 'images/about/photo3.png', caption: 'Memory frame 3 from the archives.' },
      { src: 'images/about/photo4.png', caption: 'Memory frame 4 from the archives.' },
      { src: 'images/about/photo5.png', caption: 'Memory frame 5 from the archives.' },
      { src: 'images/about/photo6.png', caption: 'Memory frame 6 from the archives.' }
    ];

    const WILD_CAPTION_TEMPLATES = [
      'Floodplain light and layered habitat patterns',
      'A quiet field moment in changing weather',
      'Movement, texture, and distance in one frame',
      'Edge habitat where forest and water meet',
      'A still composition with active wildlife signs',
      'Low-angle scene across grass and river systems',
      'Canopy detail and shadowed understory depth',
      'A migratory-season mood with open visibility',
      'Late-hour color and strong natural contrast'
    ];

    const NOT_WILD_CAPTION_TEMPLATES = [
      'Street life and architecture in soft light',
      'A travel pause with strong local character',
      'Urban rhythm framed through texture and color',
      'City edges, movement, and layered perspective',
      'A memory frame from the day’s route',
      'A quiet corner with everyday detail',
      'Skyline, streetscape, and place identity',
      'Transit moment caught between destinations',
      'People, place, and pace in one view'
    ];

    const MYWILDINDIA_PHOTO_MANIFEST = window.MYWILDINDIA_PHOTO_MANIFEST || {};
    const MYWILDINDIA_CAPTIONS = window.MYWILDINDIA_CAPTIONS || {};
    const NON_WILD_CREDITS = ['Pralay', 'Arnab', 'Mohua', 'Teesta'];
    const NON_WILD_CREDIT_IMAGES = {
      Pralay: 'images/mywildindia/credits/pralay.svg',
      Arnab: 'images/mywildindia/credits/arnab.svg',
      Mohua: 'images/mywildindia/credits/mohua.svg',
      Teesta: 'images/mywildindia/credits/teesta.svg'
    };

    const PHOTO_FOLDER_ALIASES = {
      'manas national park': 'manas',
      'dibru-saikhowa national park': 'dibru',
      'tadoba-andhari tiger reserve': 'tadoba',
      'darya bugyal': 'bugyal',
      'jabalpur': 'jabalpur'
    };

    function slugifyFolderKey(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    function resolvePhotoFolder(place) {
      const rawName = String(place && place.place ? place.place : '').toLowerCase();
      return PHOTO_FOLDER_ALIASES[rawName] || slugifyFolderKey(place && place.place);
    }

    function authorImageFor(author) {
      return NON_WILD_CREDIT_IMAGES[author] || NON_WILD_CREDIT_IMAGES.Pralay;
    }

    function captionEntryFor(folderKey, src) {
      const folderCaptions = MYWILDINDIA_CAPTIONS[folderKey] || {};
      const fileName = src ? String(src).split('/').pop() : '';
      return folderCaptions[fileName] || folderCaptions[src] || null;
    }

    const WILD_PLACES = [
      {
        state: 'Assam',
        place: 'Kaziranga National Park',
        coords: [93.1711, 26.5775],
        description: 'Kaziranga is a <strong>UNESCO World Heritage Site</strong> in Assam on the Brahmaputra floodplains. It is globally known for strong conservation success of the greater <strong>one-horned rhinoceros</strong>. Its mosaic of grasslands, wetlands, and woodlands supports elephants, tigers, and rich birdlife.',
        photos: PHOTO_POOL
      },
      {
        state: 'Assam',
        place: 'Pobitora Wildlife Sanctuary',
        coords: [92.0300, 26.2300],
        description: 'Pobitora Wildlife Sanctuary is a compact protected area east of Guwahati. It is well known for one of the <strong>highest rhino densities</strong> in India. Wet grasslands and beels here also support <strong>migratory waterbirds</strong> and reptiles.',
        photos: PHOTO_POOL
      },
      {
        state: 'Assam',
        place: 'Orang National Park',
        coords: [92.2660, 26.4830],
        description: 'Orang National Park sits on the north bank of the Brahmaputra in Assam. The park protects floodplain grasslands and wetlands with rhino, tiger, and elephant habitat. Its riverine landscape makes it an important <strong>bird area</strong> in Northeast India.',
        photos: PHOTO_POOL
      },
      {
        state: 'Assam',
        place: 'Manas National Park',
        coords: [91.0000, 26.7330],
        description: 'Manas National Park is a transboundary protected landscape along the Bhutan border. It holds multiple global designations, including <strong>UNESCO World Heritage</strong> and <strong>Tiger Reserve</strong> status. Alluvial grasslands and Himalayan foothill forests here shelter rare species like pygmy hog and golden langur.',
        photos: [
          { src: 'images/mywildindia/manas/manas_1.png', caption: 'Grassland edge habitat in Manas.' },
          { src: 'images/mywildindia/manas/manas_2.png', caption: 'Foothill forest mood in Manas.' }
        ]
      },
      {
        state: 'Assam',
        place: 'Dibru-Saikhowa National Park',
        coords: [95.3500, 27.7500],
        description: 'Dibru-Saikhowa National Park is a river-island protected area formed by the Brahmaputra and Lohit systems. It is known for swamp forests, grasslands, and dynamic channels that reshape habitat each season. The park is notable for feral horses and a high diversity of resident and <strong>migratory birds</strong>.',
        photos: [
          { src: 'images/mywildindia/dibru/dibru_1.png', caption: 'River-island scene from Dibru-Saikhowa.' },
          { src: 'images/mywildindia/dibru/dibru_2.png', caption: 'Wetland texture in Dibru-Saikhowa.' }
        ]
      },
      {
        state: 'West Bengal',
        place: 'Sunderbans National Park',
        coords: [88.8850, 21.9497],
        description: 'Sundarbans National Park protects India\'s largest <strong>mangrove delta</strong> at the Ganga-Brahmaputra mouth. It is a <strong>UNESCO World Heritage Site</strong> and part of the wider tiger reserve landscape. Tidal creeks and mudflats support estuarine crocodiles, fishing cats, and adapted mangrove wildlife.',
        photos: PHOTO_POOL
      },
      {
        state: 'Madhya Pradesh',
        place: 'Pench Tiger Reserve',
        coords: [79.3000, 21.8000],
        description: 'Pench Tiger Reserve spans central Indian dry deciduous forests across Madhya Pradesh and Maharashtra. The reserve is named after the Pench River, which structures its habitats and wildlife movement. Teak forests and open meadows support tigers, leopards, wild dogs, and large herbivore populations.',
        photos: PHOTO_POOL
      },
      {
        state: 'Maharashtra',
        place: 'Tadoba-Andhari Tiger Reserve',
        coords: [79.3500, 20.2500],
        description: 'Tadoba-Andhari Tiger Reserve is Maharashtra\'s oldest and one of its best-known tiger reserves. It combines dry deciduous forest, bamboo brakes, and lake-edge habitats in the Vidarbha landscape. The reserve has a strong prey base and is widely recognized for frequent tiger sightings.',
        photos: [
          { src: 'images/mywildindia/tadoba/tadoba_1.png', caption: 'Dry deciduous light in Tadoba.' },
          { src: 'images/mywildindia/tadoba/tadoba_2.png', caption: 'Forest track moment from Tadoba.' }
        ]
      },
      {
        state: 'Rajasthan',
        place: 'Bharatpur Bird Sanctuary',
        coords: [77.5210, 27.1590],
        description: 'Bharatpur Bird Sanctuary refers to the Keoladeo wetland complex in Rajasthan. This managed wetland is a <strong>UNESCO World Heritage Site</strong> famed for seasonal waterfowl concentrations. Its shallow marshes, grass patches, and woodland edges host hundreds of resident and migratory bird species.',
        photos: PHOTO_POOL
      },
      {
        state: 'Odisha',
        place: 'Monglajodi Wetlands',
        coords: [85.5000, 19.9200],
        description: 'Mangalajodi Wetlands sit on the northern edge of Chilika Lake in Odisha. The site is known for community-led protection that transformed former hunting grounds into a birding hotspot. Winter months bring large numbers of migratory ducks, waders, and marsh birds.',
        photos: PHOTO_POOL
      },
      {
        state: 'Madhya Pradesh',
        place: 'Kanha Tiger Reserve',
        coords: [80.6115, 22.3344],
        description: 'Kanha Tiger Reserve is one of India\'s flagship protected areas in the Maikal landscape. It combines sal forests with open meadows that support barasingha, gaur, and tiger populations. Long-term management here is often cited in successful hard-ground barasingha recovery.',
        photos: PHOTO_POOL
      },
      {
        state: 'Rajasthan',
        place: 'Keoladeo National Park',
        coords: [77.5210, 27.1590],
        description: 'Keoladeo National Park is a Ramsar wetland and <strong>UNESCO World Heritage Site</strong> at Bharatpur. Its hydrology is managed through canals and sluices to maintain productive marsh habitat. The park is internationally important for migratory waterbirds along the Central Asian Flyway.',
        photos: PHOTO_POOL
      },
      {
        state: 'Sikkim',
        place: 'Okhrey, West Sikkim',
        coords: [88.2400, 27.2300],
        description: 'Okhrey is a high-elevation settlement in West Sikkim near the Varsey landscape. The region is known for montane forests, rhododendron diversity, and seasonal alpine flora. It serves as a gateway to trekking routes with sweeping Himalayan viewpoints.',
        photos: PHOTO_POOL
      },
      {
        state: 'Assam',
        place: 'Hoollongapar Gibbon Wildlife Sanctuary',
        coords: [94.3300, 26.7000],
        description: 'Hoollongapar Gibbon Wildlife Sanctuary protects an evergreen forest fragment in upper Assam. It is best known as a stronghold of India\'s only ape, the western hoolock gibbon. The canopy also supports stump-tailed macaque, capped langur, and other primates and forest birds.',
        photos: PHOTO_POOL
      },
      {
        state: 'Assam',
        place: 'Kakaijana Reserved Forest',
        coords: [90.5600, 26.4600],
        description: 'Kakaijana Reserved Forest lies in western Assam near the Manas-influenced foothill belt. It is an important habitat patch for the endangered <strong>golden langur</strong> population. Semi-evergreen and moist deciduous vegetation here supports regional bird and primate diversity.',
        photos: PHOTO_POOL
      },
      {
        state: 'Assam',
        place: 'Nameri Tiger Reserve',
        coords: [92.7830, 26.9400],
        description: 'Nameri Tiger Reserve sits in Assam\'s Himalayan foothills along the Jia-Bhoroli River. It links ecologically with Pakke in Arunachal Pradesh, forming a wider elephant and tiger landscape. Riverine forests, grass patches, and boulder-strewn channels support hornbills, mahseer, and carnivores.',
        photos: PHOTO_POOL
      },
      {
        state: 'West Bengal',
        place: 'Buxa Tiger Reserve',
        coords: [89.5800, 26.7600],
        description: 'Buxa Tiger Reserve lies in the Duars of northern West Bengal at the Bhutan foothills. It includes forests, river valleys, and uplands that function as major wildlife corridors. The reserve is recognized for high butterfly and bird diversity along with elephants and large carnivores.',
        photos: PHOTO_POOL
      }
    ];

    const NOT_WILD_PLACES = [
      {
        state: 'Uttar Pradesh',
        place: 'Benaras',
        coords: [82.9739, 25.3176],
        description: 'Varanasi (Benaras) is one of the world\'s oldest continuously inhabited cities on the Ganga. Its ghats host daily religious rituals, cremation grounds, and boat traffic from dawn to night. The city is also a major center for classical music, silk weaving, and Sanskrit learning.',
        photos: PHOTO_POOL
      },
      {
        state: 'Meghalaya',
        place: 'Shillong',
        coords: [91.8933, 25.5788],
        description: 'Shillong is the hill capital of Meghalaya on a high-rainfall plateau. It is known for pine-covered slopes, colonial-era institutions, and a vibrant live-music scene. Nearby waterfalls and viewpoints make it a key gateway to Khasi and Jaintia landscapes.',
        photos: PHOTO_POOL
      },
      {
        state: 'Andhra Pradesh',
        place: 'Tirupati',
        coords: [79.4192, 13.6288],
        description: 'Tirupati is a major pilgrimage city at the foothills of the Seshachalam range. It serves as the base for the Tirumala temple complex, among the most visited in the world. The surrounding hills are part of a biodiversity-rich Eastern Ghats belt.',
        photos: PHOTO_POOL
      },
      {
        state: 'Karnataka',
        place: 'Bangalore',
        coords: [77.5946, 12.9716],
        description: 'Bengaluru is Karnataka\'s capital on the Deccan Plateau at about 900 meters elevation. It grew from a cantonment and garden city into India\'s leading technology and startup hub. The city still retains large parks, lakes, and granite outcrops across its urban fabric.',
        photos: PHOTO_POOL
      },
      {
        state: 'Delhi',
        place: 'Delhi',
        coords: [77.2090, 28.6139],
        description: 'Delhi is India\'s national capital territory on the Yamuna floodplain. It layers multiple historic cities, from Sultanate and Mughal centers to New Delhi\'s planned avenues. Today it is a major political, cultural, and transport hub for North India.',
        photos: PHOTO_POOL
      },
      {
        state: 'Uttar Pradesh',
        place: 'Agra',
        coords: [78.0081, 27.1767],
        description: 'Agra was a major Mughal capital and remains one of India\'s most visited heritage cities. It is home to the Taj Mahal, Agra Fort, and other UNESCO-recognized monuments. The city sits on the Yamuna and still reflects strong craft traditions in stone and inlay work.',
        photos: PHOTO_POOL
      },
      {
        state: 'Tamil Nadu',
        place: 'Chennai',
        coords: [80.2707, 13.0827],
        description: 'Chennai is Tamil Nadu\'s capital on the Coromandel Coast of the Bay of Bengal. It is a major port city with deep roots in South Indian classical arts and modern industry. Its long shoreline, wetlands, and urban estuaries shape both ecology and city life.',
        photos: PHOTO_POOL
      },
      {
        state: 'Maharashtra',
        place: 'Yavatmal',
        coords: [78.1328, 20.3899],
        description: 'Yavatmal is a district headquarters in Maharashtra\'s Vidarbha region. The area is dominated by cotton-growing landscapes and dry deciduous ecological zones. It lies within a wider central Indian belt connected to forest and tiger reserve geographies.',
        photos: PHOTO_POOL
      },
      {
        state: 'Uttarakhand',
        place: 'Darya Bugyal',
        coords: [79.6500, 30.4700],
        description: 'Darya Bugyal is an alpine meadow zone in the Garhwal Himalaya of Uttarakhand. Like other bugyals, it opens seasonally with high-altitude grasslands and expansive mountain views. The surrounding terrain supports trekking routes and traditional transhumance use.',
        photos: [
          { src: 'images/mywildindia/bugyal/bugyal_1.jpeg', caption: 'Bugyal ridge view 1.' },
          { src: 'images/mywildindia/bugyal/bugyal_2.jpeg', caption: 'Bugyal ridge view 2.' },
          { src: 'images/mywildindia/bugyal/bugyal_3.jpeg', caption: 'Bugyal ridge view 3.' },
          { src: 'images/mywildindia/bugyal/bugyal_4.jpeg', caption: 'Bugyal ridge view 4.' },
          { src: 'images/mywildindia/bugyal/bugyal_5.jpeg', caption: 'Bugyal ridge view 5.' },
          { src: 'images/mywildindia/bugyal/bugyal_6.jpeg', caption: 'Bugyal ridge view 6.' },
          { src: 'images/mywildindia/bugyal/bugyal_7.jpeg', caption: 'Bugyal ridge view 7.' },
          { src: 'images/mywildindia/bugyal/bugyal_8.jpeg', caption: 'Bugyal ridge view 8.' },
          { src: 'images/mywildindia/bugyal/bugyal_9.jpeg', caption: 'Bugyal ridge view 9.' }
        ]
      },
      {
        state: 'Uttarakhand',
        place: 'Dehradun',
        coords: [78.0322, 30.3165],
        description: 'Dehradun is Uttarakhand\'s capital in the Doon Valley between the Ganga and Yamuna rivers. It sits between the Shivalik hills and the Lesser Himalaya, creating a distinct foothill setting. The city is known for research institutions, schools, and access to hill destinations.',
        photos: PHOTO_POOL
      },
      {
        state: 'Uttarakhand',
        place: 'Rishikesh',
        coords: [78.2676, 30.0869],
        description: 'Rishikesh lies on the Ganga where the river exits the Himalaya into the plains. It is globally known for yoga centers, ashrams, and riverfront spiritual culture. It also serves as a gateway for rafting and mountain travel toward Garhwal.',
        photos: PHOTO_POOL
      },
      {
        state: 'Karnataka',
        place: 'Mysore',
        coords: [76.6394, 12.2958],
        description: 'Mysuru (Mysore) is a heritage city in southern Karnataka with a historic royal legacy. The Mysore Palace and Dasara festival are central to its cultural identity and tourism. Its location near the Nilgiri foothills links it to forested and wildlife-rich landscapes.',
        photos: PHOTO_POOL
      },
      {
        state: 'Madhya Pradesh',
        place: 'Bhopal',
        coords: [77.4126, 23.2599],
        description: 'Bhopal is the capital of Madhya Pradesh and is often called the City of Lakes. Its old and new urban cores reflect princely-era architecture and modern administrative growth. The city anchors central Indian travel routes toward forests, plateaus, and heritage sites.',
        photos: PHOTO_POOL
      },
      {
        state: 'Madhya Pradesh',
        place: 'Jabalpur',
        coords: [79.9864, 23.1815],
        description: 'Jabalpur is a major city on the Narmada in central India. It is associated with the Marble Rocks gorge at Bhedaghat and nearby Dhuandhar Falls. The region links riverine scenery with access to central Indian forest landscapes.',
        photos: [
          { src: 'images/mywildindia/jabalpur/jabalpur_1.jpeg', caption: 'Marble Rocks and river light 1.' },
          { src: 'images/mywildindia/jabalpur/jabalpur_2.jpeg', caption: 'Marble Rocks and river light 2.' },
          { src: 'images/mywildindia/jabalpur/jabalpur_3.jpeg', caption: 'Marble Rocks and river light 3.' },
          { src: 'images/mywildindia/jabalpur/jabalpur_4.jpeg', caption: 'Marble Rocks and river light 4.' },
          { src: 'images/mywildindia/jabalpur/jabalpur_5.jpeg', caption: 'Marble Rocks and river light 5.' },
          { src: 'images/mywildindia/jabalpur/jabalpur_6.jpeg', caption: 'Marble Rocks and river light 6.' }
        ]
      },
      {
        state: 'Maharashtra',
        place: 'Nagpur',
        coords: [79.0882, 21.1458],
        description: 'Nagpur is a major city in Vidarbha and a key logistics hub of central India. Historically known as an orange-growing region, it lies near multiple tiger-reserve landscapes. Its central location has made it important for transport, governance, and regional trade.',
        photos: PHOTO_POOL
      },
      {
        state: 'Telangana',
        place: 'Hyderabad',
        coords: [78.4867, 17.3850],
        description: 'Hyderabad is Telangana\'s capital on the Deccan Plateau. Founded by the Qutb Shahi rulers, it blends historic monuments with a major modern tech economy. Rocky granitic terrain and urban lakes remain defining features of its geography.',
        photos: PHOTO_POOL
      },
      {
        state: 'Maharashtra',
        place: 'Pune',
        coords: [73.8567, 18.5204],
        description: 'Pune is a major Deccan city west of Mumbai with strong educational and military institutions. It expanded from a Maratha-era center into a major manufacturing and IT corridor. Its position near the Western Ghats gives quick access to forts, valleys, and monsoon landscapes.',
        photos: PHOTO_POOL
      },
      {
        state: 'Maharashtra',
        place: 'Mumbai',
        coords: [72.8777, 19.0760],
        description: 'Mumbai is Maharashtra\'s capital and India\'s largest financial and film-industry center. Built across reclaimed islands, it fronts a natural harbor on the Arabian Sea. Its urban coastline, mangroves, and creeks create a distinctive maritime city ecology.',
        photos: PHOTO_POOL
      }
    ];

    const STATE_ALIASES = {
      'nct of delhi': 'Delhi',
      'orissa': 'Odisha',
      'uttaranchal': 'Uttarakhand',
      'pondicherry': 'Puducherry',
      'andaman and nicobar': 'Andaman and Nicobar Islands'
    };

    const STATE_CAPITALS = {
      andhrapradesh: { name: 'Amaravati', coords: [80.5150, 16.5417], description: 'Planned riverfront capital region on the Krishna basin.', photos: PHOTO_POOL },
      arunachalpradesh: { name: 'Itanagar', coords: [93.6053, 27.0844], description: 'Hill capital gateway to Eastern Himalayan ecosystems.', photos: PHOTO_POOL },
      assam: { name: 'Dispur (Guwahati)', coords: [91.7868, 26.1445], description: 'Capital district area within Guwahati, a major gateway city to Northeast India.', photos: PHOTO_POOL },
      bihar: { name: 'Patna', coords: [85.1376, 25.5941], description: 'Historic Ganga plains capital with dense urban core.', photos: PHOTO_POOL },
      chhattisgarh: { name: 'Raipur', coords: [81.6296, 21.2514], description: 'Central Indian capital connecting forested interior regions.', photos: PHOTO_POOL },
      goa: { name: 'Panaji', coords: [73.8278, 15.4909], description: 'Coastal capital with estuaries, mangroves, and heritage quarters.', photos: PHOTO_POOL },
      gujarat: { name: 'Gandhinagar', coords: [72.6369, 23.2156], description: 'Planned capital near the Sabarmati river corridor.', photos: PHOTO_POOL },
      haryana: { name: 'Chandigarh', coords: [76.7794, 30.7333], description: 'Shared planned capital for Haryana and Punjab.', photos: PHOTO_POOL },
      himachalpradesh: { name: 'Shimla', coords: [77.1734, 31.1048], description: 'Mountain capital along mid-Himalayan ridges.', photos: PHOTO_POOL },
      jharkhand: { name: 'Ranchi', coords: [85.3096, 23.3441], description: 'Plateau capital surrounded by forested uplands.', photos: PHOTO_POOL },
      karnataka: { name: 'Bengaluru', coords: [77.5946, 12.9716], description: 'High-elevation metropolis on the Deccan plateau.', photos: PHOTO_POOL },
      kerala: { name: 'Thiruvananthapuram', coords: [76.9366, 8.5241], description: 'Coastal capital between Western Ghats and Arabian Sea.', photos: PHOTO_POOL },
      madhyapradesh: { name: 'Bhopal', coords: [77.4126, 23.2599], description: 'City of lakes and central administrative hub with strong links to surrounding forest regions.', photos: PHOTO_POOL },
      maharashtra: { name: 'Mumbai', coords: [72.8777, 19.0760], description: 'Coastal financial capital with dense urban core, ports, and extensive cultural industries.', photos: PHOTO_POOL },
      manipur: { name: 'Imphal', coords: [93.9368, 24.8170], description: 'Valley capital ringed by biodiverse hill systems.', photos: PHOTO_POOL },
      meghalaya: { name: 'Shillong', coords: [91.8933, 25.5788], description: 'High-rainfall plateau capital with cloud forest zones nearby.', photos: PHOTO_POOL },
      mizoram: { name: 'Aizawl', coords: [92.7176, 23.7271], description: 'Ridge-top capital in a steep, forest-rich landscape.', photos: PHOTO_POOL },
      nagaland: { name: 'Kohima', coords: [94.1086, 25.6751], description: 'Highland capital amid Naga hill ecosystems.', photos: PHOTO_POOL },
      odisha: { name: 'Bhubaneswar', coords: [85.8245, 20.2961], description: 'Temple city and administrative capital near major wetland and coastal ecosystems.', photos: PHOTO_POOL },
      punjab: { name: 'Chandigarh', coords: [76.7794, 30.7333], description: 'Shared planned capital for Punjab and Haryana.', photos: PHOTO_POOL },
      rajasthan: { name: 'Jaipur', coords: [75.7873, 26.9124], description: 'Historic planned capital known for pink facades, forts, and strong regional craft traditions.', photos: PHOTO_POOL },
      sikkim: { name: 'Gangtok', coords: [88.6065, 27.3389], description: 'Mountain capital with steep terrain, Himalayan vistas, and access to high-altitude habitats.', photos: PHOTO_POOL },
      tamilnadu: { name: 'Chennai', coords: [80.2707, 13.0827], description: 'Major coastal capital on the Coromandel shore.', photos: PHOTO_POOL },
      telangana: { name: 'Hyderabad', coords: [78.4867, 17.3850], description: 'Deccan capital with major urban wetlands and rocky outcrops.', photos: PHOTO_POOL },
      tripura: { name: 'Agartala', coords: [91.2868, 23.8315], description: 'Lowland capital close to hill and wetland mosaics.', photos: PHOTO_POOL },
      uttarpradesh: { name: 'Lucknow', coords: [80.9462, 26.8467], description: 'Large Gangetic plain capital and administrative center.', photos: PHOTO_POOL },
      uttarakhand: { name: 'Dehradun', coords: [78.0322, 30.3165], description: 'Foothill capital between Himalayan and plains bioregions.', photos: PHOTO_POOL },
      westbengal: { name: 'Kolkata', coords: [88.3639, 22.5726], description: 'Riverside metropolis known for colonial-era architecture, literature, and dense cultural life.', photos: PHOTO_POOL },
      delhi: { name: 'New Delhi', coords: [77.2090, 28.6139], description: 'National capital territory on the Yamuna floodplain.', photos: PHOTO_POOL },
      andamanandnicobarislands: { name: 'Port Blair', coords: [92.7265, 11.6234], description: 'Island UT capital in the Andaman archipelago.', photos: PHOTO_POOL },
      chandigarh: { name: 'Chandigarh', coords: [76.7794, 30.7333], description: 'Union Territory city and shared state capital.', photos: PHOTO_POOL },
      dadraandnagarhavelianddamananddiu: { name: 'Daman', coords: [72.8328, 20.3974], description: 'UT administrative center on India’s west coast.', photos: PHOTO_POOL },
      jammuandkashmir: { name: 'Srinagar / Jammu', coords: [74.7973, 34.0837], description: 'Seasonal dual-capital arrangement in the Himalayan region.', photos: PHOTO_POOL },
      ladakh: { name: 'Leh', coords: [77.5830, 34.1526], description: 'High-altitude UT capital in trans-Himalayan cold desert.', photos: PHOTO_POOL },
      lakshadweep: { name: 'Kavaratti', coords: [72.6420, 10.5667], description: 'Coral island UT capital in the Arabian Sea.', photos: PHOTO_POOL },
      puducherry: { name: 'Puducherry', coords: [79.8083, 11.9416], description: 'Coastal UT capital with enclave-based territories.', photos: PHOTO_POOL }
    };

    const GEOJSON_URLS = [
      'https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@main/geojson/india.geojson',
      'https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/india.geojson'
    ];

    const mapEl = d3.select('#india-map');
    const stateLayer = mapEl.append('g').attr('class', 'state-layer');
    const highlightLayer = mapEl.append('g').attr('class', 'highlight-layer');
    const markerLayer = mapEl.append('g').attr('class', 'marker-layer');
    const capitalLayer = mapEl.append('g').attr('class', 'capital-layer');
    const width = 800;
    const height = 800;

    const projection = d3.geoMercator();
    const path = d3.geoPath(projection);
    const normalize = (v) => (v || '').toLowerCase().replace(/[^a-z]/g, '');

    const panel = document.getElementById('place-panel');
    const placeTitle = document.getElementById('place-title');
    const placeDescription = document.getElementById('place-description');
    const placePhotos = document.getElementById('place-photos');
    const lightboxEl = document.getElementById('photo-lightbox');
    const lightboxImgEl = document.getElementById('lightbox-image');
    const lightboxCaptionEl = document.getElementById('lightbox-caption');
    const lightboxCreditImageEl = document.getElementById('lightbox-credit-image');
    const lightboxCreditNameEl = document.getElementById('lightbox-credit-name');
    const lightboxCloseEl = document.getElementById('lightbox-close');
    const lightboxNextEl = document.getElementById('lightbox-next');
    const toggleWildEl = document.getElementById('toggle-wild');
    const toggleNotWildEl = document.getElementById('toggle-notwild');
    const mapPanelEl = document.querySelector('.map-panel');
    const tooltipEl = document.getElementById('map-tooltip');
    const highlightPath = highlightLayer.append('path').attr('class', 'state-highlight');

    let currentFeatures = [];
    let activeFeature = null;
    let hoverFeature = null;
    let activePlaceKey = null;
    const viewState = { tx: 0, ty: 0, scale: 1 };
    let wheelReleaseTimer = null;
    let showWildMarkers = true;
    let showNotWildMarkers = false;
    let lightboxPhotos = [];
    let lightboxIndex = 0;

    function applyViewTransform(duration) {
      const transform = `translate(${viewState.tx},${viewState.ty}) scale(${viewState.scale})`;
      const layers = [stateLayer, highlightLayer, markerLayer, capitalLayer];
      layers.forEach((layer) => {
        if (duration && duration > 0) {
          layer.transition().duration(duration).attr('transform', transform);
        } else {
          layer.attr('transform', transform);
        }
      });
    }

    function getPanBounds() {
      const minTx = width - width * viewState.scale;
      const maxTx = 0;
      const minTy = height - height * viewState.scale;
      const maxTy = 0;
      return { minTx, maxTx, minTy, maxTy };
    }

    function clampToBounds(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function refreshHighlight() {
      const feature = hoverFeature || activeFeature;
      highlightPath.attr('d', feature ? path(feature) : null);
    }

    function stateNameFromFeature(f) {
      const props = f.properties || {};
      const raw = props.st_nm || props.NAME_1 || props.NAME || props.state || props.State || 'Unknown';
      const fixed = STATE_ALIASES[raw.toLowerCase()] || raw;
      return fixed;
    }

    function getPlacesForState(stateName) {
      const target = normalize(stateName);
      return WILD_PLACES.filter((p) => normalize(p.state) === target);
    }

    function getPhotoMeta(place, photoEntry, index, folderKey) {
      const isNotWild = place.markerType === 'notwild';
      const src = typeof photoEntry === 'string' ? photoEntry : photoEntry.src;
      const thumbSrc = (photoEntry && typeof photoEntry === 'object' && photoEntry.thumbSrc)
        ? photoEntry.thumbSrc
        : src;
      const captionTemplates = isNotWild ? NOT_WILD_CAPTION_TEMPLATES : WILD_CAPTION_TEMPLATES;
      const defaultCaption = `${captionTemplates[index % captionTemplates.length]} (${index + 1}) - ${place.place}.`;
      const defaultCredit = isNotWild ? NON_WILD_CREDITS[index % NON_WILD_CREDITS.length] : 'Pralay';
      const defaultCreditImage = authorImageFor(defaultCredit);
      const captionOverride = folderKey ? captionEntryFor(folderKey, src) : null;
      const caption = (captionOverride && captionOverride.caption)
        || (typeof photoEntry === 'object' && photoEntry && photoEntry.caption)
        || defaultCaption;
      const credit = (captionOverride && captionOverride.author)
        || (typeof photoEntry === 'object' && photoEntry && photoEntry.credit)
        || defaultCredit;
      const creditImage = (typeof photoEntry === 'object' && photoEntry && photoEntry.creditImage)
        ? photoEntry.creditImage
        : authorImageFor(credit || defaultCredit);

      return { src, thumbSrc, caption, credit, creditImage: creditImage || defaultCreditImage };
    }

    function getPlacePhotoMeta(place) {
      const folderKey = resolvePhotoFolder(place);
      const manifestPhotos = folderKey ? MYWILDINDIA_PHOTO_MANIFEST[folderKey] : null;
      const sourcePhotos = Array.isArray(manifestPhotos) && manifestPhotos.length ? manifestPhotos : (place.photos || []);
      return sourcePhotos.map((photoEntry, index) => getPhotoMeta(place, photoEntry, index, folderKey));
    }

    function renderPanel(place) {
      placeTitle.textContent = place.place + ', ' + place.state;
      placeDescription.innerHTML = place.description;
      placePhotos.innerHTML = '';
      const photoMeta = getPlacePhotoMeta(place);
      photoMeta.slice(0, 9).forEach((photo, i) => {
        const tile = document.createElement('div');
        tile.className = 'photo-tile';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'photo-tile-btn';
        const img = document.createElement('img');
        img.alt = place.place + ' photo ' + (i + 1);
        if (window.viewportLazy) {
          window.viewportLazy.observe(img, { root: placePhotos, src: photo.thumbSrc || photo.src });
        } else {
          img.loading = 'lazy';
          img.decoding = 'async';
          img.src = photo.thumbSrc || photo.src;
        }
        btn.appendChild(img);
        btn.addEventListener('click', () => openLightboxAt(place, i, photoMeta));
        tile.appendChild(btn);
        placePhotos.appendChild(tile);
      });
      panel.classList.add('open');
    }

    function renderLightboxFrame() {
      if (!lightboxPhotos.length) return;
      const frame = lightboxPhotos[lightboxIndex];
      lightboxImgEl.src = frame.src;
      lightboxCaptionEl.textContent = frame.caption;
      lightboxCreditImageEl.src = frame.creditImage;
      lightboxCreditImageEl.alt = frame.credit;
      lightboxCreditNameEl.textContent = frame.credit;
    }

    function openLightboxAt(place, index, photoMeta) {
      lightboxPhotos = (photoMeta || getPlacePhotoMeta(place)).slice();
      lightboxIndex = Math.max(0, Math.min(index, lightboxPhotos.length - 1));
      renderLightboxFrame();
      lightboxEl.classList.add('open');
      lightboxEl.setAttribute('aria-hidden', 'false');
    }

    function nextLightboxPhoto() {
      if (!lightboxPhotos.length) return;
      lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
      renderLightboxFrame();
    }

    function closeLightbox() {
      lightboxEl.classList.remove('open');
      lightboxEl.setAttribute('aria-hidden', 'true');
      lightboxImgEl.src = '';
      lightboxCaptionEl.textContent = '';
      lightboxCreditNameEl.textContent = '';
    }

    function showTooltip(text, event) {
      const rect = mapPanelEl.getBoundingClientRect();
      tooltipEl.classList.remove('rich');
      tooltipEl.textContent = text;
      tooltipEl.classList.add('visible');
      tooltipEl.setAttribute('aria-hidden', 'false');
      positionTooltip(event, rect);
    }

    function showCapitalTooltip(capital, event) {
      const rect = mapPanelEl.getBoundingClientRect();
      const thumbs = (capital.photos || []).slice(0, 2)
        .map((photo, i) => {
          const src = typeof photo === 'string' ? photo : photo.src;
          return `<img src="${src}" alt="${capital.name} photo ${i + 1}" loading="lazy" decoding="async">`;
        })
        .join('');
      tooltipEl.classList.add('rich');
      tooltipEl.innerHTML = `
        <div class="tooltip-title">${capital.name}</div>
        <div class="tooltip-desc">${capital.description}</div>
        <div class="tooltip-thumbs">${thumbs}</div>
      `;
      tooltipEl.classList.add('visible');
      tooltipEl.setAttribute('aria-hidden', 'false');
      positionTooltip(event, rect);
    }

    function positionTooltip(event, rect) {
      const gap = 14;
      const pad = 10;
      const tipW = tooltipEl.offsetWidth || 180;
      const tipH = tooltipEl.offsetHeight || 60;

      let x = event.clientX - rect.left + gap;
      let y = event.clientY - rect.top + gap;

      if (x + tipW > rect.width - pad) x = rect.width - tipW - pad;
      if (x < pad) x = pad;
      if (y + tipH > rect.height - pad) y = event.clientY - rect.top - tipH - gap;
      if (y < pad) y = pad;

      tooltipEl.style.left = x + 'px';
      tooltipEl.style.top = y + 'px';
    }

    function hideTooltip() {
      tooltipEl.classList.remove('visible');
      tooltipEl.classList.remove('rich');
      tooltipEl.setAttribute('aria-hidden', 'true');
    }

    function renderMarkers(features) {
      const statesPresent = new Set(features.map((f) => normalize(stateNameFromFeature(f))));
      const markerData = [];
      if (showWildMarkers) {
        WILD_PLACES
          .filter((p) => statesPresent.has(normalize(p.state)))
          .forEach((p) => markerData.push({ ...p, markerType: 'wild' }));
      }
      if (showNotWildMarkers) {
        NOT_WILD_PLACES
          .filter((p) => statesPresent.has(normalize(p.state)))
          .forEach((p) => markerData.push({ ...p, markerType: 'notwild' }));
      }

      const markers = markerLayer.selectAll('g.marker').data(markerData, (d) => `${d.markerType}:${d.place}`);
      const enter = markers.enter().append('g').attr('class', 'marker');

      enter.append('circle').attr('r', 0);

      const all = enter.merge(markers);
      all.classed('marker-wild', (d) => d.markerType === 'wild');
      all.classed('marker-notwild', (d) => d.markerType === 'notwild');
      all.attr('transform', (d) => {
        const pos = projection(d.coords);
        return pos ? `translate(${pos[0]},${pos[1]})` : 'translate(-999,-999)';
      });

      all.select('circle')
        .transition().duration(240)
        .attr('r', 4);

      all.on('click', (event, d) => {
        event.stopPropagation();
        const markerKey = `${d.markerType}:${d.place}`;
        if (activePlaceKey === markerKey && panel.classList.contains('open')) {
          panel.classList.remove('open');
          activePlaceKey = null;
          return;
        }
        activePlaceKey = markerKey;
        renderPanel(d);
      });
      all.on('mouseenter', (event, d) => showTooltip(d.place, event));
      all.on('mousemove', (event, d) => showTooltip(d.place, event));
      all.on('mouseleave', hideTooltip);

      markers.exit()
        .classed('exiting', true)
        .select('circle')
        .transition().duration(240)
        .attr('r', 0)
        .style('opacity', 0)
        .on('end', function() {
          const parent = this.parentNode;
          if (parent && parent.parentNode) parent.parentNode.removeChild(parent);
        });
    }

    function refreshMarkersForCurrentView() {
      renderMarkers(activeFeature ? [activeFeature] : currentFeatures);
      if (!showWildMarkers && !showNotWildMarkers) {
        panel.classList.remove('open');
        activePlaceKey = null;
      }
    }

    function renderCapitalMarker(feature) {
      const stateKey = normalize(stateNameFromFeature(feature));
      const capital = STATE_CAPITALS[stateKey];
      const data = capital ? [capital] : [];
      const markers = capitalLayer.selectAll('g.capital-marker').data(data, (d) => d.name);
      const enter = markers.enter().append('g').attr('class', 'capital-marker');
      enter.append('circle').attr('r', 0);
      const all = enter.merge(markers);
      all.attr('transform', (d) => {
        const pos = projection(d.coords);
        return pos ? `translate(${pos[0]},${pos[1]})` : 'translate(-999,-999)';
      });
      all.select('circle')
        .transition().duration(220)
        .attr('r', 2.4);
      all.on('mouseenter', (event, d) => showCapitalTooltip(d, event));
      all.on('mousemove', (event, d) => showCapitalTooltip(d, event));
      all.on('mouseleave', hideTooltip);
      markers.exit().remove();
    }

    function zoomToFeature(feature) {
      const [[x0, y0], [x1, y1]] = path.bounds(feature);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const x = (x0 + x1) / 2;
      const y = (y0 + y1) / 2;
      const scale = Math.max(1, Math.min(4.2, 0.58 / Math.max(dx / width, dy / height)));
      viewState.scale = scale;
      viewState.tx = width / 2 - scale * x;
      viewState.ty = height / 2 - scale * y;
      applyViewTransform(700);
    }

    function resetMap() {
      viewState.tx = 0;
      viewState.ty = 0;
      viewState.scale = 1;
      applyViewTransform(500);
      activeFeature = null;
      hoverFeature = null;
      panel.classList.remove('open');
      activePlaceKey = null;
      refreshMarkersForCurrentView();
      capitalLayer.selectAll('g.capital-marker').remove();
      stateLayer.selectAll('path').classed('active', false);
      refreshHighlight();
    }

    async function fetchGeoJSON() {
      for (const url of GEOJSON_URLS) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          if (data && data.type === 'FeatureCollection') return data;
        } catch (_) {}
      }
      throw new Error('Unable to load India GeoJSON.');
    }

    async function initMap() {
      try {
        const geojson = await fetchGeoJSON();
        currentFeatures = geojson.features || [];

        projection.fitSize([width, height], geojson);

        stateLayer
          .selectAll('path')
          .data(currentFeatures)
          .enter()
          .append('path')
          .attr('d', path)
          .attr('tabindex', 0)
          .attr('aria-label', (d) => stateNameFromFeature(d))
          .on('click', (event, d) => {
            if (activeFeature === d) {
              resetMap();
              return;
            }
            stateLayer.selectAll('path').classed('active', false);
            d3.select(event.currentTarget).classed('active', true);
            activeFeature = d;
            refreshHighlight();
            zoomToFeature(d);
            refreshMarkersForCurrentView();
            renderCapitalMarker(d);
          })
          .on('mouseenter', (event, d) => {
            showTooltip(stateNameFromFeature(d), event);
            hoverFeature = d;
            refreshHighlight();
          })
          .on('mousemove', (event, d) => {
            showTooltip(stateNameFromFeature(d), event);
          })
          .on('mouseleave', () => {
            hideTooltip();
            hoverFeature = null;
            refreshHighlight();
          })
          .on('focus', (_, d) => {
            hoverFeature = d;
            refreshHighlight();
          })
          .on('blur', () => {
            hoverFeature = null;
            refreshHighlight();
          })
          .on('keydown', (event, d) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
          });

        refreshMarkersForCurrentView();
        mapEl.on('click', () => {
          panel.classList.remove('open');
          activePlaceKey = null;
        });
      } catch (err) {
        placeDescription.textContent = 'Could not fetch India state boundaries. Please refresh or check connectivity.';
      }
    }

    const closePlaceEl = document.getElementById('close-place');
    if (closePlaceEl) {
      closePlaceEl.addEventListener('click', () => {
        panel.classList.remove('open');
        activePlaceKey = null;
      });
      closePlaceEl.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    }

    if (toggleWildEl) {
      toggleWildEl.addEventListener('change', () => {
        showWildMarkers = toggleWildEl.checked;
        refreshMarkersForCurrentView();
      });
    }
    if (toggleNotWildEl) {
      toggleNotWildEl.addEventListener('change', () => {
        showNotWildMarkers = toggleNotWildEl.checked;
        refreshMarkersForCurrentView();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && lightboxEl && lightboxEl.classList.contains('open')) {
        closeLightbox();
        return;
      }
      if (event.key === 'Escape' && activeFeature) resetMap();
    });

    if (lightboxCloseEl) {
      lightboxCloseEl.addEventListener('click', closeLightbox);
      lightboxCloseEl.addEventListener('click', (event) => event.stopPropagation());
    }
    if (lightboxNextEl) {
      lightboxNextEl.addEventListener('click', nextLightboxPhoto);
      lightboxNextEl.addEventListener('click', (event) => event.stopPropagation());
    }
    if (lightboxEl) {
      lightboxEl.addEventListener('click', (event) => {
        if (event.target === lightboxEl) {
          event.stopPropagation();
          closeLightbox();
        }
      });
    }

    document.addEventListener('click', (event) => {
      if (event.target.closest && event.target.closest('#photo-lightbox')) return;
      if (event.target.closest && event.target.closest('#place-panel')) return;
      if (!event.target.closest || !event.target.closest('.map-panel')) {
        panel.classList.remove('open');
        activePlaceKey = null;
      }
      if (!activeFeature) return;
      if (event.target.closest && event.target.closest('.map-filters')) return;
      if (event.target.closest && event.target.closest('.state-layer path')) return;
      if (event.target.closest && event.target.closest('.marker')) return;
      if (event.target.closest && event.target.closest('.capital-marker')) return;
      resetMap();
    });

    if (mapPanelEl) {
      mapPanelEl.addEventListener('wheel', (event) => {
      if (!activeFeature || viewState.scale <= 1) return;
      event.preventDefault();
      const { minTx, maxTx, minTy, maxTy } = getPanBounds();
      const nextTx = viewState.tx - event.deltaX * 0.55;
      const nextTy = viewState.ty - event.deltaY * 0.55;

      // Soft bounds while dragging: allow slight overshoot with resistance.
      const soften = 0.24;
      viewState.tx = (nextTx < minTx) ? minTx + (nextTx - minTx) * soften : (nextTx > maxTx ? maxTx + (nextTx - maxTx) * soften : nextTx);
      viewState.ty = (nextTy < minTy) ? minTy + (nextTy - minTy) * soften : (nextTy > maxTy ? maxTy + (nextTy - maxTy) * soften : nextTy);
      applyViewTransform(0);

      // Spring back after wheel stops.
      if (wheelReleaseTimer) clearTimeout(wheelReleaseTimer);
      wheelReleaseTimer = setTimeout(() => {
        const b = getPanBounds();
        const clampedTx = clampToBounds(viewState.tx, b.minTx, b.maxTx);
        const clampedTy = clampToBounds(viewState.ty, b.minTy, b.maxTy);
        if (clampedTx !== viewState.tx || clampedTy !== viewState.ty) {
          viewState.tx = clampedTx;
          viewState.ty = clampedTy;
          const transform = `translate(${viewState.tx},${viewState.ty}) scale(${viewState.scale})`;
          [stateLayer, highlightLayer, markerLayer, capitalLayer].forEach((layer) => {
            layer
              .transition()
              .duration(360)
              .ease(d3.easeCubicOut)
              .attr('transform', transform);
          });
        }
      }, 120);
    }, { passive: false });
      mapEl.on('mouseleave', hideTooltip);
    }

    // Initialize map when DOM and D3 are ready. This avoids errors if the
    // script runs before the environment is prepared (some build tools may
    // reorder or defer scripts). If D3 is missing, attempt to load it.
    function ensureReadyAndInit() {
      const start = () => {
        try {
          initMap();
        } catch (err) {
          console.error('Map initialization failed:', err);
          if (placeDescription) placeDescription.textContent = 'Map initialization error. Check console for details.';
        }
      };

      if (window.d3) return start();

      // Dynamically load D3 and then init.
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js';
      s.onload = start;
      s.onerror = () => {
        console.error('Failed to load D3 from CDN');
        if (placeDescription) placeDescription.textContent = 'Failed to load map library. Please check connectivity.';
      };
      document.body.appendChild(s);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureReadyAndInit);
    } else {
      ensureReadyAndInit();
    }
