// A real photo for a card whose listing came without one, so no activity,
// package or booking card is left as a flat colour block. In order:
//   1. the photo of the country it names (a Singapore package gets Singapore),
//   2. a photo matching what it is about (trek, beach, temple, food…) from
//      Prayana's own place photos on the prayanaai.com CDN,
//   3. a neutral travel shot that shows no particular place, so it can't
//      mislabel a destination — the same one every time for the same item.
import { countryImageForText } from './countryAssets';

const CDN = 'https://prayanaai.com/images/place-names';

const THEMES: { words: RegExp; img: string }[] = [
  { words: /trek|hik|mountain|himalay|camp|adventure|paraglid|rafting|ski|climb|zipline|bungee/i, img: `${CDN}/pangong-lake-ladakh/pangong-lake-ladakh/img-1_google_places_ffc2c9f2.jpg` },
  { words: /beach|scuba|snorkel|dive|diving|surf|kayak|water ?sport|cruise|boat|island|sail/i, img: `${CDN}/radhanagar-beach-andaman/radhanagar-beach-andaman/img-1_google_places_a27f543b.jpg` },
  { words: /temple|darshan|yatra|pilgrim|spiritual|monaster|church|mosque|aarti|ghat/i, img: `${CDN}/kathmandu-durbar-square/kathmandu-durbar-square/img-1_google_places_d3ce129a.jpg` },
  { words: /fort|palace|heritage|histor|museum|monument|ruins|culture|cultural/i, img: `${CDN}/hampi-vijayanagara/hampi-vijayanagara/img-1_google_places_b3ad6f06.jpg` },
  { words: /food|cook|culinary|dining|tasting|street food|cafe|wine|brew|market/i, img: `${CDN}/pondicherry-french-quarter/pondicherry-french-quarter/img-1_google_places_7337f475.jpg` },
  { words: /safari|wildlife|jungle|tiger|bird|nature|forest|national park|tea|plantation/i, img: `${CDN}/munnar-tea-gardens/munnar-tea-gardens/img-1_google_places_8fdbe5b7.jpg` },
  { words: /spa|yoga|wellness|ayurved|retreat|meditat/i, img: `${CDN}/couple-coorg-coffee-plantation/couple-coorg-coffee-plantation/img-1_google_places_d7e1988e.jpg` },
  { words: /photo|sunset|lake|romantic|honeymoon|couple/i, img: `${CDN}/couple-lake-pichola-udaipur-sunset/couple-lake-pichola-udaipur-sunset/img-1_google_places_00e1e970.jpg` },
  { words: /city|walk|tour|sightseeing|transfer|cab|bus|nightlife|shopping/i, img: `${CDN}/shimla-mall-road/shimla-mall-road/img-1_google_places_fc10ac43.jpg` },
];

const GENERAL = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1000&q=75', // map and camera
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1000&q=75', // plane wing above clouds
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1000&q=75', // road trip
];

function textOf(item: any): string {
  if (!item) return '';
  const parts = [
    item.title, item.name, item.category, item.subCategory, item.type, item.theme,
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(item.categories) ? item.categories : []),
    item.location?.city, item.location?.country, item.city, item.country, item.destination,
    ...(Array.isArray(item.destinations) ? item.destinations.map((d: any) => (typeof d === 'string' ? d : d?.name || d?.city)) : []),
  ];
  return parts.filter((p) => typeof p === 'string').join(' ');
}

export function fallbackPhoto(item: any): string {
  const text = textOf(item);
  const country = countryImageForText(text);
  if (country) return country;
  const hit = THEMES.find((t) => t.words.test(text));
  if (hit) return hit.img;
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return GENERAL[Math.abs(h) % GENERAL.length];
}
