/** Game text in both languages. Same shape as LocalizedText in @dark/shared. */
export interface Text {
  en: string;
  ru: string;
}

export const text = (en: string, ru: string): Text => ({ en, ru });
