// Kinyarwanda for the page text that is written in English in the code.
// tr("Start practice") gives the Kinyarwanda when that language is chosen and a
// translation exists, otherwise the English. The root layout sets the language
// and re-draws the page when it changes (see __root.tsx).
// First draft: Aime, please check and correct these in this file.
import { RW_PHRASES } from "./phrases-rw";

let active: "en" | "rw" = "en";

export function setActiveLanguage(lang: string) {
  active = lang === "rw" ? "rw" : "en";
}

export function tr(english: string, vars?: Record<string, string | number>): string {
  let s = active === "rw" ? RW_PHRASES[english] ?? english : english;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}

export const activeLanguage = () => active;
