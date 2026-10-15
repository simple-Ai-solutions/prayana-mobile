// Top 20 destinations in India, ported from the web home page:
//   components/collections/CollectionGrid (topIndiaData) and topIndiaGallery.
// Generated from those files; keep in step with the web.

export type TopPlace = {
  id: string;
  name: string;
  description: string;
  image: string;
  rating: number;
};

export const TOP_INDIA: TopPlace[] = [
  {
    id: 'goa',
    name: 'Goa',
    description: 'Golden beaches, Portuguese heritage, and vibrant nightlife',
    image:
      'https://prayanaai.com/images/place-names/goa-beaches-tourism-places/goa/img-1_google_places_5da37517.jpg',
    rating: 4.6,
  },
  {
    id: 'kerala',
    name: 'Kerala',
    description: "God's Own Country with backwaters and hill stations",
    image:
      'https://prayanaai.com/images/place-names/kerala-backwaters-munnar-tourism/kerala/img-1_google_places_ec5ed250.jpg',
    rating: 4.7,
  },
  {
    id: 'rajasthan',
    name: 'Rajasthan',
    description: 'Land of kings with majestic palaces and desert landscapes',
    image:
      'https://prayanaai.com/images/destination-galleries/rajasthan-india/rajasthan-amer-fort-jaipur/gallery-1_google_places_47448f7e.jpg',
    rating: 4.5,
  },
  {
    id: 'himachal',
    name: 'Himachal Pradesh',
    description: 'Mountain paradise with snow-capped peaks and adventure sports',
    image:
      'https://prayanaai.com/images/place-names/himachal-pradesh-manali-shimla-tourism/himachal-pradesh/img-1_google_places_7ba589dc.jpg',
    rating: 4.6,
  },
  {
    id: 'uttarakhand',
    name: 'Uttarakhand',
    description: 'Spiritual land with sacred temples and pristine nature',
    image:
      'https://prayanaai.com/images/place-names/uttarakhand-rishikesh-haridwar-nainital-tourism/uttarakhand/img-1_google_places_977f9724.jpg',
    rating: 4.4,
  },
  {
    id: 'kashmir',
    name: 'Kashmir',
    description: 'Paradise on Earth with stunning valleys and houseboats',
    image:
      'https://prayanaai.com/images/place-names/kashmir-srinagar-dal-lake-tourism/kashmir/img-1_google_places_d3863b24.jpg',
    rating: 4.8,
  },
  {
    id: 'agra',
    name: 'Agra',
    description: 'Home to the iconic Taj Mahal and Mughal architecture',
    image:
      'https://prayanaai.com/images/place-names/agra-taj-mahal-tourism-places/agra/img-1_google_places_019bdbac.jpg',
    rating: 4.3,
  },
  {
    id: 'ladakh',
    name: 'Ladakh',
    description: 'High-altitude desert with Buddhist monasteries and stunning landscapes',
    image:
      'https://prayanaai.com/images/place-names/ladakh-leh-buddhism-monastery-tourism/ladakh/img-1_google_places_1c694981.jpg',
    rating: 4.7,
  },
  {
    id: 'andaman',
    name: 'Andaman Islands',
    description: 'Tropical paradise with pristine beaches and marine life',
    image:
      'https://prayanaai.com/images/place-names/andaman-nicobar-islands-beaches-tourism/andaman-islands/img-1_google_places_df1defe2.jpg',
    rating: 4.5,
  },
  {
    id: 'mysore',
    name: 'Mysore',
    description: 'City of palaces with rich heritage and cultural traditions',
    image:
      'https://prayanaai.com/images/place-names/mysore-palace-karnataka-tourism/mysore/img-1_google_places_42a4fb69.jpg',
    rating: 4.4,
  },
  {
    id: 'hampi',
    name: 'Hampi',
    description: 'UNESCO World Heritage site with ancient ruins and history',
    image:
      'https://prayanaai.com/images/place-names/hampi-karnataka-heritage-tourism/hampi/img-1_google_places_6d98715e.jpg',
    rating: 4.3,
  },
  {
    id: 'darjeeling',
    name: 'Darjeeling',
    description: 'Queen of Hills famous for tea gardens and mountain views',
    image:
      'https://prayanaai.com/images/place-names/darjeeling-tea-gardens-tourism/darjeeling/img-1_google_places_0c590352.jpg',
    rating: 4.5,
  },
  {
    id: 'coorg',
    name: 'Coorg',
    description: 'Scotland of India with coffee plantations and misty hills',
    image:
      'https://prayanaai.com/images/place-names/coorg-karnataka-coffee-plantation-tourism/coorg/img-1_google_places_c0121dbf.jpg',
    rating: 4.4,
  },
  {
    id: 'ooty',
    name: 'Ooty',
    description: 'Queen of Nilgiris with pleasant climate and botanical gardens',
    image:
      'https://prayanaai.com/images/place-names/ooty-nilgiris-tourism-hill-station/ooty/img-1_google_places_02ee9071.jpg',
    rating: 4.3,
  },
  {
    id: 'munnar',
    name: 'Munnar',
    description: 'Tea capital with rolling hills and spice plantations',
    image:
      'https://prayanaai.com/images/place-names/munnar-kerala-tea-plantation-tourism/munnar/img-1_google_places_0cb65a50.jpg',
    rating: 4.6,
  },
  {
    id: 'pushkar',
    name: 'Pushkar',
    description: 'Sacred city with holy lake and famous camel fair',
    image:
      'https://prayanaai.com/images/destination-galleries/pushkar-rajasthan-india/pushkar-ghat-brahma-temple/gallery-1_google_places_0101c1dd.jpg',
    rating: 4.2,
  },
  {
    id: 'alleppey',
    name: 'Alleppey',
    description: 'Venice of the East with tranquil backwaters and houseboats',
    image:
      'https://prayanaai.com/images/place-names/alleppey-kerala-backwaters-houseboat-tourism/alleppey/img-1_google_places_1c3eb0f7.jpg',
    rating: 4.5,
  },
  {
    id: 'pondicherry',
    name: 'Pondicherry',
    description: 'French colonial charm with beautiful beaches and spiritual vibes',
    image:
      'https://prayanaai.com/images/place-names/pondicherry-french-colony-auroville-tourism/pondicherry/img-1_google_places_8ad29750.jpg',
    rating: 4.3,
  },
  {
    id: 'shillong',
    name: 'Shillong',
    description: 'Scotland of the East with rolling hills and musical heritage',
    image:
      'https://prayanaai.com/images/place-names/shillong-meghalaya-tourism/shillong/img-1_google_places_62a3720a.jpg',
    rating: 4.4,
  },
  {
    id: 'rann_kutch',
    name: 'Rann of Kutch',
    description: 'White desert with unique culture and vibrant festivals',
    image:
      'https://prayanaai.com/images/place-names/rann-of-kutch-gujarat-white-desert-tourism/rann-of-kutch/img-1_google_places_59759615.jpg',
    rating: 4.6,
  },
];

// Extra photos per destination for the card's photo reel. Every one is on our
// CDN and was checked by eye on the web to show the place it is filed under.
export const TOP_INDIA_GALLERY: Record<string, string[]> = {
  goa: [
    'https://prayanaai.com/images/place-names/goa/palolem-beach-goa/img-1_google_places_15f07024.jpg',
    'https://prayanaai.com/images/place-names/goa-tourism-attractions-india-state/goa/img-1_google_places_43c24cd3.jpg',
    'https://prayanaai.com/images/place-names/palolem-beach-goa/palolem-beach-goa/img-1_google_places_3786d399.jpg',
    'https://prayanaai.com/images/place-names/goa/arambol-beach/img-1_google_places_84e2079f.jpg',
  ],
  kerala: [
    'https://prayanaai.com/images/place-names/kerala/alleppey-houseboat-backwaters/img-1_google_places_b311bb5b.jpg',
    'https://prayanaai.com/images/place-names/munnar-tea-gardens/munnar-tea-gardens/img-1_google_places_8fdbe5b7.jpg',
    'https://prayanaai.com/images/place-names/varkala-beach-kerala/varkala-beach-kerala/img-1_google_places_d9f84a18.jpg',
    'https://prayanaai.com/images/place-names/kerala/varkala/img-1_google_places_0d8d23f8.jpg',
  ],
  rajasthan: [
    'https://prayanaai.com/images/destination-galleries/rajasthan-india/rajasthan-amer-fort-jaipur/gallery-1_google_places_47448f7e.jpg',
    'https://prayanaai.com/images/destination-galleries/jodhpur/chamunda-mata-temple/gallery-10_google_places_a089205b.jpg',
    'https://prayanaai.com/images/destination-galleries/jaisalmer/akal-wood-fossil-park/gallery-2_google_places_acf8a56e.jpg',
  ],
  himachal: [
    'https://prayanaai.com/images/place-names/solang-valley-manali/solang-valley-manali/img-1_google_places_2e377953.jpg',
    'https://prayanaai.com/images/place-names/himachal-pradesh/spiti-valley/img-1_google_places_07ea77a9.jpg',
    'https://prayanaai.com/images/place-names/shimla-mall-road/shimla-mall-road/img-1_google_places_fc10ac43.jpg',
  ],
  uttarakhand: [
    'https://prayanaai.com/images/place-names/kedarnath-temple-uttarakhand-jyotirlinga-himalaya/kedarnath/img-1_google_places_d7593456.jpg',
    'https://prayanaai.com/images/place-names/haridwar-ganga-aarti-har-ki-pauri-uttarakhand/haridwar/img-1_google_places_df557ac1.jpg',
    'https://prayanaai.com/images/place-names/uttarakhand/auli-skiing-resort-uttarakhand/img-1_google_places_3e458e91.jpg',
    'https://prayanaai.com/images/place-names/uttarakhand-rishikesh-haridwar-nainital-tourism/uttarakhand/img-1_google_places_977f9724.jpg',
  ],
  kashmir: [
    'https://prayanaai.com/images/place-names/couple-dal-lake-kashmir-shikara/couple-dal-lake-kashmir-shikara/img-1_google_places_d08d61ad.jpg',
    'https://prayanaai.com/images/place-names/jammu-kashmir/dal-lake-srinagar-shikara/img-1_google_places_67fd40ed.jpg',
    'https://prayanaai.com/images/place-names/jammu-kashmir/gulmarg-gondola-skiing-kashmir/img-1_google_places_87820ee5.jpg',
    'https://prayanaai.com/images/place-names/kashmir-srinagar-dal-lake-tourism/kashmir/img-1_google_places_d3863b24.jpg',
  ],
  agra: [
    'https://prayanaai.com/images/place-names/agra-taj-mahal-tourism-places/agra/img-1_google_places_019bdbac.jpg',
    'https://prayanaai.com/images/place-names/uttar-pradesh/taj-mahal-agra/img-1_google_places_33609d61.jpg',
    'https://prayanaai.com/images/place-names/uttar-pradesh/fatehpur-sikri/img-1_google_places_8535b83b.jpg',
  ],
  ladakh: [
    'https://prayanaai.com/images/place-names/pangong-lake-ladakh/pangong-lake-ladakh/img-1_google_places_ffc2c9f2.jpg',
    'https://prayanaai.com/images/place-names/ladakh-tourism-attractions-india-state/ladakh/img-1_google_places_3ad03a39.jpg',
    'https://prayanaai.com/images/place-names/ladakh/stok-kangri-peak-ladakh/img-1_google_places_0ce21647.jpg',
    'https://prayanaai.com/images/place-names/ladakh-leh-buddhism-monastery-tourism/ladakh/img-1_google_places_1c694981.jpg',
  ],
  andaman: [
    'https://prayanaai.com/images/place-names/andaman/havelock-island/img-1_google_places_28705b76.jpg',
    'https://prayanaai.com/images/place-names/neil-island-beach/neil-island-beach/img-1_google_places_9a0a46f9.jpg',
    'https://prayanaai.com/images/place-names/radhanagar-beach-andaman/radhanagar-beach-andaman/img-1_google_places_a27f543b.jpg',
    'https://prayanaai.com/images/place-names/andaman-nicobar-islands-beaches-tourism/andaman-islands/img-1_google_places_df1defe2.jpg',
  ],
  mysore: [
    'https://prayanaai.com/images/place-names/karnataka/mysore-palace/img-1_google_places_e9787d3f.jpg',
    'https://prayanaai.com/images/place-names/mysore-palace-karnataka-tourism/mysore/img-1_google_places_42a4fb69.jpg',
  ],
  hampi: [
    'https://prayanaai.com/images/place-names/hampi-karnataka-heritage-tourism/hampi/img-1_google_places_6d98715e.jpg',
    'https://prayanaai.com/images/place-names/hampi-vijayanagara/hampi-vijayanagara/img-1_google_places_b3ad6f06.jpg',
    'https://prayanaai.com/images/place-names/karnataka/hampi-ruins-temples/img-1_google_places_39570625.jpg',
  ],
  darjeeling: [
    'https://prayanaai.com/images/place-names/tiger-hill-darjeeling/tiger-hill-darjeeling/img-1_google_places_4199d8a5.jpg',
    'https://prayanaai.com/images/place-names/darjeeling-tea-gardens-tourism/darjeeling/img-1_google_places_0c590352.jpg',
    'https://prayanaai.com/images/place-names/west-bengal/darjeeling/img-1_google_places_324f48c6.jpg',
    'https://prayanaai.com/images/place-names/west-bengal/kurseong-darjeeling-hills/img-1_google_places_48dc593e.jpg',
  ],
  coorg: [
    'https://prayanaai.com/images/place-names/coorg-karnataka-coffee-plantation-tourism/coorg/img-1_google_places_c0121dbf.jpg',
    'https://prayanaai.com/images/place-names/karnataka/coorg/img-1_google_places_7d2db022.jpg',
  ],
  ooty: [
    'https://prayanaai.com/images/place-names/ooty-nilgiris-tourism-hill-station/ooty/img-1_google_places_02ee9071.jpg',
    'https://prayanaai.com/images/place-names/tamil-nadu/ooty/img-1_google_places_518da86c.jpg',
    'https://prayanaai.com/images/place-names/tamil-nadu/ooty-botanical-garden/img-1_google_places_2b3206d3.jpg',
  ],
  munnar: [
    'https://prayanaai.com/images/place-names/kerala/munnar/img-1_google_places_003166de.jpg',
    'https://prayanaai.com/images/place-names/munnar-kerala-tea-plantation-tourism/munnar/img-1_google_places_0cb65a50.jpg',
    'https://prayanaai.com/images/place-names/munnar-tea-gardens/munnar-tea-gardens/img-1_google_places_8fdbe5b7.jpg',
  ],
  pushkar: [
    'https://prayanaai.com/images/destination-galleries/pushkar-rajasthan-india/pushkar-ghat-brahma-temple/gallery-1_google_places_0101c1dd.jpg',
  ],
  alleppey: [
    'https://prayanaai.com/images/place-names/alleppey-kerala-backwaters-houseboat-tourism/alleppey/img-1_google_places_1c3eb0f7.jpg',
  ],
  pondicherry: [
    'https://prayanaai.com/images/place-names/pondicherry-french-quarter/pondicherry-french-quarter/img-1_google_places_7337f475.jpg',
    'https://prayanaai.com/images/place-names/pondicherry/pondicherry-french-quarter/img-1_google_places_b9edc7b7.jpg',
    'https://prayanaai.com/images/place-names/tamil-nadu/pondicherry/img-1_google_places_e810225b.jpg',
    'https://prayanaai.com/images/place-names/pondicherry-french-colony-auroville-tourism/pondicherry/img-1_google_places_8ad29750.jpg',
  ],
  shillong: [
    'https://prayanaai.com/images/place-names/meghalaya-living-root-bridge/meghalaya-living-root-bridge/img-1_google_places_8c29330b.jpg',
    'https://prayanaai.com/images/place-names/meghalaya/shillong-waterfalls/img-1_google_places_08e56d99.png',
    'https://prayanaai.com/images/place-names/meghalaya/shillong/img-1_google_places_5bf7c12b.jpg',
    'https://prayanaai.com/images/place-names/northeast-india/meghalaya/img-1_google_places_ca661e1e.jpg',
    'https://prayanaai.com/images/place-names/shillong-meghalaya-tourism/shillong/img-1_google_places_62a3720a.jpg',
  ],
  rann_kutch: [
    'https://prayanaai.com/images/place-names/gujarat/rann-of-kutch-white-desert-gujarat/img-1_google_places_9571b362.jpg',
  ],
};
