// Units voor de pure OTP-loginlogica (lib/otp.js, PLT-8): code-normalisatie/
// -validatie, de resend-afkoeltijd (mét de exacte grens) en de naam-check na de
// allereerste OTP-login.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OTP_LENGTH, RESEND_COOLDOWN_MS,
  normalizeOtpCode, isValidOtpCode, resendRemainingSeconds, canResend, needsDisplayName,
} from '../lib/otp.js';

test('otp: constanten — 6 cijfers, 30 s afkoeltijd', () => {
  assert.equal(OTP_LENGTH, 6);
  assert.equal(RESEND_COOLDOWN_MS, 30_000);
});

test('normalizeOtpCode strips alles behalve cijfers en kapt af op de codelengte', () => {
  assert.equal(normalizeOtpCode('123456'), '123456');
  assert.equal(normalizeOtpCode(' 12 34 56 '), '123456');   // plak met spaties
  assert.equal(normalizeOtpCode('123-456'), '123456');      // met scheidingsteken
  assert.equal(normalizeOtpCode('code: 987654!'), '987654'); // autofill met tekst eromheen
  assert.equal(normalizeOtpCode('1234567'), '123456');      // te lang → afgekapt op 6
  assert.equal(normalizeOtpCode('abc'), '');                // geen cijfers → leeg
  assert.equal(normalizeOtpCode(123456), '123456');         // niet-string → String()
});

test('normalizeOtpCode zonder argument → lege string (default-param)', () => {
  assert.equal(normalizeOtpCode(), '');
});

test('isValidOtpCode: alleen precies 6 cijfers is geldig', () => {
  assert.equal(isValidOtpCode('123456'), true);
  assert.equal(isValidOtpCode('12345'), false);    // te kort (grens: 5)
  assert.equal(isValidOtpCode('1234567'), false);  // te lang (grens: 7)
  assert.equal(isValidOtpCode('12345a'), false);   // letter erin
  assert.equal(isValidOtpCode(''), false);
  assert.equal(isValidOtpCode(123456), false);     // niet-string telt niet
  assert.equal(isValidOtpCode(null), false);
  assert.equal(isValidOtpCode(undefined), false);
});

test('resendRemainingSeconds telt af, rondt naar boven af en klemt op 0', () => {
  const sentAt = 1_000_000;
  assert.equal(resendRemainingSeconds(sentAt, sentAt), 30);             // net verstuurd → volle 30
  assert.equal(resendRemainingSeconds(sentAt, sentAt + 1_000), 29);     // 1 s later
  assert.equal(resendRemainingSeconds(sentAt, sentAt + 29_999), 1);     // 1 ms rest → nog "1 s" (ceil)
  assert.equal(resendRemainingSeconds(sentAt, sentAt + 29_001), 1);     // 999 ms rest → óók 1 (ceil, geen floor/round)
  assert.equal(resendRemainingSeconds(sentAt, sentAt + 30_000), 0);     // precies op de grens → vrij
  assert.equal(resendRemainingSeconds(sentAt, sentAt + 60_000), 0);     // ver erna → geklemd op 0, niet negatief
});

test('resendRemainingSeconds zonder verzonden code (null/undefined) → 0', () => {
  assert.equal(resendRemainingSeconds(null, 5_000), 0);
  assert.equal(resendRemainingSeconds(undefined, 5_000), 0);
});

test('canResend: vrij bij 0 resterend, op slot ervoor — precies op de grens telt als vrij', () => {
  const sentAt = 1_000_000;
  assert.equal(canResend(sentAt, sentAt), false);
  assert.equal(canResend(sentAt, sentAt + 29_999), false);  // 1 ms vóór de grens: nog op slot
  assert.equal(canResend(sentAt, sentAt + 30_000), true);   // exact de grens: vrij
  assert.equal(canResend(null, 0), true);                   // nog nooit verstuurd: vrij
});

test('needsDisplayName: OTP-account zonder naam → true; gezette naam → false', () => {
  assert.equal(needsDisplayName({ user_metadata: {} }), true);              // vers OTP-account
  assert.equal(needsDisplayName({ user_metadata: { display_name: '' } }), true);
  assert.equal(needsDisplayName({ user_metadata: { display_name: '   ' } }), true); // alleen spaties = ontbrekend
  assert.equal(needsDisplayName({ user_metadata: { display_name: 42 } }), true);    // niet-string telt niet
  assert.equal(needsDisplayName({}), true);                                 // metadata ontbreekt helemaal
  assert.equal(needsDisplayName({ user_metadata: { display_name: 'Erik' } }), false);
  assert.equal(needsDisplayName({ user_metadata: { display_name: ' E ' } }), false); // met spaties eromheen is oké
});

test('needsDisplayName: geen gebruiker (uitgelogd) → false, niet naar /naam sturen', () => {
  assert.equal(needsDisplayName(null), false);
  assert.equal(needsDisplayName(undefined), false);
});
