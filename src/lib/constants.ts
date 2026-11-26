export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const CATEGORIES = [
  { id: "origins", label: "Origins of energy" },
  { id: "forms", label: "Forms of energy" },
  { id: "laws", label: "Laws & conversion" },
  { id: "fossil", label: "Fossil fuels" },
  { id: "renewables", label: "Renewables" },
  { id: "nuclear", label: "Nuclear" },
  { id: "grid", label: "Electricity & grid" },
  { id: "storage", label: "Storage & future" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const QUESTION_STATUSES = ["active", "draft"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** Questions one session needs per tier (GDD §6). */
export const SESSION_TIER_NEEDS: Record<Difficulty, number> = { easy: 5, medium: 5, hard: 6 };
