import type { CategoryId } from "./constants";

/**
 * CPCL (Chennai Petroleum Corporation Limited) facts shown after each answer, matched to the question's
 * category. Sources: cpcl.co.in (Manali refinery, products, wind energy, environment pages), iocl.com,
 * mopng.gov.in. Keep every line checkable; add new ones only with a source.
 */
const GENERAL = [
  "CPCL began in 1965 as Madras Refineries Limited, a joint venture of the Government of India, AMOCO and the National Iranian Oil Company.",
  "CPCL's Manali refinery in north Chennai started work in 1969 with a capacity of 2.5 million tonnes of crude oil a year.",
  "Madras Refineries Limited took the name Chennai Petroleum Corporation Limited in 2000 and became a subsidiary of Indian Oil in 2001.",
];

const BY_CATEGORY: Record<CategoryId, string[]> = {
  origins: [
    "Crude oil is ancient sunlight stored in buried plankton and algae. CPCL's Manali refinery turns about 10.5 million tonnes of it into fuels every year.",
  ],
  forms: [
    "At Manali, CPCL's FCC unit cracks heavy oil into lighter, higher-value products such as LPG and petrol.",
    "Besides fuels, CPCL's Manali refinery makes lube base oils, paraffin wax and feedstocks such as propylene for neighbouring industries.",
  ],
  laws: [
    "A refinery is energy conversion at scale: CPCL heats crude oil and separates and reshapes it into LPG, petrol, diesel and more.",
    "CPCL's wax plant at Manali can make 30,000 tonnes of paraffin wax a year, used in candles, matches and waterproofing.",
  ],
  fossil: [
    "CPCL's Manali refinery can process about 10.5 million tonnes of crude oil a year.",
    "Since 1 December 2019, CPCL's Manali refinery has supplied BS-VI petrol and diesel, cleaner fuels with very low sulphur.",
    "CPCL's second refinery is in the Cauvery Basin at Nagapattinam, where a new 9 million-tonne-a-year refinery is planned.",
  ],
  renewables: [
    "In 2007 CPCL built a wind farm near Udumalpet: 22 turbines of 800 kW each, 17.6 MW in all.",
    "CPCL's wind farm was planned to make about 42 million units (kWh) of clean electricity a year.",
  ],
  nuclear: [],
  grid: [
    "Power from CPCL's wind farm is sent through the Tamil Nadu grid and credited to the company's seawater desalination plant.",
  ],
  storage: [
    "CPCL runs a seawater desalination plant of 5.8 million gallons a day, turning sea water into water its refinery can use.",
  ],
};

/** A fact for this category that the game hasn't shown yet; falls back to general CPCL facts. */
export function pickCpclFact(category: string | null, used: readonly string[]): string {
  const own = BY_CATEGORY[category as CategoryId] ?? [];
  const pool = [...own, ...GENERAL].filter((f) => !used.includes(f));
  const fresh = own.find((f) => !used.includes(f));
  if (fresh) return fresh;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : GENERAL[0];
}
