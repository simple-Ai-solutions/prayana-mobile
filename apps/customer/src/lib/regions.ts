// Explore India by Region, ported from the web's
// components/destination/IndianRegionalDestinations.jsx (regionalData).
// Generated from that file; keep in step with the web.

export type RegionPlace = { name: string; state: string; image: string };
export type RegionKey = 'north' | 'south' | 'east' | 'west';

export const REGIONS: Record<RegionKey, { title: string; destinations: RegionPlace[] }> = {
  north: {
    title: 'North India',
    destinations: [
      {
        name: 'Delhi',
        state: 'Delhi',
        image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=80',
      },
      {
        name: 'Shimla',
        state: 'Himachal Pradesh',
        image:
          'https://prayanaai.com/images/place-names/shimla-mall-road/shimla-mall-road/img-1_google_places_fc10ac43.jpg',
      },
      {
        name: 'Leh-Ladakh',
        state: 'Ladakh',
        image:
          'https://prayanaai.com/images/place-names/pangong-lake-ladakh/pangong-lake-ladakh/img-1_google_places_ffc2c9f2.jpg',
      },
      {
        name: 'Varanasi',
        state: 'Uttar Pradesh',
        image:
          'https://prayanaai.com/images/place-names/varanasi-kashi-vishwanath-ganga-aarti-tourism/varanasi/img-1_google_places_2b0c8329.jpg',
      },
      {
        name: 'Amritsar',
        state: 'Punjab',
        image:
          'https://prayanaai.com/images/place-names/golden-temple-amritsar-punjab-harmandir-sahib/golden-temple/img-1_google_places_e06a0578.jpg',
      },
      {
        name: 'Rishikesh',
        state: 'Uttarakhand',
        image:
          'https://prayanaai.com/images/destination-galleries/uttarakhand-india/rishikesh-lakshman-jhula-ganga-river/gallery-1_google_places_4396c2e1.jpg',
      },
      {
        name: 'Agra',
        state: 'Uttar Pradesh',
        image:
          'https://prayanaai.com/images/place-names/agra-taj-mahal-tourism-places/agra/img-1_google_places_019bdbac.jpg',
      },
    ],
  },
  south: {
    title: 'South India',
    destinations: [
      {
        name: 'Kerala',
        state: 'Kerala',
        image:
          'https://prayanaai.com/images/place-names/kerala-backwaters-munnar-tourism/kerala/img-1_google_places_ec5ed250.jpg',
      },
      {
        name: 'Hampi',
        state: 'Karnataka',
        image:
          'https://prayanaai.com/images/place-names/hampi-karnataka-heritage-tourism/hampi/img-1_google_places_6d98715e.jpg',
      },
      {
        name: 'Pondicherry',
        state: 'Tamil Nadu',
        image:
          'https://prayanaai.com/images/place-names/pondicherry-french-colony-auroville-tourism/pondicherry/img-1_google_places_8ad29750.jpg',
      },
      {
        name: 'Mysore',
        state: 'Karnataka',
        image:
          'https://prayanaai.com/images/place-names/mysore-palace-karnataka-tourism/mysore/img-1_google_places_42a4fb69.jpg',
      },
      {
        name: 'Kanyakumari',
        state: 'Tamil Nadu',
        image:
          'https://prayanaai.com/images/place-names/kanyakumari-temple-tamil-nadu-three-seas-meet/kanyakumari/img-1_google_places_4dc63b48.jpg',
      },
      {
        name: 'Ooty',
        state: 'Tamil Nadu',
        image:
          'https://prayanaai.com/images/place-names/ooty-nilgiris-tourism-hill-station/ooty/img-1_google_places_02ee9071.jpg',
      },
      {
        name: 'Coorg',
        state: 'Karnataka',
        image:
          'https://prayanaai.com/images/place-names/coorg-karnataka-coffee-plantation-tourism/coorg/img-1_google_places_c0121dbf.jpg',
      },
    ],
  },
  east: {
    title: 'East India',
    destinations: [
      {
        name: 'Kolkata',
        state: 'West Bengal',
        image: 'https://images.unsplash.com/photo-1558431382-27e303142255?w=800&q=80',
      },
      {
        name: 'Darjeeling',
        state: 'West Bengal',
        image:
          'https://prayanaai.com/images/place-names/darjeeling-tea-gardens-tourism/darjeeling/img-1_google_places_0c590352.jpg',
      },
      {
        name: 'Puri',
        state: 'Odisha',
        image:
          'https://prayanaai.com/images/place-names/puri-jagannath-temple-odisha-rath-yatra/puri-jagannath/img-1_google_places_f3889eee.jpg',
      },
      {
        name: 'Shillong',
        state: 'Meghalaya',
        image:
          'https://prayanaai.com/images/place-names/shillong-meghalaya-tourism/shillong/img-1_google_places_62a3720a.jpg',
      },
      {
        name: 'Bhubaneswar',
        state: 'Odisha',
        image:
          'https://prayanaai.com/images/place-names/odisha-tourism-attractions-india-state/odisha/img-1_google_places_441a6e96.jpg',
      },
      {
        name: 'Gangtok',
        state: 'Sikkim',
        image:
          'https://prayanaai.com/images/place-names/sikkim/gangtok/img-1_google_places_d506d365.jpg',
      },
    ],
  },
  west: {
    title: 'West India',
    destinations: [
      {
        name: 'Mumbai',
        state: 'Maharashtra',
        image: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&q=80',
      },
      {
        name: 'Goa',
        state: 'Goa',
        image:
          'https://prayanaai.com/images/place-names/goa-beaches-tourism-places/goa/img-1_google_places_5da37517.jpg',
      },
      {
        name: 'Rann of Kutch',
        state: 'Gujarat',
        image:
          'https://prayanaai.com/images/place-names/rann-of-kutch-gujarat-white-desert-tourism/rann-of-kutch/img-1_google_places_59759615.jpg',
      },
      {
        name: 'Udaipur',
        state: 'Rajasthan',
        image:
          'https://prayanaai.com/images/place-names/couple-lake-pichola-udaipur-sunset/couple-lake-pichola-udaipur-sunset/img-1_google_places_00e1e970.jpg',
      },
      {
        name: 'Jaipur',
        state: 'Rajasthan',
        image:
          'https://prayanaai.com/images/destination-galleries/rajasthan-india/hawa-mahal-jaipur/gallery-1_google_places_de6b17d9.jpg',
      },
      {
        name: 'Ajanta & Ellora',
        state: 'Maharashtra',
        image: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800&q=80',
      },
    ],
  },
};
