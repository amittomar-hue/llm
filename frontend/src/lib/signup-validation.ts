// ─────────────────────────────────────────────────────────────────
// Server-side signup heuristics. Every bot that hit Reverb between
// 2026-06-17 and 2026-06-22 followed the same pattern:
//   • full_name = random 15-25 char mixed-case alphanumeric (e.g.
//     "eYCnJIuTPOvPSKTBUVZU") — no human types that as their name
//   • email = gmail dot-trick (3+ dots in local part) OR scraped
//     corporate inbox + no return sign-in
//   • form submits within a few hundred ms of page render
//   • all hidden form fields filled in (no human sees them)
//
// This file gates signup on all four of those signals. No third-party
// service required. Defense in depth: any one of these catches the
// dumb bots; the combination catches every bot we've actually seen.
// ─────────────────────────────────────────────────────────────────

export interface SignupValidationInput {
  full_name: string;
  email: string;
  honeypot: string | null; // hidden field, MUST be empty
  form_rendered_at: number | null; // client epoch ms when form mounted
  now_ms: number; // server's current epoch ms
}

export type SignupValidationResult =
  | { ok: true }
  | { ok: false; reason: string; code: string };

const MIN_FORM_DWELL_MS = 1500; // humans need ≥1.5s to fill 3 fields
const MAX_FORM_DWELL_MS = 30 * 60 * 1000; // 30 min — page idled

export function validateSignup(input: SignupValidationInput): SignupValidationResult {
  // ── 1. Honeypot ────────────────────────────────────────────────
  // If the hidden field is filled, it's a bot crawling the form and
  // populating every input it finds. Real humans never see this field.
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return { ok: false, reason: "Suspicious form submission", code: "honeypot_filled" };
  }

  // ── 2. Form dwell time ─────────────────────────────────────────
  // Bots submit within milliseconds of fetching the page. Humans take
  // at least 1.5s to type a name+email+password. Reject anything under.
  if (input.form_rendered_at !== null) {
    const dwell = input.now_ms - input.form_rendered_at;
    if (dwell < MIN_FORM_DWELL_MS) {
      return { ok: false, reason: "Form submitted too quickly", code: "dwell_too_short" };
    }
    if (dwell > MAX_FORM_DWELL_MS) {
      // Stale render token — could be a replay attack OR just an idle tab.
      // Reject and tell the user to refresh. Real users will, bots won't bother.
      return { ok: false, reason: "Form session expired — please refresh and try again", code: "dwell_too_long" };
    }
  }

  // ── 3. Name shape ──────────────────────────────────────────────
  // Every bot we've seen used a random gibberish full_name. Real names
  // have spaces (multi-word) OR are short OR have natural casing.
  const nameVerdict = looksLikeBotName(input.full_name);
  if (nameVerdict) {
    return { ok: false, reason: "Name doesn't look valid", code: `name_${nameVerdict}` };
  }

  // ── 4. Email shape ─────────────────────────────────────────────
  // Gmail dot-trick is the most common bot pattern. 3+ dots in the local
  // part of a gmail address = same inbox accessed via a different alias,
  // which is exactly how bots fan signups across "different" accounts.
  const emailVerdict = looksLikeBotEmail(input.email);
  if (emailVerdict) {
    return { ok: false, reason: "Email doesn't look valid", code: `email_${emailVerdict}` };
  }

  return { ok: true };
}

// Returns null if name passes, else a short code identifying the failure.
function looksLikeBotName(rawName: string): string | null {
  const name = rawName.trim();
  if (name.length < 2) return "too_short";
  if (name.length > 80) return "too_long";

  // No alphabetic characters at all — definitely not a real name
  if (!/[a-zA-Z]/.test(name)) return "no_letters";

  // No vowels at all — random consonant clusters are statistically
  // impossible for real names. Exception: short acronyms (≤3 chars).
  if (name.length > 3 && !/[aeiouAEIOU]/.test(name)) return "no_vowels";

  const hasSpace = /\s/.test(name);

  // Long single-word names are the #1 bot signature. Every bot in our
  // sample had 15-25 char gibberish like "eYCnJIuTPOvPSKTBUVZU". Real
  // single-name humans ("Madonna", "Cher", "Christopher", "Aleksandra")
  // top out around 12 chars; even 14-char single names ("Constantinos")
  // are rare. Set the threshold conservatively at 15.
  if (!hasSpace && name.length >= 15) return "single_word_too_long";

  // Case-change density check. Real names follow one of:
  //   Title Case ("Amit Tomar")
  //   all lowercase ("amit tomar")
  //   ALL CAPS ("AMIT TOMAR")
  //   First-letter caps per word ("Nikhilesh Raghu")
  // Bot gibberish has random case throughout: "eYCnJIuTPOvPSKTBUVZU"
  // has 9 case-changes in 20 chars. Real names have at most ~1 change
  // per word (the leading capital letter).
  if (name.length >= 8) {
    let caseChanges = 0;
    for (let i = 1; i < name.length; i++) {
      const prev = name[i - 1];
      const curr = name[i];
      const prevIsLower = /[a-z]/.test(prev);
      const prevIsUpper = /[A-Z]/.test(prev);
      const currIsLower = /[a-z]/.test(curr);
      const currIsUpper = /[A-Z]/.test(curr);
      if ((prevIsLower && currIsUpper) || (prevIsUpper && currIsLower)) {
        caseChanges++;
      }
    }
    // Each space-separated word contributes at most ~1 case change for a
    // properly cased name. So allow up to (wordCount + 1) case changes.
    const wordCount = name.split(/\s+/).length;
    if (caseChanges > wordCount + 1) return "case_random";
  }

  return null;
}

// Returns null if email passes, else a short code identifying the failure.
function looksLikeBotEmail(rawEmail: string): string | null {
  const email = rawEmail.trim().toLowerCase();
  const atIdx = email.indexOf("@");
  if (atIdx < 1 || atIdx === email.length - 1) return "no_at";

  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);

  // ── Gmail dot-trick detection ──────────────────────────────────
  // Gmail treats "a.bc@gmail.com" === "abc@gmail.com" === "a.b.c@gmail.com".
  // Bots exploit this to register 10+ accounts that all route to one inbox.
  // The signature: 3+ dots in the local part, or any double-dot.
  // Real users virtually never put 3+ dots in their gmail username.
  if (domain === "gmail.com" || domain === "googlemail.com") {
    if (/\.\./.test(local)) return "gmail_double_dot";
    const dotCount = (local.match(/\./g) || []).length;
    if (dotCount >= 3) return "gmail_dot_trick";
  }

  // ── Plus-aliasing on freemail ──────────────────────────────────
  // Less aggressive — legit users do use a@gmail.com+tag, so we only
  // flag if the tag is very long (typical bot pattern: random suffix).
  const plusIdx = local.indexOf("+");
  if (plusIdx > 0 && local.slice(plusIdx + 1).length > 15) return "plus_alias_long";

  // ── Known disposable / sketch domains ─────────────────────────
  // Tiny seed list; we can expand later. Most of our bot signups
  // came via real-looking corporate domains rather than disposable
  // providers, so this is belt-and-suspenders, not the primary defense.
  const SKETCH_DOMAINS = new Set([
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
    "throwaway.email",
    "yopmail.com",
    "trashmail.com",
    "sharklasers.com",
    "getnada.com",
    "maildrop.cc",
    "dispostable.com",
  ]);
  if (SKETCH_DOMAINS.has(domain)) return "disposable_domain";

  return null;
}
