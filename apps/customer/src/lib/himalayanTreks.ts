// Himalayan treks, ported from the web home page:
//   components/collections/CollectionGrid (trekkingData) and
//   TrekkingSection (TREK_FACTS, TREK_STRAP, TREK_GALLERY).
// Generated from those files; keep in step with the web.

export type HimalayanTrek = {
  id: string;
  name: string;
  description: string;
  image: string;
  location: string;
  rating: number;
};

export const HIMALAYAN_TREKS: HimalayanTrek[] = [
  {
    id: 'roopkund_trek',
    name: 'Roopkund Trek',
    description: 'Mysterious lake trek with ancient skeletons in Uttarakhand',
    image:
      'https://prayanaai.com/images/place-names/roopkund-trek-trekking-india/roopkund-trek/img-1_google_places_d589ef39.jpg',
    location: 'Uttarakhand',
    rating: 4.8,
  },
  {
    id: 'chadar_trek',
    name: 'Chadar Trek',
    description: 'Walk on frozen Zanskar river in extreme winter conditions',
    image:
      'https://prayanaai.com/images/place-names/chadar-trek-trekking-india/chadar-trek/img-1_google_places_21b67621.jpg',
    location: 'Ladakh',
    rating: 4.9,
  },
  {
    id: 'valley_flowers_trek',
    name: 'Valley of Flowers Trek',
    description: 'UNESCO World Heritage site with rare alpine flowers',
    image:
      'https://prayanaai.com/images/place-names/valley-of-flowers-trek-trekking-india/valley-of-flowers-trek/img-1_google_places_b893a31d.jpg',
    location: 'Uttarakhand',
    rating: 4.7,
  },
  {
    id: 'hampta_pass_trek',
    name: 'Hampta Pass Trek',
    description: 'Cross from Kullu to Lahaul valley through stunning pass',
    image:
      'https://prayanaai.com/images/place-names/hampta-pass-trek-trekking-india/hampta-pass-trek/img-1_google_places_7f8c213e.jpg',
    location: 'Himachal Pradesh',
    rating: 4.5,
  },
  {
    id: 'markha_valley_trek',
    name: 'Markha Valley Trek',
    description: 'Classic Ladakh trek through Buddhist villages and landscapes',
    image:
      'https://prayanaai.com/images/place-names/markha-valley-trek-trekking-india/markha-valley-trek/img-1_google_places_69810f27.jpg',
    location: 'Ladakh',
    rating: 4.6,
  },
  {
    id: 'goecha_la_trek',
    name: 'Goecha La Trek',
    description: 'Spectacular views of Kanchenjunga from Sikkim',
    image:
      'https://prayanaai.com/images/place-names/goecha-la-trek-trekking-india/goecha-la-trek/img-1_google_places_b22c37ba.jpg',
    location: 'Sikkim',
    rating: 4.8,
  },
  {
    id: 'sandakphu_trek',
    name: 'Sandakphu Trek',
    description: 'Highest peak of West Bengal with panoramic Himalayan views',
    image:
      'https://prayanaai.com/images/place-names/sandakphu-trek-trekking-india/sandakphu-trek/img-1_google_places_2b11437a.jpg',
    location: 'West Bengal',
    rating: 4.5,
  },
  {
    id: 'brahmatal_trek',
    name: 'Brahmatal Trek',
    description: 'Winter wonderland trek with frozen lake in Uttarakhand',
    image:
      'https://prayanaai.com/images/place-names/brahmatal-trek-trekking-india/brahmatal-trek/img-1_google_places_2118b439.jpg',
    location: 'Uttarakhand',
    rating: 4.4,
  },
  {
    id: 'kedarnath_trek',
    name: 'Kedarnath Trek',
    description: 'Sacred pilgrimage trek to one of the Char Dhams',
    image:
      'https://prayanaai.com/images/place-names/kedarnath-trek-trekking-india/kedarnath-trek/img-1_google_places_ce8d0b65.jpg',
    location: 'Uttarakhand',
    rating: 4.6,
  },
  {
    id: 'tarsar_marsar_trek',
    name: 'Tarsar Marsar Trek',
    description: "Twin alpine lakes trek in Kashmir's Aru valley",
    image:
      'https://prayanaai.com/images/place-names/tarsar-marsar-trek-trekking-india/tarsar-marsar-trek/img-1_google_places_56f83c4e.jpg',
    location: 'Jammu & Kashmir',
    rating: 4.6,
  },
];

// Grade, days on the trail from the base, and the highest point reached —
// widely published approximate figures.
export const TREK_FACTS: Record<string, [string, string, string]> = {
  roopkund_trek: ['Difficult', '8 days', '4,800 m'],
  chadar_trek: ['Difficult', '9 days', '3,400 m'],
  valley_flowers_trek: ['Moderate', '6 days', '4,330 m'],
  hampta_pass_trek: ['Moderate', '5 days', '4,270 m'],
  markha_valley_trek: ['Moderate', '7 days', '5,260 m'],
  goecha_la_trek: ['Difficult', '11 days', '4,940 m'],
  sandakphu_trek: ['Moderate', '6 days', '3,640 m'],
  brahmatal_trek: ['Easy–mod', '6 days', '3,730 m'],
  kedarnath_trek: ['Moderate', '2 days', '3,580 m'],
  tarsar_marsar_trek: ['Moderate', '7 days', '4,000 m'],
};

// One line per trek, about what makes that trek itself.
export const TREK_STRAP: Record<string, string> = {
  roopkund_trek: 'The mystery lake of skeletons',
  chadar_trek: 'Walk on a frozen river',
  valley_flowers_trek: 'A UNESCO valley in bloom',
  hampta_pass_trek: 'Green Kullu to desert Lahaul',
  markha_valley_trek: 'Monasteries and high passes',
  goecha_la_trek: 'Face to face with Kanchenjunga',
  sandakphu_trek: "Four of the world's five highest peaks",
  brahmatal_trek: 'A frozen lake in winter',
  kedarnath_trek: 'The trail to a Char Dham shrine',
  tarsar_marsar_trek: 'Twin alpine lakes of Kashmir',
};

// A second, distinct photo of the same trek where one exists (checked by eye).
export const TREK_GALLERY: Record<string, string[]> = {
  valley_flowers_trek: [
    'https://prayanaai.com/images/place-names/uttarakhand/valley-of-flowers-uttarakhand/img-1_google_places_f94e875f.jpg',
  ],
  hampta_pass_trek: [
    'https://prayanaai.com/images/destination-galleries/hampta-pass-trek-himachal-pradesh-kullu-lahaul-tre/sethan-village/gallery-6_google_places_02423387.jpg',
  ],
  goecha_la_trek: [
    'https://prayanaai.com/images/place-names/sikkim/goechala-trek-kanchenjunga-sikkim/img-1_google_places_92206584.jpg',
  ],
  kedarnath_trek: [
    'https://prayanaai.com/images/place-names/kedarnath-temple-uttarakhand-jyotirlinga-himalaya/kedarnath/img-1_google_places_d7593456.jpg',
    'https://prayanaai.com/images/place-names/uttarakhand/kedarnath-temple-trek-uttarakhand/img-1_google_places_a326ad3c.jpg',
  ],
};
