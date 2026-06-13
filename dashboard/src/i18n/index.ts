import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import de from "./locales/de.json";
import en from "./locales/en.json";
import gsw from "./locales/gsw.json";

export const SUPPORTED_LANGS = ["en", "de", "gsw"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
      gsw: { translation: gsw },
    },
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGS],
    load: "languageOnly", // a `de-CH` browser resolves to our `de` bundle
    interpolation: { escapeValue: false },
    react: { useSuspense: false }, // resources are bundled, so no async load
    detection: {
      // System/browser language by default; a manual pick is cached and wins.
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "lang",
      caches: ["localStorage"],
    },
  });

// Keep <html lang> in sync for a11y and correct font/hyphenation behaviour.
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language || "en";

/** Map a UI language to a BCP-47 locale for Intl number/date formatting.
 *  Swiss German has no ICU locale, so it borrows Swiss High German. */
export const localeFor = (lng: string): string => {
  const base = (lng || "en").split("-")[0];
  return base === "de" || base === "gsw" ? "de-CH" : "en-US";
};

export default i18n;
