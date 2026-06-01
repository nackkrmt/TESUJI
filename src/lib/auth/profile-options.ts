// Shared option data for the register Player Profile step.

export const titlePresets = ["นาย", "นาง", "นางสาว", "เด็กชาย", "เด็กหญิง"] as const;

export type TitlePreset = (typeof titlePresets)[number];

// Sentinel dropdown value for a custom, free-typed title.
export const TITLE_OTHER = "อื่น ๆ (โปรดระบุ)";

// Thai title -> English title shown to the user and stored in DB.
// นางสาว and เด็กหญิง both map to "Miss" (unmarried/girl). "อื่นๆ" lets the
// user type their own EN title (e.g. Ms.).
export const titleEnMap: Record<TitlePreset, string> = {
  นาย: "Mr.",
  นาง: "Mrs.",
  นางสาว: "Miss",
  เด็กชาย: "Master",
  เด็กหญิง: "Miss",
};

export function isTitlePreset(value: string): value is TitlePreset {
  return (titlePresets as readonly string[]).includes(value);
}

// Nationality list for the searchable dropdown. Thai first, then Go-playing
// nations, then other common ones. Replace with the official list when ready.
export const nationalityOptions: string[] = [
  "Thai",
  "Japanese",
  "Korean",
  "Chinese",
  "Taiwanese",
  "Hongkonger",
  "Singaporean",
  "Malaysian",
  "Indonesian",
  "Vietnamese",
  "Filipino",
  "Burmese",
  "Lao",
  "Cambodian",
  "Indian",
  "American",
  "Canadian",
  "British",
  "Australian",
  "New Zealander",
  "French",
  "German",
  "Italian",
  "Spanish",
  "Portuguese",
  "Dutch",
  "Belgian",
  "Swiss",
  "Austrian",
  "Russian",
  "Ukrainian",
  "Polish",
  "Czech",
  "Hungarian",
  "Romanian",
  "Swedish",
  "Norwegian",
  "Finnish",
  "Danish",
  "Brazilian",
  "Argentine",
  "Mexican",
  "Turkish",
  "Israeli",
  "Egyptian",
  "South African",
  "Other",
];
