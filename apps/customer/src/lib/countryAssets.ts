// Country hero imagery + notable cities for the eSIM destination header.
//
// Copied verbatim from the web (utils/countryImages.js and the citiesMap in
// app/esim/[country]/page.jsx) so the two apps show the same photo and the same
// cities for a destination. These are curated reference data, not invented copy.
// A country with no entry simply renders without a photo or a city line.

const COUNTRY_IMAGES: Record<string, string> = {
  US: "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=1600&q=80",
  JP: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1600&q=80",
  TH: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1600&q=80",
  FR: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1600&q=80",
  IT: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=1600&q=80",
  GB: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=80",
  IE: "https://images.unsplash.com/photo-1549918864-48ac978761a4?auto=format&fit=crop&w=1600&q=80",
  SG: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1600&q=80",
  AU: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=1600&q=80",
  AE: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80",
  ES: "https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=1600&q=80",
  DE: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1600&q=80",
  KR: "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1600&q=80",
  IN: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1600&q=80",
  CN: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1600&q=80",
  CA: "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=1600&q=80",
  BR: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1600&q=80",
  MX: "https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&w=1600&q=80",
  TR: "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=1600&q=80",
  EG: "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=1600&q=80",
  GR: "https://images.unsplash.com/photo-1503152394-c571994fd383?auto=format&fit=crop&w=1600&q=80",
  CH: "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=1600&q=80",
  NL: "https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=1600&q=80",
  PT: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1600&q=80",
  VN: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=80",
  ID: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1600&q=80",
  MY: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=1600&q=80",
  PH: "https://images.unsplash.com/photo-1518509562904-e7ef99cddc85?auto=format&fit=crop&w=1600&q=80",
  NZ: "https://images.unsplash.com/photo-1469521669194-babb45599def?auto=format&fit=crop&w=1600&q=80",
  ZA: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=1600&q=80",
  LK: "https://images.unsplash.com/photo-1546708973-b3a52ba50e58?auto=format&fit=crop&w=1600&q=80",
  NP: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1600&q=80",
  MV: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1600&q=80",
};

const CITIES: Record<string, string[]> = {
  US: ["New York", "Los Angeles", "San Francisco"],
  JP: ["Tokyo", "Osaka", "Kyoto"],
  TH: ["Bangkok", "Phuket", "Chiang Mai"],
  FR: ["Paris", "Nice", "Lyon"],
  IT: ["Rome", "Venice", "Florence"],
  GB: ["London", "Edinburgh", "Manchester"],
  SG: ["Singapore City", "Sentosa", "Marina Bay"],
  AU: ["Sydney", "Melbourne", "Brisbane"],
  AE: ["Dubai", "Abu Dhabi", "Sharjah"],
  ES: ["Barcelona", "Madrid", "Seville"],
  DE: ["Berlin", "Munich", "Frankfurt"],
  KR: ["Seoul", "Busan", "Jeju"],
  IN: ["Delhi", "Mumbai", "Bangalore"],
  CN: ["Beijing", "Shanghai", "Guangzhou"],
  CA: ["Toronto", "Vancouver", "Montreal"],
  BR: ["Rio de Janeiro", "Sao Paulo", "Salvador"],
  TR: ["Istanbul", "Ankara", "Antalya"],
  VN: ["Hanoi", "Ho Chi Minh City", "Da Nang"],
  ID: ["Bali", "Jakarta", "Yogyakarta"],
  MY: ["Kuala Lumpur", "Penang", "Langkawi"],
  PH: ["Manila", "Cebu", "Boracay"],
  GR: ["Athens", "Santorini", "Mykonos"],
  PT: ["Lisbon", "Porto", "Faro"],
  NL: ["Amsterdam", "Rotterdam", "The Hague"],
  CH: ["Zurich", "Geneva", "Lucerne"],
  MX: ["Mexico City", "Cancun", "Playa del Carmen"],
  EG: ["Cairo", "Luxor", "Sharm el-Sheikh"],
  NZ: ["Auckland", "Queenstown", "Wellington"],
  LK: ["Colombo", "Kandy", "Galle"],
  MV: ["Male", "Maafushi", "Hulhumale"],
};

export function countryImage(iso?: string): string | null {
  if (!iso) return null;
  return COUNTRY_IMAGES[iso.toUpperCase()] ?? null;
}

export function countryCities(iso?: string): string[] {
  if (!iso) return [];
  return CITIES[iso.toUpperCase()] ?? [];
}
