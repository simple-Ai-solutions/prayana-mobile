// Country hero imagery + notable cities for the eSIM destination header.
//
// Copied verbatim from the web (utils/countryImages.js and the citiesMap in
// app/esim/[country]/page.jsx) so the two apps show the same photo and the same
// cities for a destination. These are curated reference data, not invented copy.
// Countries outside that list get a Pexels photo (MORE_COUNTRY_IMAGES below).

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

// Every other eSIM country, so no destination card is left with a flag alone.
// Free Pexels photos (Pexels licence: free for commercial use, no attribution
// required), picked per country by landmark or best-known view.
const MORE_COUNTRY_IMAGES: Record<string, string> = {
  AD: "https://images.pexels.com/photos/26558343/pexels-photo-26558343.jpeg?auto=compress&cs=tinysrgb&w=1600", // Beautiful evening view of the illuminated Pont de Paris brid
  AL: "https://images.pexels.com/photos/16142688/pexels-photo-16142688.jpeg?auto=compress&cs=tinysrgb&w=1600", // Iconic view of Gjirokaster Fortress featuring the Albanian f
  AM: "https://images.pexels.com/photos/34272060/pexels-photo-34272060.jpeg?auto=compress&cs=tinysrgb&w=1600", // Historic Matenadaran library in Yerevan
  AR: "https://images.pexels.com/photos/18005787/pexels-photo-18005787.jpeg?auto=compress&cs=tinysrgb&w=1600", // Scenic view of a monument in Buenos Aires surrounded by gree
  AT: "https://images.pexels.com/photos/19343897/pexels-photo-19343897.jpeg?auto=compress&cs=tinysrgb&w=1600", // Elegant view of the Hofburg Palace's dome and facade in Vien
  AZ: "https://images.pexels.com/photos/26110608/pexels-photo-26110608.jpeg?auto=compress&cs=tinysrgb&w=1600", // Discover the architectural charm of Baku Railway Station in
  BA: "https://images.pexels.com/photos/20813436/pexels-photo-20813436.jpeg?auto=compress&cs=tinysrgb&w=1600", // View of the iconic Stari Most bridge and historical architec
  BD: "https://images.pexels.com/photos/35873035/pexels-photo-35873035.jpeg?auto=compress&cs=tinysrgb&w=1600", // View of colorful buildings and mosque along riverbank in Dha
  BE: "https://images.pexels.com/photos/16922917/pexels-photo-16922917.jpeg?auto=compress&cs=tinysrgb&w=1600", // Ornate facade of the historical Leuven Town Hall in Belgium.
  BG: "https://images.pexels.com/photos/28702047/pexels-photo-28702047.jpeg?auto=compress&cs=tinysrgb&w=1600", // The iconic domes of Alexander Nevsky Cathedral against a cle
  BH: "https://images.pexels.com/photos/6188071/pexels-photo-6188071.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning night view of Bahrain World Trade Center with clear
  BO: "https://images.pexels.com/photos/4226515/pexels-photo-4226515.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stone monument at Salar de Uyuni celebrating the Dakar Rally
  BW: "https://images.pexels.com/photos/5125390/pexels-photo-5125390.jpeg?auto=compress&cs=tinysrgb&w=1600", // Silhouette of an elephant by a riverbank during a vibrant or
  BY: "https://images.pexels.com/photos/16120386/pexels-photo-16120386.jpeg?auto=compress&cs=tinysrgb&w=1600", // View of the historic Holy Spirit Cathedral surrounded by urb
  CI: "https://images.pexels.com/photos/19891960/pexels-photo-19891960.jpeg?auto=compress&cs=tinysrgb&w=1600", // View of Basilica of Our Lady of Peace in Yamoussoukro
  CL: "https://images.pexels.com/photos/19953067/pexels-photo-19953067.jpeg?auto=compress&cs=tinysrgb&w=1600", // A stunning aerial view of the Clock Tower in Plaza Prat
  CM: "https://images.pexels.com/photos/31326470/pexels-photo-31326470.jpeg?auto=compress&cs=tinysrgb&w=1600", // Lush green agricultural fields and hills in Foumbot
  CO: "https://images.pexels.com/photos/19676273/pexels-photo-19676273.jpeg?auto=compress&cs=tinysrgb&w=1600", // Capture of the classical dome against a vibrant blue sky in
  CR: "https://images.pexels.com/photos/10614098/pexels-photo-10614098.jpeg?auto=compress&cs=tinysrgb&w=1600", // A serene waterfall cascades through dense forest greenery in
  CY: "https://images.pexels.com/photos/460370/pexels-photo-460370.jpeg?auto=compress&cs=tinysrgb&w=1600", // A picturesque historic church in Cyprus at sunset
  CZ: "https://images.pexels.com/photos/38472452/pexels-photo-38472452.jpeg?auto=compress&cs=tinysrgb&w=1600", // St. Vitus Cathedral in Prague captured during a clear day wi
  DK: "https://images.pexels.com/photos/16716379/pexels-photo-16716379.jpeg?auto=compress&cs=tinysrgb&w=1600", // Nyhavn's vibrant waterfront and boats reflected at dusk in C
  DO: "https://images.pexels.com/photos/149667/pexels-photo-149667.jpeg?auto=compress&cs=tinysrgb&w=1600", // Tranquil beach scene in Punta Cana
  DZ: "https://images.pexels.com/photos/8826278/pexels-photo-8826278.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning view of Martyrs Memorial
  EC: "https://images.pexels.com/photos/18506912/pexels-photo-18506912.jpeg?auto=compress&cs=tinysrgb&w=1600", // Capture of the Basilica del Voto Nacional
  EE: "https://images.pexels.com/photos/23227692/pexels-photo-23227692.jpeg?auto=compress&cs=tinysrgb&w=1600", // Scenic aerial view of Tallinn's old town with historic tower
  EU: "https://images.pexels.com/photos/16785486/pexels-photo-16785486.jpeg?auto=compress&cs=tinysrgb&w=1600", // Iconic Louvre Pyramid in Paris
  FI: "https://images.pexels.com/photos/5072366/pexels-photo-5072366.jpeg?auto=compress&cs=tinysrgb&w=1600", // A frontal view of the iconic Helsinki Cathedral featuring ne
  FO: "https://images.pexels.com/photos/38771665/pexels-photo-38771665.jpeg?auto=compress&cs=tinysrgb&w=1600", // A tranquil scene of a Faroese church set against a lush moun
  GE: "https://images.pexels.com/photos/19063133/pexels-photo-19063133.jpeg?auto=compress&cs=tinysrgb&w=1600", // A stunning aerial view capturing the Holy Trinity Cathedral
  GG: "https://images.pexels.com/photos/802121/pexels-photo-802121.jpeg?auto=compress&cs=tinysrgb&w=1600", // Rugged fort along Guernsey's rocky coast with dramatic cloud
  GH: "https://images.pexels.com/photos/37539846/pexels-photo-37539846.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning view of the Kwame Nkrumah Mausoleum and fountain st
  GI: "https://images.pexels.com/photos/12073658/pexels-photo-12073658.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning landscape of the Rock of Gibraltar with a clear blu
  GT: "https://images.pexels.com/photos/33680800/pexels-photo-33680800.jpeg?auto=compress&cs=tinysrgb&w=1600", // Elegant ancient brick arches of a historic ruin in Antígua
  HK: "https://images.pexels.com/photos/31713313/pexels-photo-31713313.jpeg?auto=compress&cs=tinysrgb&w=1600", // Cityscape featuring towering high-rise buildings against a m
  HN: "https://images.pexels.com/photos/32644498/pexels-photo-32644498.jpeg?auto=compress&cs=tinysrgb&w=1600", // Wooden pier leading to a serene ocean view under a clear sky
  HR: "https://images.pexels.com/photos/18759975/pexels-photo-18759975.jpeg?auto=compress&cs=tinysrgb&w=1600", // Captivating view of Split's waterfront promenade with palm t
  HU: "https://images.pexels.com/photos/16956695/pexels-photo-16956695.jpeg?auto=compress&cs=tinysrgb&w=1600", // A striking statue in front of a gothic-style church in Budap
  IL: "https://images.pexels.com/photos/30284228/pexels-photo-30284228.jpeg?auto=compress&cs=tinysrgb&w=1600", // Captivating aerial view of the Dome of the Rock with Jerusal
  IM: "https://images.pexels.com/photos/16709931/pexels-photo-16709931.jpeg?auto=compress&cs=tinysrgb&w=1600", // A picturesque view of Peel marina and town on the Isle of Ma
  IS: "https://images.pexels.com/photos/19320678/pexels-photo-19320678.jpeg?auto=compress&cs=tinysrgb&w=1600", // Beautiful Hofskirkja church with distinctive grass roof nest
  JE: "https://images.pexels.com/photos/36768908/pexels-photo-36768908.jpeg?auto=compress&cs=tinysrgb&w=1600", // Scenic view of rocky coastline with waves crashing at Corbie
  JM: "https://images.pexels.com/photos/4093927/pexels-photo-4093927.jpeg?auto=compress&cs=tinysrgb&w=1600", // Old stone structure with arched entrance surrounded by palm
  JO: "https://images.pexels.com/photos/18717579/pexels-photo-18717579.jpeg?auto=compress&cs=tinysrgb&w=1600", // Majestic view of the Temple of Hercules ruins against Amman'
  KE: "https://images.pexels.com/photos/9833517/pexels-photo-9833517.jpeg?auto=compress&cs=tinysrgb&w=1600", // Scenic skyline view of Nairobi cityscape with iconic skyscra
  KG: "https://images.pexels.com/photos/17533368/pexels-photo-17533368.jpeg?auto=compress&cs=tinysrgb&w=1600", // Tash Rabat caravanserai amidst lush Kyrgyz mountains under a
  KW: "https://images.pexels.com/photos/37721726/pexels-photo-37721726.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning view of modern skyscrapers in Kuwait City
  KZ: "https://images.pexels.com/photos/18549878/pexels-photo-18549878.jpeg?auto=compress&cs=tinysrgb&w=1600", // Majestic view of Astana's iconic architecture glowing agains
  LA: "https://images.pexels.com/photos/35324128/pexels-photo-35324128.jpeg?auto=compress&cs=tinysrgb&w=1600", // Magnificent golden Buddha statue in Laos
  LI: "https://images.pexels.com/photos/5742914/pexels-photo-5742914.jpeg?auto=compress&cs=tinysrgb&w=1600", // Historic Vaduz government building with classic architecture
  LT: "https://images.pexels.com/photos/20303298/pexels-photo-20303298.jpeg?auto=compress&cs=tinysrgb&w=1600", // A beautiful view of Vilnius city featuring historic architec
  LU: "https://images.pexels.com/photos/19909061/pexels-photo-19909061.jpeg?auto=compress&cs=tinysrgb&w=1600", // Scenic view of the iconic Adolphe Bridge amidst fall foliage
  LV: "https://images.pexels.com/photos/20265417/pexels-photo-20265417.jpeg?auto=compress&cs=tinysrgb&w=1600", // Aerial view of Riga
  MA: "https://images.pexels.com/photos/15260622/pexels-photo-15260622.jpeg?auto=compress&cs=tinysrgb&w=1600", // El Badi Palace in Marrakech under a clear blue sky with a re
  MD: "https://images.pexels.com/photos/13076747/pexels-photo-13076747.jpeg?auto=compress&cs=tinysrgb&w=1600", // The iconic bell tower in Chișinău's Cathedral Park during a
  ME: "https://images.pexels.com/photos/12199361/pexels-photo-12199361.jpeg?auto=compress&cs=tinysrgb&w=1600", // Explore the historic Our Lady of the Rocks Church
  MG: "https://images.pexels.com/photos/10879824/pexels-photo-10879824.jpeg?auto=compress&cs=tinysrgb&w=1600", // Breathtaking view of rocky terrain and lush greenery under a
  MK: "https://images.pexels.com/photos/17826810/pexels-photo-17826810.jpeg?auto=compress&cs=tinysrgb&w=1600", // Monument of Alexander the Great in central Skopje
  MM: "https://images.pexels.com/photos/16735991/pexels-photo-16735991.jpeg?auto=compress&cs=tinysrgb&w=1600", // Capture of the iconic Shwedagon Pagoda with visitors
  MO: "https://images.pexels.com/photos/38236758/pexels-photo-38236758.jpeg?auto=compress&cs=tinysrgb&w=1600", // Explore the dazzling lights and vibrant nightlife of Casino
  MT: "https://images.pexels.com/photos/18021128/pexels-photo-18021128.jpeg?auto=compress&cs=tinysrgb&w=1600", // A striking lighthouse stands by ancient fortifications on th
  MU: "https://images.pexels.com/photos/36731899/pexels-photo-36731899.jpeg?auto=compress&cs=tinysrgb&w=1600", // A tranquil coastal scene of Le Morne Brabant
  MZ: "https://images.pexels.com/photos/33516340/pexels-photo-33516340.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning aerial view of Maputo
  NG: "https://images.pexels.com/photos/37405043/pexels-photo-37405043.jpeg?auto=compress&cs=tinysrgb&w=1600", // Scenic view of Lagos skyline featuring modern buildings and
  NI: "https://images.pexels.com/photos/5274756/pexels-photo-5274756.jpeg?auto=compress&cs=tinysrgb&w=1600", // Aerial shot of the Old Cathedral of Managua
  NO: "https://images.pexels.com/photos/31265162/pexels-photo-31265162.jpeg?auto=compress&cs=tinysrgb&w=1600", // Historic Uvdal Stave Church in Uvdal
  OM: "https://images.pexels.com/photos/27222917/pexels-photo-27222917.jpeg?auto=compress&cs=tinysrgb&w=1600", // Sultan Qaboos Grand Mosque with its striking minarets agains
  PE: "https://images.pexels.com/photos/12190502/pexels-photo-12190502.jpeg?auto=compress&cs=tinysrgb&w=1600", // A bustling Plaza Mayor in Lima showcasing the historic Cathe
  PK: "https://images.pexels.com/photos/13239874/pexels-photo-13239874.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning daytime capture of Minar-e-Pakistan surrounded by l
  PL: "https://images.pexels.com/photos/37459506/pexels-photo-37459506.jpeg?auto=compress&cs=tinysrgb&w=1600", // Explore the historic and vibrant architecture of Kraków's Ma
  PR: "https://images.pexels.com/photos/15261778/pexels-photo-15261778.jpeg?auto=compress&cs=tinysrgb&w=1600", // Historic guard tower with ocean view
  PY: "https://images.pexels.com/photos/33018884/pexels-photo-33018884.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning view of the Basilica of Our Lady in Caacupé during
  QA: "https://images.pexels.com/photos/18845396/pexels-photo-18845396.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning view of the illuminated Museum of Islamic Art in Do
  RO: "https://images.pexels.com/photos/16942576/pexels-photo-16942576.jpeg?auto=compress&cs=tinysrgb&w=1600", // Scenic view of a colorful rainbow over the Orthodox Cathedra
  RS: "https://images.pexels.com/photos/28874149/pexels-photo-28874149.jpeg?auto=compress&cs=tinysrgb&w=1600", // Captivating view of the Temple of Saint Sava under a clear b
  RU: "https://images.pexels.com/photos/16849573/pexels-photo-16849573.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning view of St. Basil's Cathedral
  SA: "https://images.pexels.com/photos/27291499/pexels-photo-27291499.jpeg?auto=compress&cs=tinysrgb&w=1600", // View of the iconic Abraj Al Bait and Mecca Clock Tower with
  SE: "https://images.pexels.com/photos/30158443/pexels-photo-30158443.jpeg?auto=compress&cs=tinysrgb&w=1600", // Skyline of Stockholm with historic architecture reflecting o
  SI: "https://images.pexels.com/photos/11003575/pexels-photo-11003575.jpeg?auto=compress&cs=tinysrgb&w=1600", // Picturesque view of Bled Castle and St. Martin's Church with
  SK: "https://images.pexels.com/photos/39205719/pexels-photo-39205719.jpeg?auto=compress&cs=tinysrgb&w=1600", // A breathtaking aerial view of historic Orava Castle surround
  SM: "https://images.pexels.com/photos/36930262/pexels-photo-36930262.jpeg?auto=compress&cs=tinysrgb&w=1600", // Discover San Marino's historic fortress perched dramatically
  SN: "https://images.pexels.com/photos/24509379/pexels-photo-24509379.jpeg?auto=compress&cs=tinysrgb&w=1600", // The Grand Mosque of Touba
  SV: "https://images.pexels.com/photos/36708470/pexels-photo-36708470.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning aerial shot of San Salvador's cityscape centering o
  TN: "https://images.pexels.com/photos/29821323/pexels-photo-29821323.jpeg?auto=compress&cs=tinysrgb&w=1600", // Explore the historic Roman ruins of Uthina
  TW: "https://images.pexels.com/photos/11772614/pexels-photo-11772614.jpeg?auto=compress&cs=tinysrgb&w=1600", // View of Taichung City Hall surrounded by palm trees and bicy
  TZ: "https://images.pexels.com/photos/36468248/pexels-photo-36468248.jpeg?auto=compress&cs=tinysrgb&w=1600", // Idyllic white sand beach and azure ocean under clear skies i
  UA: "https://images.pexels.com/photos/15685014/pexels-photo-15685014.jpeg?auto=compress&cs=tinysrgb&w=1600", // Aerial view of Kyiv city with striking clouds and sunset lig
  UG: "https://images.pexels.com/photos/31939652/pexels-photo-31939652.jpeg?auto=compress&cs=tinysrgb&w=1600", // Lush greenery and river view in Murchison Falls National Par
  UY: "https://images.pexels.com/photos/34965647/pexels-photo-34965647.jpeg?auto=compress&cs=tinysrgb&w=1600", // Stunning view of Palacio Salvo in Montevideo
  UZ: "https://images.pexels.com/photos/19439173/pexels-photo-19439173.jpeg?auto=compress&cs=tinysrgb&w=1600", // Explore the stunning mosaic patterns and domes of Shah-i-Zin
  VA: "https://images.pexels.com/photos/7229228/pexels-photo-7229228.jpeg?auto=compress&cs=tinysrgb&w=1600", // The majestic facade of St. Peter's Basilica in Vatican City
  XK: "https://images.pexels.com/photos/20257296/pexels-photo-20257296.jpeg?auto=compress&cs=tinysrgb&w=1600", // Catholic Cathedral surrounded by modern cityscape in Pristin
  ZM: "https://images.pexels.com/photos/3378996/pexels-photo-3378996.jpeg?auto=compress&cs=tinysrgb&w=1600", // Victoria Falls Bridge gracefully arcs over the lush Batoka G
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

/**
 * The country's photo, requested at `width` px. The table stores 1600px
 * originals for the full-bleed destination hero; a card two-up on a phone
 * needs a fraction of that, and pulling the full size for a dozen cards is
 * what left them black while they downloaded.
 */
export function countryImage(iso?: string, width = 1600): string | null {
  if (!iso) return null;
  const url = COUNTRY_IMAGES[iso.toUpperCase()] ?? MORE_COUNTRY_IMAGES[iso.toUpperCase()];
  return url ? sizedImage(url, width) : null;
}

/** An Unsplash or Pexels URL re-requested at `width` px (other hosts pass through). */
export function sizedImage(url: string, width: number): string {
  return /images\.(unsplash|pexels)\.com/.test(url) ? url.replace(/([?&])w=\d+/, `$1w=${width}`) : url;
}

export function countryCities(iso?: string): string[] {
  if (!iso) return [];
  return CITIES[iso.toUpperCase()] ?? [];
}

// Country and well-known destination names → ISO code, longest first so
// "Abu Dhabi" wins over shorter matches. Used to give a package or activity
// with no photo the photo of the country it is in.
const PLACE_TO_ISO: [string, string][] = [
  ["Bosnia and Herzegovina", "BA"],
  ["Dominican Republic", "DO"],
  ["Czech Republic", "CZ"],
  ["United Kingdom", "GB"],
  ["Faroe Islands", "FO"],
  ["Liechtenstein", "LI"],
  ["Saudi Arabia", "SA"],
  ["South Africa", "ZA"],
  ["Vatican City", "VA"],
  ["Kuala Lumpur", "MY"],
  ["El Salvador", "SV"],
  ["Isle of Man", "IM"],
  ["Ivory Coast", "CI"],
  ["Netherlands", "NL"],
  ["New Zealand", "NZ"],
  ["Philippines", "PH"],
  ["Puerto Rico", "PR"],
  ["South Korea", "KR"],
  ["Switzerland", "CH"],
  ["Ho Chi Minh", "VN"],
  ["Azerbaijan", "AZ"],
  ["Bangladesh", "BD"],
  ["Costa Rica", "CR"],
  ["Kazakhstan", "KZ"],
  ["Kyrgyzstan", "KG"],
  ["Luxembourg", "LU"],
  ["Madagascar", "MG"],
  ["Montenegro", "ME"],
  ["Mozambique", "MZ"],
  ["San Marino", "SM"],
  ["Uzbekistan", "UZ"],
  ["Cappadocia", "TR"],
  ["Seychelles", "SC"],
  ["Masai Mara", "KE"],
  ["Argentina", "AR"],
  ["Australia", "AU"],
  ["Gibraltar", "GI"],
  ["Guatemala", "GT"],
  ["Hong Kong", "HK"],
  ["Indonesia", "ID"],
  ["Lithuania", "LT"],
  ["Macedonia", "MK"],
  ["Mauritius", "MU"],
  ["Nicaragua", "NI"],
  ["Singapore", "SG"],
  ["Sri Lanka", "LK"],
  ["Abu Dhabi", "AE"],
  ["Kathmandu", "NP"],
  ["Santorini", "GR"],
  ["Amsterdam", "NL"],
  ["Barcelona", "ES"],
  ["Melbourne", "AU"],
  ["Cape Town", "ZA"],
  ["Botswana", "BW"],
  ["Bulgaria", "BG"],
  ["Cameroon", "CM"],
  ["Colombia", "CO"],
  ["Guernsey", "GG"],
  ["Honduras", "HN"],
  ["Malaysia", "MY"],
  ["Pakistan", "PK"],
  ["Paraguay", "PY"],
  ["Portugal", "PT"],
  ["Slovakia", "SK"],
  ["Slovenia", "SI"],
  ["Tanzania", "TZ"],
  ["Thailand", "TH"],
  ["Langkawi", "MY"],
  ["Scotland", "GB"],
  ["Istanbul", "TR"],
  ["Budapest", "HU"],
  ["Auckland", "NZ"],
  ["Maldives", "MV"],
  ["Albania", "AL"],
  ["Algeria", "DZ"],
  ["Andorra", "AD"],
  ["Armenia", "AM"],
  ["Austria", "AT"],
  ["Bahrain", "BH"],
  ["Belarus", "BY"],
  ["Belgium", "BE"],
  ["Bolivia", "BO"],
  ["Croatia", "HR"],
  ["Denmark", "DK"],
  ["Ecuador", "EC"],
  ["Estonia", "EE"],
  ["Finland", "FI"],
  ["Georgia", "GE"],
  ["Germany", "DE"],
  ["Hungary", "HU"],
  ["Iceland", "IS"],
  ["Ireland", "IE"],
  ["Jamaica", "JM"],
  ["Moldova", "MD"],
  ["Morocco", "MA"],
  ["Myanmar", "MM"],
  ["Nigeria", "NG"],
  ["Romania", "RO"],
  ["Senegal", "SN"],
  ["Tunisia", "TN"],
  ["Ukraine", "UA"],
  ["Uruguay", "UY"],
  ["Vietnam", "VN"],
  ["Bangkok", "TH"],
  ["Pattaya", "TH"],
  ["England", "GB"],
  ["Tbilisi", "GE"],
  ["Da Nang", "VN"],
  ["Colombo", "LK"],
  ["Pokhara", "NP"],
  ["Thimphu", "BT"],
  ["Nairobi", "KE"],
  ["Brazil", "BR"],
  ["Canada", "CA"],
  ["Cyprus", "CY"],
  ["France", "FR"],
  ["Greece", "GR"],
  ["Israel", "IL"],
  ["Jersey", "JE"],
  ["Jordan", "JO"],
  ["Kosovo", "XK"],
  ["Kuwait", "KW"],
  ["Latvia", "LV"],
  ["Mexico", "MX"],
  ["Norway", "NO"],
  ["Poland", "PL"],
  ["Russia", "RU"],
  ["Serbia", "RS"],
  ["Sweden", "SE"],
  ["Taiwan", "TW"],
  ["Turkey", "TR"],
  ["Uganda", "UG"],
  ["Zambia", "ZM"],
  ["Phuket", "TH"],
  ["London", "GB"],
  ["Zurich", "CH"],
  ["Venice", "IT"],
  ["Almaty", "KZ"],
  ["Bhutan", "BT"],
  ["Athens", "GR"],
  ["Prague", "CZ"],
  ["Vienna", "AT"],
  ["Madrid", "ES"],
  ["Lisbon", "PT"],
  ["Sydney", "AU"],
  ["Chile", "CL"],
  ["China", "CN"],
  ["Egypt", "EG"],
  ["Ghana", "GH"],
  ["Italy", "IT"],
  ["Japan", "JP"],
  ["Kenya", "KE"],
  ["Macau", "MO"],
  ["Malta", "MT"],
  ["Nepal", "NP"],
  ["Qatar", "QA"],
  ["Spain", "ES"],
  ["Dubai", "AE"],
  ["Krabi", "TH"],
  ["Tokyo", "JP"],
  ["Kyoto", "JP"],
  ["Paris", "FR"],
  ["Swiss", "CH"],
  ["Hanoi", "VN"],
  ["Seoul", "KR"],
  ["Cairo", "EG"],
  ["Laos", "LA"],
  ["Oman", "OM"],
  ["Peru", "PE"],
  ["Bali", "ID"],
  ["Rome", "IT"],
  ["Baku", "AZ"],
  ["Paro", "BT"],
  ["Male", "MV"],
  ["UAE", "AE"],
  ["USA", "US"],
  ["UK", "GB"],
];

/** The country photo for the first country or destination named in `text`. */
export function countryImageForText(text?: string, width = 1000): string | null {
  if (!text) return null;
  const hay = ` ${text.toLowerCase()} `;
  for (const [name, iso] of PLACE_TO_ISO) {
    const n = name.toLowerCase();
    const i = hay.indexOf(n);
    if (i > 0 && !/[a-z]/.test(hay[i - 1]) && !/[a-z]/.test(hay[i + n.length] || ' ')) {
      const img = countryImage(iso, width);
      if (img) return img;
    }
  }
  return null;
}
