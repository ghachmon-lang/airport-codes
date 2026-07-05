/*
 * United Airlines destinations — starter dataset.
 *
 * FORMAT (one object per airport):
 *   { code: "DEN", city: "Denver", country: "United States", region: "Domestic" }
 *     code    : 3-letter IATA airport code (what's printed on tickets/bags)
 *     city    : the destination name a flight attendant would say
 *     country : country the airport is in
 *     region  : "Hub" | "Domestic" | "International"  (used only for grouping/filtering)
 *
 * HOW TO EDIT:
 *   - Add a line for a new destination, remove one she won't be tested on, or fix a city/code.
 *   - Keep codes UPPERCASE and exactly 3 letters.
 *   - Saving changes here won't wipe her progress — progress is matched by code+direction,
 *     and the app merges new/removed cards on load.
 *
 * ACCURACY NOTE:
 *   This is a curated starter list of United's hubs and many mainline destinations. United's
 *   route map changes over time, so verify against her official United training materials and
 *   correct anything here as needed.
 */

const AIRPORTS = [
  // ---- Hubs ----
  { code: "ORD", city: "Chicago O'Hare", country: "United States", region: "Hub" },
  { code: "DEN", city: "Denver", country: "United States", region: "Hub" },
  { code: "IAH", city: "Houston (Bush)", country: "United States", region: "Hub" },
  { code: "EWR", city: "Newark", country: "United States", region: "Hub" },
  { code: "SFO", city: "San Francisco", country: "United States", region: "Hub" },
  { code: "LAX", city: "Los Angeles", country: "United States", region: "Hub" },
  { code: "IAD", city: "Washington Dulles", country: "United States", region: "Hub" },
  { code: "GUM", city: "Guam", country: "Guam", region: "Hub" },

  // ---- Domestic ----
  { code: "ATL", city: "Atlanta", country: "United States", region: "Domestic" },
  { code: "AUS", city: "Austin", country: "United States", region: "Domestic" },
  { code: "BNA", city: "Nashville", country: "United States", region: "Domestic" },
  { code: "BOS", city: "Boston", country: "United States", region: "Domestic" },
  { code: "BWI", city: "Baltimore", country: "United States", region: "Domestic" },
  { code: "CLE", city: "Cleveland", country: "United States", region: "Domestic" },
  { code: "CLT", city: "Charlotte", country: "United States", region: "Domestic" },
  { code: "CMH", city: "Columbus", country: "United States", region: "Domestic" },
  { code: "CVG", city: "Cincinnati", country: "United States", region: "Domestic" },
  { code: "DAL", city: "Dallas Love Field", country: "United States", region: "Domestic" },
  { code: "DCA", city: "Washington Reagan", country: "United States", region: "Domestic" },
  { code: "DFW", city: "Dallas/Fort Worth", country: "United States", region: "Domestic" },
  { code: "DTW", city: "Detroit", country: "United States", region: "Domestic" },
  { code: "FLL", city: "Fort Lauderdale", country: "United States", region: "Domestic" },
  { code: "HNL", city: "Honolulu", country: "United States", region: "Domestic" },
  { code: "IND", city: "Indianapolis", country: "United States", region: "Domestic" },
  { code: "JAX", city: "Jacksonville", country: "United States", region: "Domestic" },
  { code: "JFK", city: "New York JFK", country: "United States", region: "Domestic" },
  { code: "KOA", city: "Kona", country: "United States", region: "Domestic" },
  { code: "LAS", city: "Las Vegas", country: "United States", region: "Domestic" },
  { code: "LGA", city: "New York LaGuardia", country: "United States", region: "Domestic" },
  { code: "LIH", city: "Lihue (Kauai)", country: "United States", region: "Domestic" },
  { code: "MCI", city: "Kansas City", country: "United States", region: "Domestic" },
  { code: "MCO", city: "Orlando", country: "United States", region: "Domestic" },
  { code: "MDW", city: "Chicago Midway", country: "United States", region: "Domestic" },
  { code: "MEM", city: "Memphis", country: "United States", region: "Domestic" },
  { code: "MIA", city: "Miami", country: "United States", region: "Domestic" },
  { code: "MKE", city: "Milwaukee", country: "United States", region: "Domestic" },
  { code: "MSP", city: "Minneapolis/St. Paul", country: "United States", region: "Domestic" },
  { code: "MSY", city: "New Orleans", country: "United States", region: "Domestic" },
  { code: "OAK", city: "Oakland", country: "United States", region: "Domestic" },
  { code: "OGG", city: "Kahului (Maui)", country: "United States", region: "Domestic" },
  { code: "OMA", city: "Omaha", country: "United States", region: "Domestic" },
  { code: "ONT", city: "Ontario (CA)", country: "United States", region: "Domestic" },
  { code: "ORF", city: "Norfolk", country: "United States", region: "Domestic" },
  { code: "PBI", city: "West Palm Beach", country: "United States", region: "Domestic" },
  { code: "PDX", city: "Portland (OR)", country: "United States", region: "Domestic" },
  { code: "PHL", city: "Philadelphia", country: "United States", region: "Domestic" },
  { code: "PHX", city: "Phoenix", country: "United States", region: "Domestic" },
  { code: "PIT", city: "Pittsburgh", country: "United States", region: "Domestic" },
  { code: "RDU", city: "Raleigh/Durham", country: "United States", region: "Domestic" },
  { code: "RNO", city: "Reno", country: "United States", region: "Domestic" },
  { code: "RSW", city: "Fort Myers", country: "United States", region: "Domestic" },
  { code: "SAN", city: "San Diego", country: "United States", region: "Domestic" },
  { code: "SAT", city: "San Antonio", country: "United States", region: "Domestic" },
  { code: "SEA", city: "Seattle", country: "United States", region: "Domestic" },
  { code: "SJC", city: "San Jose (CA)", country: "United States", region: "Domestic" },
  { code: "SLC", city: "Salt Lake City", country: "United States", region: "Domestic" },
  { code: "SMF", city: "Sacramento", country: "United States", region: "Domestic" },
  { code: "SNA", city: "Santa Ana (Orange County)", country: "United States", region: "Domestic" },
  { code: "STL", city: "St. Louis", country: "United States", region: "Domestic" },
  { code: "TPA", city: "Tampa", country: "United States", region: "Domestic" },
  { code: "ANC", city: "Anchorage", country: "United States", region: "Domestic" },
  { code: "BDL", city: "Hartford", country: "United States", region: "Domestic" },
  { code: "BUF", city: "Buffalo", country: "United States", region: "Domestic" },
  { code: "BUR", city: "Burbank", country: "United States", region: "Domestic" },
  { code: "BZN", city: "Bozeman", country: "United States", region: "Domestic" },
  { code: "CHS", city: "Charleston (SC)", country: "United States", region: "Domestic" },
  { code: "COS", city: "Colorado Springs", country: "United States", region: "Domestic" },
  { code: "ELP", city: "El Paso", country: "United States", region: "Domestic" },
  { code: "GEG", city: "Spokane", country: "United States", region: "Domestic" },
  { code: "GRR", city: "Grand Rapids", country: "United States", region: "Domestic" },
  { code: "ITO", city: "Hilo", country: "United States", region: "Domestic" },
  { code: "JAC", city: "Jackson Hole", country: "United States", region: "Domestic" },
  { code: "MFR", city: "Medford", country: "United States", region: "Domestic" },
  { code: "MTJ", city: "Montrose", country: "United States", region: "Domestic" },
  { code: "PSP", city: "Palm Springs", country: "United States", region: "Domestic" },
  { code: "RIC", city: "Richmond", country: "United States", region: "Domestic" },
  { code: "ROC", city: "Rochester (NY)", country: "United States", region: "Domestic" },
  { code: "SBA", city: "Santa Barbara", country: "United States", region: "Domestic" },
  { code: "SDF", city: "Louisville", country: "United States", region: "Domestic" },
  { code: "SUN", city: "Sun Valley", country: "United States", region: "Domestic" },
  { code: "TUS", city: "Tucson", country: "United States", region: "Domestic" },
  { code: "BOI", city: "Boise", country: "United States", region: "Domestic" },
  { code: "EUG", city: "Eugene", country: "United States", region: "Domestic" },
  { code: "FAT", city: "Fresno", country: "United States", region: "Domestic" },
  { code: "ICT", city: "Wichita", country: "United States", region: "Domestic" },
  { code: "OKC", city: "Oklahoma City", country: "United States", region: "Domestic" },
  { code: "TUL", city: "Tulsa", country: "United States", region: "Domestic" },

  // ---- International: Canada ----
  { code: "YYZ", city: "Toronto", country: "Canada", region: "International" },
  { code: "YVR", city: "Vancouver", country: "Canada", region: "International" },
  { code: "YUL", city: "Montreal", country: "Canada", region: "International" },
  { code: "YYC", city: "Calgary", country: "Canada", region: "International" },
  { code: "YOW", city: "Ottawa", country: "Canada", region: "International" },

  // ---- International: Mexico, Caribbean & Central America ----
  { code: "MEX", city: "Mexico City", country: "Mexico", region: "International" },
  { code: "CUN", city: "Cancun", country: "Mexico", region: "International" },
  { code: "GDL", city: "Guadalajara", country: "Mexico", region: "International" },
  { code: "SJD", city: "Los Cabos", country: "Mexico", region: "International" },
  { code: "PVR", city: "Puerto Vallarta", country: "Mexico", region: "International" },
  { code: "CZM", city: "Cozumel", country: "Mexico", region: "International" },
  { code: "SJU", city: "San Juan", country: "Puerto Rico", region: "International" },
  { code: "STT", city: "St. Thomas", country: "U.S. Virgin Islands", region: "International" },
  { code: "AUA", city: "Aruba", country: "Aruba", region: "International" },
  { code: "NAS", city: "Nassau", country: "Bahamas", region: "International" },
  { code: "MBJ", city: "Montego Bay", country: "Jamaica", region: "International" },
  { code: "PUJ", city: "Punta Cana", country: "Dominican Republic", region: "International" },
  { code: "SDQ", city: "Santo Domingo", country: "Dominican Republic", region: "International" },
  { code: "LIR", city: "Liberia (Costa Rica)", country: "Costa Rica", region: "International" },
  { code: "SJO", city: "San Jose (Costa Rica)", country: "Costa Rica", region: "International" },
  { code: "PTY", city: "Panama City", country: "Panama", region: "International" },
  { code: "GUA", city: "Guatemala City", country: "Guatemala", region: "International" },
  { code: "SAL", city: "San Salvador", country: "El Salvador", region: "International" },
  { code: "BZE", city: "Belize City", country: "Belize", region: "International" },

  // ---- International: South America ----
  { code: "GRU", city: "Sao Paulo", country: "Brazil", region: "International" },
  { code: "GIG", city: "Rio de Janeiro", country: "Brazil", region: "International" },
  { code: "EZE", city: "Buenos Aires", country: "Argentina", region: "International" },
  { code: "SCL", city: "Santiago", country: "Chile", region: "International" },
  { code: "LIM", city: "Lima", country: "Peru", region: "International" },
  { code: "BOG", city: "Bogota", country: "Colombia", region: "International" },
  { code: "UIO", city: "Quito", country: "Ecuador", region: "International" },

  // ---- International: Europe ----
  { code: "LHR", city: "London Heathrow", country: "United Kingdom", region: "International" },
  { code: "CDG", city: "Paris", country: "France", region: "International" },
  { code: "FRA", city: "Frankfurt", country: "Germany", region: "International" },
  { code: "MUC", city: "Munich", country: "Germany", region: "International" },
  { code: "AMS", city: "Amsterdam", country: "Netherlands", region: "International" },
  { code: "FCO", city: "Rome", country: "Italy", region: "International" },
  { code: "MXP", city: "Milan", country: "Italy", region: "International" },
  { code: "MAD", city: "Madrid", country: "Spain", region: "International" },
  { code: "BCN", city: "Barcelona", country: "Spain", region: "International" },
  { code: "ZRH", city: "Zurich", country: "Switzerland", region: "International" },
  { code: "BRU", city: "Brussels", country: "Belgium", region: "International" },
  { code: "LIS", city: "Lisbon", country: "Portugal", region: "International" },
  { code: "DUB", city: "Dublin", country: "Ireland", region: "International" },
  { code: "CPH", city: "Copenhagen", country: "Denmark", region: "International" },
  { code: "ATH", city: "Athens", country: "Greece", region: "International" },
  { code: "BER", city: "Berlin", country: "Germany", region: "International" },
  { code: "EDI", city: "Edinburgh", country: "United Kingdom", region: "International" },
  { code: "KEF", city: "Reykjavik", country: "Iceland", region: "International" },

  // ---- International: Middle East, Africa & Asia-Pacific ----
  { code: "TLV", city: "Tel Aviv", country: "Israel", region: "International" },
  { code: "DXB", city: "Dubai", country: "United Arab Emirates", region: "International" },
  { code: "DOH", city: "Doha", country: "Qatar", region: "International" },
  { code: "AMM", city: "Amman", country: "Jordan", region: "International" },
  { code: "CPT", city: "Cape Town", country: "South Africa", region: "International" },
  { code: "JNB", city: "Johannesburg", country: "South Africa", region: "International" },
  { code: "NRT", city: "Tokyo Narita", country: "Japan", region: "International" },
  { code: "HND", city: "Tokyo Haneda", country: "Japan", region: "International" },
  { code: "ICN", city: "Seoul", country: "South Korea", region: "International" },
  { code: "PVG", city: "Shanghai", country: "China", region: "International" },
  { code: "PEK", city: "Beijing", country: "China", region: "International" },
  { code: "HKG", city: "Hong Kong", country: "Hong Kong", region: "International" },
  { code: "TPE", city: "Taipei", country: "Taiwan", region: "International" },
  { code: "SIN", city: "Singapore", country: "Singapore", region: "International" },
  { code: "MNL", city: "Manila", country: "Philippines", region: "International" },
  { code: "DEL", city: "Delhi", country: "India", region: "International" },
  { code: "BOM", city: "Mumbai", country: "India", region: "International" },
  { code: "BKK", city: "Bangkok", country: "Thailand", region: "International" },
  { code: "SYD", city: "Sydney", country: "Australia", region: "International" },
  { code: "MEL", city: "Melbourne", country: "Australia", region: "International" },
  { code: "BNE", city: "Brisbane", country: "Australia", region: "International" },
  { code: "AKL", city: "Auckland", country: "New Zealand", region: "International" },
];

/*
 * CURRICULUM PRIORITY — the order new destinations are introduced.
 *   Tier 1: the hubs (region "Hub")            — learned first
 *   Tier 2: major cities / flagship gateways   — added next
 *   Tier 3: everything else                    — added last, as she gains control
 *
 * Edit MAJOR_CITIES to move a destination into the "major" group (tier 2).
 * Anything not a hub and not listed here is tier 3.
 */
const MAJOR_CITIES = new Set([
  // Major US metros
  "ATL", "BOS", "JFK", "LGA", "DCA", "BWI", "PHL", "MIA", "FLL", "MCO", "TPA",
  "DFW", "PHX", "LAS", "SAN", "SEA", "PDX", "SLC", "MSP", "DTW", "MDW", "HNL",
  "CLT", "AUS", "BNA", "STL", "MCI",
  // Flagship international gateways
  "LHR", "CDG", "FRA", "MUC", "AMS", "FCO", "MAD", "BCN", "ZRH", "DUB", "LIS",
  "NRT", "HND", "ICN", "HKG", "SIN", "PVG", "PEK", "SYD", "MEX", "CUN",
  "YYZ", "YVR", "GRU", "LIM", "BOG", "TLV", "DXB",
]);

function airportTier(a) {
  if (a.region === "Hub") return 1;
  if (MAJOR_CITIES.has(a.code)) return 2;
  return 3;
}

/*
 * LEARNING UNITS — the journey path. Each unit is a themed "route" of airports
 * that unlocks in order. Sizes 4–8. Every airport in AIRPORTS appears in
 * exactly one unit (validated by tests).
 */
const UNITS = [
  { id: "hubs",       emoji: "⭐", title: "The Hubs",             codes: ["ORD","DEN","IAH","EWR","SFO","LAX","IAD","GUM"] },
  { id: "big-east",   emoji: "🗽", title: "Big East",             codes: ["JFK","LGA","BOS","PHL","DCA","BWI"] },
  { id: "west-stars", emoji: "🌉", title: "West Coast Stars",     codes: ["SEA","PDX","SAN","LAS","PHX","SLC"] },
  { id: "florida",    emoji: "🌴", title: "Sunshine State",       codes: ["MIA","FLL","MCO","TPA","RSW","PBI"] },
  { id: "south",      emoji: "🎸", title: "Southern Charm",       codes: ["ATL","CLT","BNA","RDU","MSY","MEM"] },
  { id: "texas",      emoji: "🤠", title: "Texas & the Plains",   codes: ["AUS","SAT","DAL","DFW","OKC","TUL","ICT"] },
  { id: "midwest",    emoji: "🌽", title: "Midwest Majors",       codes: ["MDW","MSP","DTW","STL","MCI","MKE","IND","OMA"] },
  { id: "lakes",      emoji: "⚓", title: "Great Lakes & Rivers", codes: ["CLE","CMH","CVG","PIT","GRR","BUF","SDF"] },
  { id: "hawaii",     emoji: "🌺", title: "Aloha, Hawaii",        codes: ["HNL","OGG","KOA","LIH","ITO"] },
  { id: "california", emoji: "☀️", title: "California Dreaming",  codes: ["SJC","OAK","SMF","SNA","BUR","ONT","PSP","SBA"] },
  { id: "outposts",   emoji: "🌵", title: "Desert & Sierra",      codes: ["RNO","TUS","ELP","COS","FAT","GEG","BOI"] },
  { id: "frontier",   emoji: "🏔️", title: "Mountains & Frontier", codes: ["JAC","BZN","MTJ","SUN","ANC","EUG","MFR"] },
  { id: "atlantic",   emoji: "🦀", title: "Atlantic Extras",      codes: ["BDL","ROC","RIC","ORF","CHS","JAX"] },
  { id: "canada",     emoji: "🍁", title: "O Canada",             codes: ["YYZ","YVR","YUL","YYC","YOW"] },
  { id: "mexico",     emoji: "🌮", title: "Viva México",          codes: ["MEX","CUN","GDL","SJD","PVR","CZM"] },
  { id: "caribbean",  emoji: "🏝️", title: "Island Hopping",       codes: ["SJU","STT","AUA","NAS","MBJ","PUJ","SDQ"] },
  { id: "central-am", emoji: "🌋", title: "Central America",      codes: ["LIR","SJO","PTY","GUA","SAL","BZE"] },
  { id: "south-am",   emoji: "💃", title: "South America",        codes: ["GRU","GIG","EZE","SCL","LIM","BOG","UIO"] },
  { id: "euro-icons", emoji: "🏰", title: "European Icons",       codes: ["LHR","CDG","FRA","AMS","FCO","MAD"] },
  { id: "euro-2",     emoji: "🚂", title: "Euro Explorer",        codes: ["MUC","MXP","BCN","ZRH","BRU","DUB"] },
  { id: "euro-3",     emoji: "🧭", title: "Europe North & South", codes: ["LIS","CPH","ATH","BER","EDI","KEF"] },
  { id: "mideast",    emoji: "🕌", title: "Middle East & Africa", codes: ["TLV","DXB","DOH","AMM","CPT","JNB"] },
  { id: "east-asia",  emoji: "🏮", title: "East Asia",            codes: ["NRT","HND","ICN","PVG","PEK","HKG","TPE"] },
  { id: "south-asia", emoji: "🛕", title: "South & SE Asia",      codes: ["SIN","MNL","DEL","BOM","BKK"] },
  { id: "oceania",    emoji: "🦘", title: "Down Under",           codes: ["SYD","MEL","BNE","AKL"] },
];

/*
 * CREW NOTES — memory hooks for codes that don't spell their city.
 * Shown when a new code is introduced and after a wrong answer (never during a
 * live question). Codes not listed get an automatic hook when the code matches
 * the city's letters (e.g. "DEN starts DENver").
 */
const HOOKS = {
  ORD: "O'Hare was once ORcharD Field",
  MDW: "MiDWay — Chicago's other airport",
  MSY: "MoiSant stock Yards — New Orleans' old airfield",
  MCO: "McCOy Air Force Base became Orlando's airport",
  BNA: "BerryfieldNAshville",
  CVG: "CoVinGton, Kentucky — just across the river from Cincinnati",
  SDF: "StanDiFord Field — Louisville",
  MCI: "Mid-Continent International — Kansas City",
  GEG: "GEiGer Field — Spokane",
  FAT: "Fresno Air Terminal",
  IAD: "IAD is DIA flipped — Dulles International Airport",
  IAH: "Intercontinental Airport, Houston",
  EWR: "n-EW-a-Rk",
  LGA: "LaGuArdia",
  DCA: "D.C. Airport — Reagan sits right on the Potomac",
  BWI: "Baltimore-Washington International",
  YYZ: "Canadian codes start with Y — YYZ is Toronto",
  YVR: "Y + VancouveR",
  YUL: "Y + UL — Montreal's oddball",
  YYC: "Y + Y-Calgary",
  YOW: "Y + OW — OttaWa",
  OGG: "Named for pilot Bertram HoGG — Maui",
  KOA: "K-O-A: KOnA with a twist",
  ITO: "Think 'hI-TO Hilo'",
  SJD: "San José del cabo — Los Cabos",
  CZM: "CoZuMel",
  GRU: "GuaRUlhos — São Paulo's airport",
  GIG: "Rio's Galeão — the GIG by the beach",
  EZE: "EZEiza — Buenos Aires",
  SCL: "Santiago de ChiLe",
  LHR: "London HeathRow",
  CDG: "Charles De Gaulle — Paris",
  FCO: "Rome FiumiCinO",
  MXP: "Milan MalPensa — think 'Milan eXPo'",
  KEF: "KEFlavík — Reykjavik's airport",
  HND: "HaNeDa — Tokyo downtown",
  NRT: "NaRiTa — Tokyo's big international field",
  ICN: "InCheoN — Seoul",
  PVG: "Shanghai PudonG",
  PEK: "PEKing — Beijing's old name",
  TPE: "TaiPEi",
  BOM: "BOMbay — Mumbai's old name",
  BKK: "BangKoK",
  AKL: "AucKLand",
};

// Make the dataset available both as a plain global (for <script> use) and as a
// module export (handy for tests run under Node).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { AIRPORTS, MAJOR_CITIES, airportTier, UNITS, HOOKS };
}
