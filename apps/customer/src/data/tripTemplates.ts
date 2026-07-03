/**
 * Destination-specific trip templates with pre-planned itineraries
 * Matches web's TripTemplates.jsx data format
 */

export interface TemplateActivity {
  name: string;
  description: string;
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'night';
  duration: number;
  category: string;
  rating: number;
}

export interface TemplateDay {
  dayNumber: number;
  title: string;
  theme: string;
  activities: TemplateActivity[];
}

export interface TripTemplate {
  id: string;
  name: string;
  tagline: string;
  destination: string;
  duration: string;
  durationDays: number;
  budget: string;
  tripType: string;
  tags: string[];
  gradient: [string, string];
  emoji: string;
  days: TemplateDay[];
}

export const TRIP_TEMPLATES: TripTemplate[] = [
  {
    id: 'hampi-2d',
    name: 'Hampi Heritage Explorer',
    tagline: 'Ancient ruins & boulder landscapes',
    destination: 'Hampi',
    duration: '2 Days',
    durationDays: 2,
    budget: 'budget',
    tripType: 'cultural',
    tags: ['UNESCO', 'History', 'Temples'],
    gradient: ['#f59e0b', '#d97706'],
    emoji: '\uD83C\uDFDB\uFE0F',
    days: [
      {
        dayNumber: 1,
        title: 'Day 1 - Royal Hampi',
        theme: 'Temples & Royal Enclosures',
        activities: [
          { name: 'Virupaksha Temple', description: 'Start at the iconic temple at the heart of Hampi bazaar', timeSlot: 'morning', duration: 1.5, category: 'temple', rating: 4.8 },
          { name: 'Hampi Bazaar Walk', description: 'Explore the ancient market street with carved pillars', timeSlot: 'morning', duration: 1, category: 'cultural', rating: 4.3 },
          { name: 'Royal Enclosure', description: "Visit the king's palace area with stepped tank", timeSlot: 'afternoon', duration: 2, category: 'monument', rating: 4.5 },
          { name: 'Lotus Mahal', description: 'Beautiful Indo-Islamic architecture in the Zenana Enclosure', timeSlot: 'afternoon', duration: 1, category: 'monument', rating: 4.6 },
          { name: 'Hemakuta Hill Sunset', description: 'Watch sunset from the hill with temple silhouettes', timeSlot: 'evening', duration: 1.5, category: 'viewpoint', rating: 4.9 },
          { name: 'Mango Tree Restaurant', description: 'Riverside dinner with views of Tungabhadra', timeSlot: 'night', duration: 1.5, category: 'restaurant', rating: 4.4 },
        ],
      },
      {
        dayNumber: 2,
        title: 'Day 2 - Sacred & Scenic',
        theme: 'River crossing & hilltop temples',
        activities: [
          { name: 'Coracle Ride on Tungabhadra', description: 'Cross the river in a traditional round boat', timeSlot: 'morning', duration: 1, category: 'adventure', rating: 4.7 },
          { name: 'Vitthala Temple Complex', description: 'See the famous stone chariot and musical pillars', timeSlot: 'morning', duration: 2, category: 'temple', rating: 4.9 },
          { name: 'Matanga Hill Trek', description: 'Climb to highest point for panoramic Hampi views', timeSlot: 'afternoon', duration: 2, category: 'adventure', rating: 4.8 },
          { name: 'Hippie Island (Virupapur Gaddi)', description: 'Relax at the laid-back riverside area', timeSlot: 'evening', duration: 2, category: 'cultural', rating: 4.3 },
        ],
      },
    ],
  },
  {
    id: 'goa-3d',
    name: 'Goa Beach & Culture',
    tagline: 'Sun, sand, and Portuguese heritage',
    destination: 'Goa',
    duration: '3 Days',
    durationDays: 3,
    budget: 'moderate',
    tripType: 'leisure',
    tags: ['Beach', 'Nightlife', 'Heritage'],
    gradient: ['#3b82f6', '#1d4ed8'],
    emoji: '\uD83C\uDFD6\uFE0F',
    days: [
      {
        dayNumber: 1,
        title: 'Day 1 - North Goa Beaches',
        theme: 'Iconic beaches & beach shacks',
        activities: [
          { name: 'Calangute Beach', description: "Goa's most famous beach stretch", timeSlot: 'morning', duration: 2, category: 'beach', rating: 4.2 },
          { name: 'Baga Beach', description: 'Water sports and vibrant beach scene', timeSlot: 'morning', duration: 1.5, category: 'beach', rating: 4.4 },
          { name: 'Anjuna Flea Market', description: 'Shop for souvenirs and local crafts (Wed)', timeSlot: 'afternoon', duration: 2, category: 'shopping', rating: 4.3 },
          { name: 'Curlies Beach Shack', description: 'Iconic beachside dining in Anjuna', timeSlot: 'evening', duration: 2, category: 'restaurant', rating: 4.1 },
          { name: 'Tito\'s Lane', description: 'Famous nightlife strip in Baga', timeSlot: 'night', duration: 2, category: 'nightlife', rating: 4.0 },
        ],
      },
      {
        dayNumber: 2,
        title: 'Day 2 - Old Goa Heritage',
        theme: 'Portuguese churches & spice plantations',
        activities: [
          { name: 'Basilica of Bom Jesus', description: "UNESCO site housing St. Francis Xavier's relics", timeSlot: 'morning', duration: 1.5, category: 'cultural', rating: 4.7 },
          { name: 'Se Cathedral', description: 'Largest church in Asia with golden bell', timeSlot: 'morning', duration: 1, category: 'cultural', rating: 4.5 },
          { name: 'Sahakari Spice Farm', description: 'Spice plantation tour with traditional lunch', timeSlot: 'afternoon', duration: 3, category: 'cultural', rating: 4.6 },
          { name: 'Fontainhas Latin Quarter', description: 'Walk through colorful Portuguese-era lanes in Panjim', timeSlot: 'evening', duration: 1.5, category: 'cultural', rating: 4.4 },
        ],
      },
      {
        dayNumber: 3,
        title: 'Day 3 - South Goa Serenity',
        theme: 'Quiet beaches & nature',
        activities: [
          { name: 'Palolem Beach', description: 'Crescent-shaped beach with calm waters', timeSlot: 'morning', duration: 2.5, category: 'beach', rating: 4.7 },
          { name: 'Butterfly Beach', description: 'Secluded beach accessible by boat', timeSlot: 'afternoon', duration: 2, category: 'beach', rating: 4.5 },
          { name: 'Cabo de Rama Fort', description: 'Ancient fort with dramatic coastal views', timeSlot: 'afternoon', duration: 1.5, category: 'monument', rating: 4.3 },
          { name: 'Palolem Beach Sunset', description: 'Watch the sun set into the Arabian Sea', timeSlot: 'evening', duration: 1, category: 'viewpoint', rating: 4.8 },
        ],
      },
    ],
  },
  {
    id: 'shimla-manali-4d',
    name: 'Shimla-Manali Mountain Trail',
    tagline: 'Hill stations & mountain passes',
    destination: 'Shimla',
    duration: '4 Days',
    durationDays: 4,
    budget: 'moderate',
    tripType: 'adventure',
    tags: ['Mountains', 'Snow', 'Adventure'],
    gradient: ['#10b981', '#059669'],
    emoji: '\uD83C\uDFD4\uFE0F',
    days: [
      {
        dayNumber: 1,
        title: 'Day 1 - Shimla Charm',
        theme: 'Colonial architecture & Mall Road',
        activities: [
          { name: 'The Ridge', description: 'Open space with panoramic mountain views', timeSlot: 'morning', duration: 1.5, category: 'viewpoint', rating: 4.5 },
          { name: 'Christ Church', description: 'Second oldest church in North India', timeSlot: 'morning', duration: 0.5, category: 'cultural', rating: 4.3 },
          { name: 'Mall Road', description: 'Shop and stroll along the famous promenade', timeSlot: 'afternoon', duration: 2, category: 'shopping', rating: 4.2 },
          { name: 'Jakhu Temple', description: 'Hilltop temple with massive Hanuman statue', timeSlot: 'afternoon', duration: 1.5, category: 'temple', rating: 4.4 },
          { name: 'Scandal Point Sunset', description: 'Watch sunset from the historic meeting point', timeSlot: 'evening', duration: 1, category: 'viewpoint', rating: 4.3 },
        ],
      },
      {
        dayNumber: 2,
        title: 'Day 2 - Shimla to Manali',
        theme: 'Scenic drive through Kullu Valley',
        activities: [
          { name: 'Shimla to Manali Drive', description: '8-hour scenic drive through mountains', timeSlot: 'morning', duration: 4, category: 'adventure', rating: 4.6 },
          { name: 'Kullu Valley Stop', description: 'Tea break with river valley views', timeSlot: 'afternoon', duration: 1, category: 'viewpoint', rating: 4.2 },
          { name: 'Old Manali Walk', description: 'Explore the charming old village with cafes', timeSlot: 'evening', duration: 2, category: 'cultural', rating: 4.5 },
        ],
      },
      {
        dayNumber: 3,
        title: 'Day 3 - Solang & Rohtang',
        theme: 'Snow adventures & mountain passes',
        activities: [
          { name: 'Solang Valley', description: 'Paragliding, zorbing, and snow activities', timeSlot: 'morning', duration: 3, category: 'adventure', rating: 4.7 },
          { name: 'Atal Tunnel', description: "World's longest highway tunnel at 10,000 ft", timeSlot: 'afternoon', duration: 1.5, category: 'landmark', rating: 4.5 },
          { name: 'Sissu Waterfall', description: 'Beautiful waterfall beyond the tunnel', timeSlot: 'afternoon', duration: 1, category: 'nature', rating: 4.4 },
          { name: 'Manali Mall Road', description: 'Evening shopping for woolen goods', timeSlot: 'evening', duration: 2, category: 'shopping', rating: 4.1 },
        ],
      },
      {
        dayNumber: 4,
        title: 'Day 4 - Temples & Nature',
        theme: 'Sacred sites & hot springs',
        activities: [
          { name: 'Hadimba Temple', description: 'Ancient wooden temple in cedar forest', timeSlot: 'morning', duration: 1.5, category: 'temple', rating: 4.6 },
          { name: 'Vashisht Hot Springs', description: 'Natural hot water springs with temple', timeSlot: 'morning', duration: 1.5, category: 'wellness', rating: 4.3 },
          { name: 'Jogini Waterfall Trek', description: '3km trek to a stunning waterfall', timeSlot: 'afternoon', duration: 3, category: 'adventure', rating: 4.5 },
          { name: 'Riverside Cafe', description: 'Relax at a Beas river-facing cafe', timeSlot: 'evening', duration: 1.5, category: 'cafe', rating: 4.2 },
        ],
      },
    ],
  },
  {
    id: 'rajasthan-5d',
    name: 'Royal Rajasthan Circuit',
    tagline: 'Forts, palaces, and desert magic',
    destination: 'Jaipur',
    duration: '5 Days',
    durationDays: 5,
    budget: 'moderate',
    tripType: 'cultural',
    tags: ['Heritage', 'Forts', 'Desert'],
    gradient: ['#a855f7', '#7c3aed'],
    emoji: '\uD83C\uDFF0',
    days: [
      {
        dayNumber: 1,
        title: 'Day 1 - Pink City Jaipur',
        theme: 'Forts and palaces',
        activities: [
          { name: 'Amber Fort', description: 'Majestic hilltop fort with Sheesh Mahal', timeSlot: 'morning', duration: 2.5, category: 'monument', rating: 4.8 },
          { name: 'Hawa Mahal', description: 'Iconic Palace of Winds with 953 windows', timeSlot: 'morning', duration: 1, category: 'monument', rating: 4.6 },
          { name: 'City Palace', description: 'Royal residence with museum galleries', timeSlot: 'afternoon', duration: 2, category: 'monument', rating: 4.5 },
          { name: 'Jantar Mantar', description: 'UNESCO astronomical observation site', timeSlot: 'afternoon', duration: 1, category: 'cultural', rating: 4.4 },
          { name: 'Nahargarh Fort Sunset', description: 'Panoramic sunset over the Pink City', timeSlot: 'evening', duration: 2, category: 'viewpoint', rating: 4.7 },
        ],
      },
      {
        dayNumber: 2,
        title: 'Day 2 - Jaipur to Jodhpur',
        theme: 'Blue City exploration',
        activities: [
          { name: 'Jaipur to Jodhpur Drive', description: 'Scenic 5-hour drive through Rajasthan', timeSlot: 'morning', duration: 3, category: 'adventure', rating: 4.2 },
          { name: 'Mehrangarh Fort', description: 'One of India\'s largest forts on a clifftop', timeSlot: 'afternoon', duration: 2.5, category: 'monument', rating: 4.9 },
          { name: 'Blue City Walk', description: 'Wander through the blue-painted old city lanes', timeSlot: 'evening', duration: 2, category: 'cultural', rating: 4.6 },
        ],
      },
      {
        dayNumber: 3,
        title: 'Day 3 - Jodhpur & Jaisalmer',
        theme: 'Markets and desert journey',
        activities: [
          { name: 'Sardar Market', description: 'Vibrant market near the clock tower', timeSlot: 'morning', duration: 1.5, category: 'market', rating: 4.3 },
          { name: 'Jodhpur to Jaisalmer', description: '5-hour drive to the Golden City', timeSlot: 'morning', duration: 3, category: 'adventure', rating: 4.2 },
          { name: 'Jaisalmer Fort', description: 'Living fort with shops and homes inside', timeSlot: 'afternoon', duration: 2, category: 'monument', rating: 4.8 },
          { name: 'Patwon Ki Haveli', description: 'Ornate merchant mansion with intricate carvings', timeSlot: 'evening', duration: 1, category: 'monument', rating: 4.5 },
        ],
      },
      {
        dayNumber: 4,
        title: 'Day 4 - Desert Safari',
        theme: 'Sand dunes and stargazing',
        activities: [
          { name: 'Gadisar Lake', description: 'Serene lake with ornate gateway', timeSlot: 'morning', duration: 1.5, category: 'nature', rating: 4.3 },
          { name: 'Sam Sand Dunes', description: 'Camel safari into the Thar Desert', timeSlot: 'afternoon', duration: 3, category: 'adventure', rating: 4.7 },
          { name: 'Desert Sunset', description: 'Watch the sun set over golden sand dunes', timeSlot: 'evening', duration: 1, category: 'viewpoint', rating: 4.9 },
          { name: 'Desert Camp Dinner', description: 'Traditional Rajasthani dinner under the stars', timeSlot: 'night', duration: 2, category: 'restaurant', rating: 4.6 },
        ],
      },
      {
        dayNumber: 5,
        title: 'Day 5 - Udaipur (City of Lakes)',
        theme: 'Romantic lakeside city',
        activities: [
          { name: 'Jaisalmer to Udaipur', description: 'Drive or fly to the Lake City', timeSlot: 'morning', duration: 3, category: 'adventure', rating: 4.0 },
          { name: 'City Palace Udaipur', description: 'Grand palace complex on Lake Pichola', timeSlot: 'afternoon', duration: 2, category: 'monument', rating: 4.7 },
          { name: 'Lake Pichola Boat Ride', description: 'Sunset boat ride past Jag Mandir', timeSlot: 'evening', duration: 1.5, category: 'adventure', rating: 4.8 },
          { name: 'Ambrai Ghat', description: 'Dinner with views of the illuminated palace', timeSlot: 'night', duration: 2, category: 'restaurant', rating: 4.5 },
        ],
      },
    ],
  },
  {
    id: 'kerala-3d',
    name: 'Kerala Backwater Bliss',
    tagline: 'Backwaters, tea gardens & beaches',
    destination: 'Kochi',
    duration: '3 Days',
    durationDays: 3,
    budget: 'moderate',
    tripType: 'leisure',
    tags: ['Backwaters', 'Ayurveda', 'Nature'],
    gradient: ['#06B6D4', '#0891b2'],
    emoji: '\uD83D\uDEF6',
    days: [
      {
        dayNumber: 1,
        title: 'Day 1 - Fort Kochi',
        theme: 'Colonial charm & seafood',
        activities: [
          { name: 'Chinese Fishing Nets', description: 'Iconic cantilevered fishing nets at the harbor', timeSlot: 'morning', duration: 1, category: 'cultural', rating: 4.5 },
          { name: 'Mattancherry Palace', description: 'Dutch Palace with Kerala murals', timeSlot: 'morning', duration: 1.5, category: 'cultural', rating: 4.3 },
          { name: 'Jew Town & Synagogue', description: 'Historic spice market and ancient synagogue', timeSlot: 'afternoon', duration: 2, category: 'cultural', rating: 4.4 },
          { name: 'Fort Kochi Beach', description: 'Evening walk along the waterfront', timeSlot: 'evening', duration: 1.5, category: 'beach', rating: 4.2 },
          { name: 'Seafood at Fort House', description: 'Fresh catch of the day by the water', timeSlot: 'night', duration: 1.5, category: 'restaurant', rating: 4.5 },
        ],
      },
      {
        dayNumber: 2,
        title: 'Day 2 - Alleppey Backwaters',
        theme: 'Houseboat cruise & village life',
        activities: [
          { name: 'Kochi to Alleppey', description: 'Drive to the Venice of the East', timeSlot: 'morning', duration: 1.5, category: 'adventure', rating: 4.0 },
          { name: 'Houseboat Cruise', description: 'Float through palm-fringed canals on a kettuvallam', timeSlot: 'morning', duration: 4, category: 'adventure', rating: 4.9 },
          { name: 'Village Walk', description: 'Walk through backwater villages and paddy fields', timeSlot: 'afternoon', duration: 1.5, category: 'cultural', rating: 4.4 },
          { name: 'Houseboat Dinner', description: 'Kerala sadya (feast) on the houseboat', timeSlot: 'evening', duration: 2, category: 'restaurant', rating: 4.7 },
        ],
      },
      {
        dayNumber: 3,
        title: 'Day 3 - Munnar Tea Country',
        theme: 'Tea gardens & mountain views',
        activities: [
          { name: 'Alleppey to Munnar', description: 'Scenic 4-hour drive through Western Ghats', timeSlot: 'morning', duration: 3, category: 'adventure', rating: 4.5 },
          { name: 'Tea Museum', description: 'Learn about tea processing with tasting', timeSlot: 'afternoon', duration: 1.5, category: 'cultural', rating: 4.3 },
          { name: 'Eravikulam National Park', description: 'Home of the endangered Nilgiri Tahr', timeSlot: 'afternoon', duration: 2, category: 'nature', rating: 4.6 },
          { name: 'Tea Garden Sunset', description: 'Watch golden hour over rolling tea estates', timeSlot: 'evening', duration: 1, category: 'viewpoint', rating: 4.8 },
        ],
      },
    ],
  },
];
