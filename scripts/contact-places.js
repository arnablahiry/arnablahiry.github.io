// Contact cards on contact.html: where I am, and how to reach me there.
// Written by the site editor (npm run edit, then Edit on Contact); fine to
// edit by hand. A card is the right answer while today, in its time zone
// (tz, e.g. "Europe/Athens"; empty = the visitor's), is between from and to
// (YYYY-MM-DD, both days included; either may be empty for open-ended).
// When no card's dates include today, the fallback card is the right one.
window.CONTACT_PLACES = {
  "fallback": "heraklion",
  "cards": {
    "heraklion": {
      "tz": "Europe/Athens",
      "from": "",
      "to": "",
      "note": "If I am here, then I am at my main workplace :)\nFeel free to reach me via any available\ncontact option/social media",
      "address": "Office 108β, Department of Physics,\nUniversity of Crete (Voutes Campus),\nHeraklion, Greece 700 13",
      "map": "https://maps.app.goo.gl/xMfmcS1E8tr3zg9DA",
      "email1": "alahiry@ics.forth.gr",
      "email2": "alahiry@physics.uoc.gr",
      "phone": "+30 698 218 0321"
    },
    "paris": {
      "tz": "Europe/Paris",
      "from": "2027-02-01",
      "to": "2027-02-28",
      "note": "Working at CEA Paris-Sacly from Irfu's Department of Astrophysics at the CosmoStat Laboratory",
      "address": "Department of Astrophysics,\nCEA Paris-Saclay, Jardins des Merisiers\n91191 Gif-sur-Yvette, France",
      "map": "https://www.google.com/maps/place/Cea+Paris-Saclay+Orme+Des+Merisiers/data=!4m7!3m6!1s0x47e67f6862b0e801:0x479b6a375ad34004!8m2!3d48.712045!4d2.1472144!16s%2Fg%2F1td5k_vj!19sChIJAeiwYmh_5kcRBEDTWjdqm0c?authuser=0&hl=en&rclk=1",
      "email1": "alahiry@ics.forth.gr",
      "email2": "arnablahiry08@gmail.com",
      "phone": "+30 698 218 0321"
    },
    "kolkata": {
      "tz": "Asia/Kolkata",
      "from": "",
      "to": "",
      "note": "If I am here, then the most likely scenario is that I came home to visit my family....which means i am busy having biryani and may not be very active professionally. Still, feel free to reach out to me, as I am always checking my phone ;)",
      "address": "",
      "map": "",
      "email1": "alahiry@ics.forth.gr",
      "email2": "arnablahiry08@gmail.com",
      "phone": "+91 82407 85329"
    },
    "world": {
      "tz": "",
      "from": "",
      "to": "",
      "note": "",
      "address": "Global Office\nOnline / Remote",
      "map": "",
      "email1": "arnab@domain.com",
      "email2": "hello@lahiry.org",
      "phone": "+44 20 7946 0958"
    }
  }
};
