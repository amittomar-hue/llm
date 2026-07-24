// ─────────────────────────────────────────────────────────────────
// Supported output languages. Single source of truth for:
//   • the chat-route's output-language validation + override system message
//   • the InputBar's language picker dropdown
//   • the Web Speech API's recognition.lang setting (BCP-47 codes match
//     what window.SpeechRecognition expects natively)
//
// Picked for B2B marketing reach — the eleven languages below cover ~80%
// of global B2B marketing spend (English/Spanish/Portuguese for the
// Americas; French/German/Italian/Dutch for Europe; Arabic for MENA;
// Hindi for India; Chinese/Japanese for East Asia). Add more by
// appending; the picker auto-grows, the route auto-validates.
//
// Each entry includes a "voice" BCP-47 region tag because Web Speech
// works much better when given a specific locale ("es-MX" beats bare
// "es"). "Auto" is the sentinel — when picked, the LANGUAGE CONTRACT in
// the system prompt handles language matching from the user's message.
// ─────────────────────────────────────────────────────────────────

export interface Language {
  code: string;       // BCP-47 code used by the picker + override
  name: string;       // English display name in the picker
  nativeName: string; // Native-script display name shown below the English label
  flag: string;       // Unicode flag emoji for visual grounding
  voice: string;      // BCP-47 region-tagged code for Web Speech recognition.lang
}

export const AUTO_LANGUAGE: Language = {
  code: "auto",
  name: "Auto",
  nativeName: "Match input",
  flag: "🌐",
  voice: typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US",
};

export const SUPPORTED_LANGUAGES: Language[] = [
  AUTO_LANGUAGE,
  { code: "en",    name: "English",            nativeName: "English",     flag: "🇺🇸", voice: "en-US" },
  { code: "es",    name: "Spanish",            nativeName: "Español",     flag: "🇪🇸", voice: "es-MX" },
  { code: "pt-BR", name: "Portuguese (Brazil)", nativeName: "Português",  flag: "🇧🇷", voice: "pt-BR" },
  { code: "fr",    name: "French",             nativeName: "Français",    flag: "🇫🇷", voice: "fr-FR" },
  { code: "de",    name: "German",             nativeName: "Deutsch",     flag: "🇩🇪", voice: "de-DE" },
  { code: "it",    name: "Italian",            nativeName: "Italiano",    flag: "🇮🇹", voice: "it-IT" },
  { code: "nl",    name: "Dutch",              nativeName: "Nederlands",  flag: "🇳🇱", voice: "nl-NL" },
  { code: "hi",    name: "Hindi",              nativeName: "हिन्दी",       flag: "🇮🇳", voice: "hi-IN" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "中文",      flag: "🇨🇳", voice: "zh-CN" },
  { code: "ja",    name: "Japanese",           nativeName: "日本語",       flag: "🇯🇵", voice: "ja-JP" },
  { code: "ko",    name: "Korean",             nativeName: "한국어",       flag: "🇰🇷", voice: "ko-KR" },
  { code: "ar",    name: "Arabic",             nativeName: "العربية",     flag: "🇸🇦", voice: "ar-SA" },
  { code: "tr",    name: "Turkish",            nativeName: "Türkçe",      flag: "🇹🇷", voice: "tr-TR" },
];

export function getLanguage(code: string): Language {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? AUTO_LANGUAGE;
}

/** Match a navigator.language BCP-47 string (e.g. "en-US", "pt-BR", "hi-IN")
 *  to a SUPPORTED_LANGUAGES code. Tries exact match first (covers pt-BR,
 *  zh-CN), then falls back to the base language tag (covers en-US → "en",
 *  es-MX → "es", hi-IN → "hi", fr-CA → "fr"). Returns "auto" when no match
 *  found so the LANGUAGE CONTRACT's auto-match behavior still applies for
 *  users whose browser is in a language Reverb doesn't support yet. */
export function detectBrowserLanguage(navigatorLang: string | undefined): string {
  if (!navigatorLang) return "auto";
  // 1. Exact BCP-47 match (pt-BR, zh-CN currently)
  if (SUPPORTED_LANGUAGES.some((l) => l.code === navigatorLang)) {
    return navigatorLang;
  }
  // 2. Base language tag — en-US → "en", es-MX → "es", hi-IN → "hi", etc.
  const baseLang = navigatorLang.split("-")[0].toLowerCase();
  if (SUPPORTED_LANGUAGES.some((l) => l.code === baseLang)) {
    return baseLang;
  }
  return "auto";
}
