// @ts-check
// Pure logica onder de wachtwoordloze e-mail-OTP-login (PLT-8): code-normalisatie
// en -validatie, de "opnieuw sturen"-afkoeltijd en de naam-check na de allereerste
// login. Bewust los van React/Supabase (zelfde 3-lagen-scheiding als de rest van
// lib/*, zie docs/architectuur.md) zodat dit in node unit-testbaar is
// (tests/otp.test.js) en onder de mutatie-ratchet valt. De React-schil
// (app/(auth)/welcome.js) blijft dun: die roept alleen deze helpers aan.

// De code uit de Supabase-mail is altijd 6 cijfers.
export const OTP_LENGTH = 6;

// Hoe lang "opnieuw sturen" op slot staat na een verzonden code. Bewust korter dan
// de server-side rate limit (Supabase weigert zelf óók te snelle herhaalverzoeken);
// dit is de UX-drempel die dubbeltikken en mail-spam voorkomt.
export const RESEND_COOLDOWN_MS = 30_000;

// Maak van willekeurige invoer (plak-actie met spaties, "123-456", autofill met
// tekst eromheen) de kale cijferreeks, afgekapt op de codelengte. Geschikt als
// onChangeText-filter: het veld kan dan nooit iets anders bevatten dan cijfers.
// Stryker disable next-line StringLiteral: equivalente mutant — élke default zonder
// cijfers (ook een niet-lege string) normaliseert tóch naar ''.
export function normalizeOtpCode(input = '') {
  return String(input).replace(/\D/g, '').slice(0, OTP_LENGTH);
}

// Alleen een complete 6-cijferige code mag naar verifyOtp — een halve code kost
// anders een verificatiepoging (en die zijn server-side gelimiteerd).
export function isValidOtpCode(code) {
  return typeof code === 'string' && new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);
}

// Hoeveel seconden de "opnieuw sturen"-knop nog op slot staat (0 = mag weer).
// `sentAt`/`now` zijn epoch-ms; geen verzonden code (null/undefined) → meteen 0,
// zodat het eerste verzoek nooit geblokkeerd is. Naar boven afgerond: "nog 1 s"
// blijft staan tot de volle seconde echt om is.
export function resendRemainingSeconds(sentAt, now) {
  if (sentAt == null) return 0;
  const left = RESEND_COOLDOWN_MS - (now - sentAt);
  // Stryker disable next-line EqualityOperator: equivalente mutant — bij left === 0
  // geeft de ceil-tak hieronder óók 0 terug.
  if (left <= 0) return 0;
  return Math.ceil(left / 1000);
}

// Mag er opnieuw een code gestuurd worden? (Precies op de grens = ja.)
export function canResend(sentAt, now) {
  return resendRemainingSeconds(sentAt, now) === 0;
}

// Heeft deze (Supabase-)gebruiker nog geen weergavenaam? Een account dat via
// signInWithOtp is ontstaan heeft géén user_metadata.display_name (de profiel-
// trigger valt dan terug op het e-mail-lokaaldeel); wachtwoord-signups zetten de
// naam altijd al bij signUp. De Gate (app/_layout.js) stuurt zo'n gebruiker eerst
// naar /naam. Lege of alleen-spaties-naam telt óók als ontbrekend.
export function needsDisplayName(user) {
  if (!user) return false;
  const name = user.user_metadata?.display_name;
  return typeof name !== 'string' || name.trim() === '';
}
