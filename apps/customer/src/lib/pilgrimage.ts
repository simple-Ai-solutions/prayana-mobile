// Sacred pilgrimage sites, ported from the web home page:
//   components/collections/CollectionGrid (pilgrimageData) and
//   PilgrimageSection (SITE_INFO, SITE_GALLERY).
// Generated from those files; keep in step with the web.

export type PilgrimagePlace = {
  id: string;
  name: string;
  description: string;
  image: string;
  rating: number;
};
/** Icon names are lucide icons; the rail maps them to components. */
export type PerkIcon =
  | 'Building2'
  | 'Church'
  | 'Flame'
  | 'Footprints'
  | 'Landmark'
  | 'Mountain'
  | 'Music'
  | 'Palette'
  | 'Sailboat'
  | 'Sparkles'
  | 'TreePine'
  | 'UtensilsCrossed'
  | 'Waves';
export type SiteInfo = { state: string; strap: string; perks: [string, PerkIcon][] };

export const PILGRIMAGE_SITES: PilgrimagePlace[] = [
  {
    id: 'varanasi',
    name: 'Varanasi',
    description: 'Spiritual capital of India on the sacred banks of River Ganga',
    image:
      'https://prayanaai.com/images/place-names/varanasi-kashi-vishwanath-ganga-aarti-tourism/varanasi/img-1_google_places_2b0c8329.jpg',
    rating: 4.6,
  },
  {
    id: 'tirupati',
    name: 'Tirupati',
    description: 'Abode of Lord Venkateswara, richest temple in the world',
    image:
      'https://prayanaai.com/images/destination-galleries/tirupati-andhra-pradesh-india/sri-venkateswara-swamy-temple-tirumala/gallery-1_google_places_7d9ecd19.jpg',
    rating: 4.5,
  },
  {
    id: 'shirdi',
    name: 'Shirdi',
    description: "Holy town blessed by Sai Baba's divine presence",
    image:
      'https://prayanaai.com/images/place-names/shirdi-sai-baba-temple-maharashtra-pilgrimage/shirdi/img-1_google_places_e2d140b0.jpg',
    rating: 4.4,
  },
  {
    id: 'golden_temple',
    name: 'Golden Temple',
    description: 'Holiest Sikh shrine with golden architecture and free langar',
    image:
      'https://prayanaai.com/images/place-names/golden-temple-amritsar-punjab-harmandir-sahib/golden-temple/img-1_google_places_e06a0578.jpg',
    rating: 4.8,
  },
  {
    id: 'ajmer',
    name: 'Ajmer Sharif',
    description: 'Sufi shrine of Khwaja Moinuddin Chishti, symbol of unity',
    image:
      'https://prayanaai.com/images/place-names/ajmer-sharif-dargah-khwaja-moinuddin-chishti-rajas/ajmer-sharif/img-1_google_places_fa27cda8.jpg',
    rating: 4.3,
  },
  {
    id: 'kedarnath',
    name: 'Kedarnath',
    description: 'One of 12 Jyotirlingas nestled in the Himalayas',
    image:
      'https://prayanaai.com/images/place-names/kedarnath-temple-uttarakhand-jyotirlinga-himalaya/kedarnath/img-1_google_places_d7593456.jpg',
    rating: 4.7,
  },
  {
    id: 'meenakshi',
    name: 'Meenakshi Temple',
    description: 'Magnificent Dravidian temple dedicated to Goddess Meenakshi',
    image:
      'https://prayanaai.com/images/destination-galleries/madurai-tamil-nadu-india/madurai-meenakshi-amman-temple/gallery-1_google_places_47e40453.jpg',
    rating: 4.5,
  },
  {
    id: 'rishikesh',
    name: 'Rishikesh',
    description: 'Yoga capital of the world on the banks of holy Ganga',
    image:
      'https://prayanaai.com/images/destination-galleries/rishikesh-uttarakhand-india/rishikesh-ram-jhula/gallery-1_google_places_619e7c98.jpg',
    rating: 4.4,
  },
  {
    id: 'haridwar',
    name: 'Haridwar',
    description: 'Gateway to gods where Ganga descends to plains',
    image:
      'https://prayanaai.com/images/place-names/haridwar-ganga-aarti-har-ki-pauri-uttarakhand/haridwar/img-1_google_places_df557ac1.jpg',
    rating: 4.3,
  },
  {
    id: 'puri',
    name: 'Puri Jagannath',
    description: 'Home of Lord Jagannath and the famous Rath Yatra',
    image:
      'https://prayanaai.com/images/place-names/puri-jagannath-temple-odisha-rath-yatra/puri-jagannath/img-1_google_places_f3889eee.jpg',
    rating: 4.4,
  },
  {
    id: 'dwarka',
    name: 'Dwarka',
    description: "Krishna's legendary kingdom and Char Dham pilgrimage site",
    image:
      'https://prayanaai.com/images/place-names/dwarka-temple-gujarat-krishna-char-dham/dwarka/img-1_google_places_a89991ae.jpg',
    rating: 4.5,
  },
  {
    id: 'vaishnodevi',
    name: 'Vaishno Devi',
    description: 'Sacred cave shrine of the Divine Mother in Trikuta Hills',
    image:
      'https://prayanaai.com/images/place-names/vaishno-devi-temple-jammu-kashmir-divine-mother/vaishno-devi/img-1_google_places_39940a6e.jpg',
    rating: 4.5,
  },
  {
    id: 'velankanni',
    name: 'Velankanni Basilica',
    description: 'Lourdes of the East, revered shrine of Our Lady of Good Health',
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Vailankanni_Basilica1.jpg/1280px-Vailankanni_Basilica1.jpg',
    rating: 4.6,
  },
  {
    id: 'basilica_bom_jesus',
    name: 'Basilica of Bom Jesus',
    description: 'UNESCO heritage church housing relics of St. Francis Xavier',
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Front_Elevation_of_Basilica_of_Bom_Jesus.jpg/1280px-Front_Elevation_of_Basilica_of_Bom_Jesus.jpg',
    rating: 4.5,
  },
  {
    id: 'haji_ali',
    name: 'Haji Ali Dargah',
    description: "Iconic mosque and dargah on an islet off Mumbai's coast",
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Mumbai_03-2016_12_Haji_Ali_Dargah.jpg/1280px-Mumbai_03-2016_12_Haji_Ali_Dargah.jpg',
    rating: 4.4,
  },
  {
    id: 'jama_masjid',
    name: 'Jama Masjid Delhi',
    description: "India's largest mosque, a Mughal architectural masterpiece",
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Jama_Masjid_-_In_the_Noon.jpg/1280px-Jama_Masjid_-_In_the_Noon.jpg',
    rating: 4.5,
  },
  {
    id: 'bodh_gaya',
    name: 'Bodh Gaya',
    description: 'Where Buddha attained enlightenment under the sacred Bodhi tree',
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Mahabodhitemple.jpg/1280px-Mahabodhitemple.jpg',
    rating: 4.7,
  },
  {
    id: 'tawang_monastery',
    name: 'Tawang Monastery',
    description: "Largest monastery in India, perched high in Arunachal's mountains",
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Tawang_Monastery_%28Tibetan_Buddhist%29.jpg/1280px-Tawang_Monastery_%28Tibetan_Buddhist%29.jpg',
    rating: 4.6,
  },
  {
    id: 'dilwara',
    name: 'Dilwara Temples',
    description: 'Exquisite marble-carved Jain temples atop Mount Abu',
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Delwada.jpg/1280px-Delwada.jpg',
    rating: 4.7,
  },
  {
    id: 'bangla_sahib',
    name: 'Gurudwara Bangla Sahib',
    description: 'Prominent Sikh gurudwara with a healing sarovar in Delhi',
    image:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Front_view_of_Gurudwara_Bangla_Sahib%2C_Delhi.jpg/1280px-Front_view_of_Gurudwara_Bangla_Sahib%2C_Delhi.jpg',
    rating: 4.6,
  },
];

// Where each site is, a one-line strap, and three things it is known for.
export const SITE_INFO: Record<string, SiteInfo> = {
  varanasi: {
    state: 'Uttar Pradesh',
    strap: "India's spiritual capital",
    perks: [
      ['Ganga Aarti', 'Flame'],
      ['Ghats', 'Waves'],
      ['Boat ride', 'Sailboat'],
    ],
  },
  tirupati: {
    state: 'Andhra Pradesh',
    strap: 'Abode of Lord Venkateswara',
    perks: [
      ['Darshan', 'Landmark'],
      ['Prasadam', 'UtensilsCrossed'],
      ['Tirumala', 'Mountain'],
    ],
  },
  shirdi: {
    state: 'Maharashtra',
    strap: 'Blessed by Sai Baba',
    perks: [
      ['Samadhi', 'Landmark'],
      ['Aarti', 'Flame'],
      ['Prasad', 'UtensilsCrossed'],
    ],
  },
  golden_temple: {
    state: 'Punjab',
    strap: 'The holiest Sikh shrine',
    perks: [
      ['Langar', 'UtensilsCrossed'],
      ['Sarovar', 'Waves'],
      ['Gurbani', 'Music'],
    ],
  },
  ajmer: {
    state: 'Rajasthan',
    strap: 'Shrine of Khwaja Garib Nawaz',
    perks: [
      ['Dargah', 'Landmark'],
      ['Qawwali', 'Music'],
      ['Urs', 'Sparkles'],
    ],
  },
  kedarnath: {
    state: 'Uttarakhand',
    strap: 'A Jyotirlinga in the Himalayas',
    perks: [
      ['Jyotirlinga', 'Landmark'],
      ['Trek', 'Footprints'],
      ['Himalaya', 'Mountain'],
    ],
  },
  meenakshi: {
    state: 'Tamil Nadu',
    strap: 'Towering Dravidian gopurams',
    perks: [
      ['Gopurams', 'Landmark'],
      ['1000 pillars', 'Building2'],
      ['Temple art', 'Palette'],
    ],
  },
  rishikesh: {
    state: 'Uttarakhand',
    strap: 'Yoga capital of the world',
    perks: [
      ['Ganga Aarti', 'Flame'],
      ['Yoga', 'Sparkles'],
      ['Ganga', 'Waves'],
    ],
  },
  haridwar: {
    state: 'Uttarakhand',
    strap: 'Where the Ganga meets the plains',
    perks: [
      ['Har Ki Pauri', 'Landmark'],
      ['Ganga Aarti', 'Flame'],
      ['Holy dip', 'Waves'],
    ],
  },
  puri: {
    state: 'Odisha',
    strap: 'Home of the Rath Yatra',
    perks: [
      ['Jagannath', 'Landmark'],
      ['Rath Yatra', 'Sparkles'],
      ['Mahaprasad', 'UtensilsCrossed'],
    ],
  },
  dwarka: {
    state: 'Gujarat',
    strap: "Krishna's legendary kingdom",
    perks: [
      ['Dwarkadhish', 'Landmark'],
      ['Char Dham', 'Sparkles'],
      ['Gomti Ghat', 'Waves'],
    ],
  },
  vaishnodevi: {
    state: 'Jammu & Kashmir',
    strap: 'Cave shrine of the Mother Goddess',
    perks: [
      ['Cave shrine', 'Landmark'],
      ['Trek', 'Footprints'],
      ['Trikuta hills', 'Mountain'],
    ],
  },
  velankanni: {
    state: 'Tamil Nadu',
    strap: 'The Lourdes of the East',
    perks: [
      ['Basilica', 'Church'],
      ['Feast', 'Sparkles'],
      ['Beach', 'Waves'],
    ],
  },
  basilica_bom_jesus: {
    state: 'Goa',
    strap: 'Relics of St. Francis Xavier',
    perks: [
      ['UNESCO', 'Landmark'],
      ['Relics', 'Sparkles'],
      ['Old Goa', 'Building2'],
    ],
  },
  haji_ali: {
    state: 'Maharashtra',
    strap: 'A shrine on the Arabian Sea',
    perks: [
      ['Dargah', 'Landmark'],
      ['Sea path', 'Waves'],
      ['Qawwali', 'Music'],
    ],
  },
  jama_masjid: {
    state: 'Delhi',
    strap: 'Mughal masterpiece in Old Delhi',
    perks: [
      ['Mosque', 'Landmark'],
      ['Minarets', 'Building2'],
      ['Old Delhi', 'UtensilsCrossed'],
    ],
  },
  bodh_gaya: {
    state: 'Bihar',
    strap: 'Where the Buddha found enlightenment',
    perks: [
      ['Mahabodhi', 'Landmark'],
      ['Bodhi tree', 'TreePine'],
      ['Meditation', 'Sparkles'],
    ],
  },
  tawang_monastery: {
    state: 'Arunachal Pradesh',
    strap: "India's largest monastery",
    perks: [
      ['Monastery', 'Landmark'],
      ['Himalaya', 'Mountain'],
      ['Prayers', 'Music'],
    ],
  },
  dilwara: {
    state: 'Rajasthan',
    strap: 'Marble carved like lace',
    perks: [
      ['Jain temples', 'Landmark'],
      ['Marble art', 'Palette'],
      ['Mount Abu', 'Mountain'],
    ],
  },
  bangla_sahib: {
    state: 'Delhi',
    strap: 'A healing sarovar in Delhi',
    perks: [
      ['Langar', 'UtensilsCrossed'],
      ['Sarovar', 'Waves'],
      ['Gurbani', 'Music'],
    ],
  },
};

// More photos of the same place for the card's reel, checked by eye on the web.
export const SITE_GALLERY: Record<string, string[]> = {
  varanasi: [
    'https://prayanaai.com/images/place-names/varanasi/subah-e-banaras/img-1_google_places_015b6ddc.jpg',
    'https://prayanaai.com/images/place-names/varanasi/shri-kashi-vishwanath-temple/img-1_google_places_5927f546.jpg',
  ],
  kedarnath: [
    'https://prayanaai.com/images/place-names/kedarnath-trek-trekking-india/kedarnath-trek/img-1_google_places_ce8d0b65.jpg',
    'https://prayanaai.com/images/place-names/uttarakhand/kedarnath-temple-trek-uttarakhand/img-1_google_places_a326ad3c.jpg',
  ],
  rishikesh: [
    'https://prayanaai.com/images/destination-galleries/uttarakhand-india/rishikesh-lakshman-jhula-ganga-river/gallery-1_google_places_4396c2e1.jpg',
    'https://prayanaai.com/images/place-names/uttarakhand-rishikesh-haridwar-nainital-tourism/uttarakhand/img-1_google_places_977f9724.jpg',
  ],
  tirupati: [
    'https://prayanaai.com/images/place-names/dwaraka-tirumala/sri-padmavathi-ammavari-temple/img-5_google_places_e2696f71.jpg',
    'https://prayanaai.com/images/place-names/tirumala-tirupati-andhra-pradesh-517504-india/sri-venkateswara-swamy-temple/img-1_google_places_ee1968ba.jpg',
  ],
  shirdi: [
    'https://prayanaai.com/images/place-names/near-samadhi-mandir-shirdi-maharashtra-423109-indi/shri-sai-baba-sansthan-trust-museum/img-1_google_places_73634a9a.jpg',
    'https://prayanaai.com/images/place-names/near-sai-heritage-village-shirdi-maharashtra-42310/khandoba-temple/img-1_google_places_2e929f6d.jpg',
  ],
  golden_temple: [
    'https://prayanaai.com/images/place-names/golden-temple-amritsar-punjab-143006-india/view-from-the-harmandir-sahib-parikrama/img-1_google_places_3e0fae97.jpg',
    'https://prayanaai.com/images/place-names/golden-temple-amritsar-punjab-harmandir-sahib-indi/akal-takht/img-1_google_places_2638731f.jpg',
  ],
  ajmer: [
    'https://prayanaai.com/images/destination-galleries/ajmer-sharif-dargah-ajmer-rajasthan-india/ajmer-sharif-dargah/gallery-2_google_places_f78f6aac.jpg',
    'https://prayanaai.com/images/destination-galleries/ajmer-sharif-dargah-ajmer-rajasthan-india/ajmer-sharif-dargah/gallery-3_google_places_f23d948d.jpg',
  ],
  meenakshi: [
    'https://prayanaai.com/images/place-names/east-gate-meenakshi-amman-temple-madurai-tamil-nad/puthu-mandapam/img-1_google_places_bb1898a2.jpg',
    'https://prayanaai.com/images/place-names/meenakshi-amman-temple-madurai-tamil-nadu-625001-i/aayiram-kaal-mandapam-hall-of-thousand-pillars/img-1_google_places_c3ec33a5.jpg',
    'https://prayanaai.com/images/place-names/meenakshi-temple-madurai-tamil-nadu-goddess/alagar-kovil/img-1_google_places_b18d95c5.jpg',
  ],
  haridwar: [
    'https://prayanaai.com/images/place-names/har-ki-pauri-haridwar-uttarakhand-249401/har-ki-pauri-haridwar/img-1_google_places_21b928e8.jpg',
    'https://prayanaai.com/images/place-names/chandighat-haridwar-uttarakhand-249401/chandi-devi-temple-haridwar/img-1_google_places_531e0901.jpg',
  ],
  puri: [
    'https://prayanaai.com/images/destination-galleries/jagannath-temple-puri-puri-odisha-india/jagannath-temple-puri/gallery-1_google_places_2634e99a.jpg',
    'https://prayanaai.com/images/destination-galleries/jagannath-temple-puri-puri-odisha-india/jagannath-temple-puri/gallery-2_google_places_85e718e8.jpg',
  ],
  dwarka: [
    'https://prayanaai.com/images/place-names/dwarka-temple-gujarat-krishna-char-dham/dwarka-lighthouse/img-4_google_places_7854863b.jpg',
    'https://prayanaai.com/images/destination-galleries/dwarka-india/dwarka/gallery-10_google_places_7d444fb2.jpg',
  ],
  vaishnodevi: [
    'https://prayanaai.com/images/place-names/vaishno-devi-temple-jammu-kashmir-divine-mother/vaishno-devi/img-1_google_places_39940a6e.jpg',
    'https://prayanaai.com/images/destination-galleries/vaishno-devi-india/vaishno-devi/gallery-10_google_places_850b5f1d.jpg',
  ],
  velankanni: [
    'https://prayanaai.com/images/destination-galleries/velankanni-basilica-velankanni-tamil-nadu-india/velankanni-basilica/gallery-1_google_places_192a61de.jpg',
    'https://prayanaai.com/images/destination-galleries/velankanni-india/velankanni/gallery-10_google_places_584bc36e.jpg',
    'https://prayanaai.com/images/destination-galleries/velankanni-india/velankanni/gallery-2_google_places_c2ab2c7c.jpg',
  ],
  basilica_bom_jesus: [
    'https://prayanaai.com/images/place-names/basilica-of-bom-jesus-old-goa-road-bainguinim-goa-/tomb-of-st-francis-xavier/img-1_google_places_039ca2c2.jpg',
  ],
  haji_ali: [
    'https://prayanaai.com/images/destination-galleries/haji-ali-dargah-india/haji-ali-dargah/gallery-3_google_places_a7fd87d5.jpg',
    'https://prayanaai.com/images/destination-galleries/haji-ali-rd-mahalaxmi-mumbai-maharashtra-400034/haji-ali-dargah/gallery-1_google_places_c9fe385e.jpg',
  ],
  jama_masjid: [
    'https://prayanaai.com/images/destination-galleries/jama-masjid-delhi-delhi-delhi-india/jama-masjid-delhi/gallery-1_google_places_76bfc166.jpg',
    'https://prayanaai.com/images/destination-galleries/jama-masjid-delhi-delhi-delhi-india/jama-masjid-delhi/gallery-2_google_places_47e6c50f.jpg',
  ],
  bodh_gaya: [
    'https://prayanaai.com/images/place-names/bodhgaya/animesh-lochan-chaitya/img-1_google_places_3f445257.jpg',
    'https://prayanaai.com/images/place-names/bodhgaya/animesh-lochan-chaitya/img-2_google_places_cab281f1.jpg',
  ],
  tawang_monastery: [
    'https://prayanaai.com/images/place-names/tawang-monastery/administrative-office-building/img-3_google_places_f0e6fa60.jpg',
    'https://prayanaai.com/images/place-names/tawang-monastery/administrative-office-building/img-4_google_places_814becfa.jpg',
  ],
  dilwara: [
    'https://prayanaai.com/images/destination-galleries/dilwara-region/dilwara-temples/gallery-1_google_places_d9fd7533.jpg',
  ],
  bangla_sahib: [
    'https://prayanaai.com/images/place-names/bangla-sahib-gurudwara-connaught-place-delhi/bangla-sahib-gurudwara/img-1_google_places_4a6eb638.jpg',
  ],
};
