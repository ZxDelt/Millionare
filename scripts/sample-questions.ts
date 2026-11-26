import type { CategoryId, Difficulty } from "../src/lib/constants";

interface Sample {
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
  difficulty: Difficulty;
  category: CategoryId;
  explanation: string;
}

/** 18 starter questions (6 per tier): enough for one full 16-question session. Replace via the admin bank. */
export const SAMPLE_QUESTIONS: Sample[] = [
  // Easy
  { text: "What is the main source of energy for life on Earth?", options: ["The Moon", "The Sun", "Volcanoes", "Ocean tides"], correctIndex: 1, difficulty: "easy", category: "origins", explanation: "Sunlight drives photosynthesis, weather and the water cycle. Almost all energy on Earth traces back to the Sun." },
  { text: "What is the SI unit of energy?", options: ["Watt", "Newton", "Joule", "Volt"], correctIndex: 2, difficulty: "easy", category: "laws", explanation: "The joule (J) is the SI unit of energy. A watt is one joule per second (power)." },
  { text: "Which of these is a renewable energy source?", options: ["Coal", "Wind", "Natural gas", "Petroleum"], correctIndex: 1, difficulty: "easy", category: "renewables", explanation: "Wind is replenished naturally. Coal, gas and oil took millions of years to form and run out." },
  { text: "The energy an object has because it is moving is called…", options: ["Kinetic energy", "Potential energy", "Chemical energy", "Nuclear energy"], correctIndex: 0, difficulty: "easy", category: "forms", explanation: "Kinetic energy = ½mv². It depends on mass and speed." },
  { text: "Solar panels convert sunlight directly into…", options: ["Sound", "Wind", "Electricity", "Coal"], correctIndex: 2, difficulty: "easy", category: "renewables", explanation: "Photovoltaic cells turn light into electric current through the photovoltaic effect." },
  { text: "In what form is energy stored in the food we eat?", options: ["Magnetic", "Nuclear", "Kinetic", "Chemical"], correctIndex: 3, difficulty: "easy", category: "forms", explanation: "Food stores chemical energy in molecular bonds, which the body releases through respiration." },

  // Medium
  { text: "Which process powers the Sun?", options: ["Nuclear fission", "Nuclear fusion", "Burning gas", "Radioactive decay"], correctIndex: 1, difficulty: "medium", category: "origins", explanation: "In the Sun's core, hydrogen nuclei fuse into helium, releasing enormous energy." },
  { text: "Coal formed mainly from the remains of…", options: ["Ancient plants", "Dinosaur bones", "Volcanic ash", "Sea salt"], correctIndex: 0, difficulty: "medium", category: "fossil", explanation: "Coal formed from swamp plants buried and compressed over millions of years." },
  { text: "The first law of thermodynamics says energy is…", options: ["Always increasing", "Created by motion", "Neither created nor destroyed", "Destroyed as heat"], correctIndex: 2, difficulty: "medium", category: "laws", explanation: "Energy is conserved. It only changes form, for example chemical → heat → motion." },
  { text: "Why is electricity sent over long distances at high voltage?", options: ["To reduce energy losses", "To increase the current", "To make it safer at home", "To speed up electrons"], correctIndex: 0, difficulty: "medium", category: "grid", explanation: "Higher voltage means lower current for the same power, and resistive loss scales with current squared (I²R)." },
  { text: "Burning fossil fuels mainly produces water and which gas?", options: ["Oxygen", "Helium", "Nitrogen", "Carbon dioxide"], correctIndex: 3, difficulty: "medium", category: "fossil", explanation: "Hydrocarbons + oxygen → carbon dioxide + water + energy." },
  { text: "A hydroelectric dam turns which energy into electricity?", options: ["Chemical energy", "Gravitational potential energy of water", "Nuclear energy", "Sound energy"], correctIndex: 1, difficulty: "medium", category: "renewables", explanation: "Water stored high up falls through turbines, converting potential → kinetic → electrical energy." },

  // Hard
  { text: "Most nuclear power reactors split atoms of which isotope?", options: ["Uranium-238", "Carbon-14", "Uranium-235", "Hydrogen-1"], correctIndex: 2, difficulty: "hard", category: "nuclear", explanation: "U-235 is fissile with slow neutrons. Natural uranium is ~0.7% U-235, so reactor fuel is enriched." },
  { text: "In E = mc², what does 'c' stand for?", options: ["Speed of light", "Electric charge", "Heat capacity", "Current"], correctIndex: 0, difficulty: "hard", category: "nuclear", explanation: "c is the speed of light (~3×10⁸ m/s), so a tiny mass equals a huge amount of energy." },
  { text: "What sets the maximum possible efficiency of a heat engine?", options: ["Ohm's law", "Hooke's law", "Boyle's law", "Carnot efficiency"], correctIndex: 3, difficulty: "hard", category: "laws", explanation: "Carnot efficiency = 1 − T_cold/T_hot (in kelvin). No real engine can beat it." },
  { text: "How many joules are in one kilowatt-hour?", options: ["1,000", "3,600", "60,000", "3,600,000"], correctIndex: 3, difficulty: "hard", category: "laws", explanation: "1 kWh = 1,000 W × 3,600 s = 3.6 million joules." },
  { text: "Which ions move between the electrodes of a lithium-ion battery?", options: ["Sodium ions", "Lithium ions", "Hydrogen ions", "Oxide ions"], correctIndex: 1, difficulty: "hard", category: "storage", explanation: "Lithium ions shuttle between anode and cathode through the electrolyte as the battery charges and discharges." },
  { text: "Hydrogen fusion in the Sun's core mainly produces which element?", options: ["Carbon", "Oxygen", "Helium", "Lithium"], correctIndex: 2, difficulty: "hard", category: "origins", explanation: "The proton–proton chain fuses four hydrogen nuclei into one helium-4 nucleus." },
];
