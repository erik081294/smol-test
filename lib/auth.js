import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { unregisterPushToken } from './pushTokenRegistry';
import { clearCache } from './dataCache';
import { teardownRealtime } from './useRealtimeReload';
import { WEB_BASE_URL } from './invites';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // Geef het (verse) JWT aan de realtime-socket mee, óók bij koude start.
      supabase.realtime.setAuth(data.session?.access_token ?? null);
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      // Propageer het verse access-token naar de realtime-socket. Zonder dit blijft
      // de socket na een token-refresh (~1u, of na reconnect op slecht netwerk) op
      // het oude/verlopen JWT hangen; de RLS-gefilterde postgres_changes-subscriptions
      // stoppen dan stil met events leveren (geen crash — "realtime doet het niet meer").
      supabase.realtime.setAuth(s?.access_token ?? null);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    let active = true;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => { if (active) setProfile(data); });
    return () => { active = false; };
  }, [session?.user?.id]);

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUp: (email, password, displayName) =>
      supabase.auth.signUp({
        email,
        password,
        // INF-13: stuur de bevestigingslink expliciet naar de productie-web-host i.p.v.
        // de dashboard-default (die op localhost stond). Op web overschrijft Supabase dit
        // niet — de URL moet óók in de Supabase redirect-allowlist staan (dashboard-config).
        options: { data: { display_name: displayName }, emailRedirectTo: WEB_BASE_URL },
      }),
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    // Wachtwoordloos inloggen met een 6-cijferige e-mailcode (PLT-8) — het primaire
    // login-pad. Bewust een OTP-CÓDE en geen magic-link-URL: native staat
    // detectSessionInUrl uit (lib/supabase.js) en de deep-links dekken alleen /join,
    // dus een link uit de mail zou nergens landen. `shouldCreateUser: true` maakt
    // impliciet een account voor een nieuwe genodigde (de profiles-trigger uit
    // 0001_init vult display_name dan met het e-mail-lokaaldeel; de Gate vraagt de
    // echte naam daarna op /naam — zie needsDisplayName in lib/otp.js).
    //
    // LET OP — beheerstap buiten de repo (Supabase-dashboard), zonder deze
    // instellingen werkt de flow niet:
    //   1. Authentication → Sign In / Up → Email: provider aan laten en "Email OTP"
    //      toestaan (signInWithOtp valt anders terug op alleen een magic link).
    //   2. Authentication → Emails → Templates → "Magic Link": zorg dat de template
    //      {{ .Token }} toont (de 6-cijferige code) i.p.v. alleen {{ .ConfirmationURL }} —
    //      de gebruiker moet de code kunnen overtypen, de link werkt native niet.
    //   3. Authentication → URL Configuration: de redirect-allowlist hoeft voor de
    //      code-flow níét uitgebreid te worden (er is geen redirect); de bestaande
    //      entries voor signup/herstel (WEB_BASE_URL) blijven zoals ze zijn.
    //   4. Rate limits (Authentication → Rate Limits): de standaard e-mail-limiet
    //      geldt ook hier; de client houdt zelf al 30 s afkoeltijd aan (lib/otp.js).
    signInWithOtp: (email) =>
      supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }),
    // Verzilver de code uit de mail; bij succes zet supabase-js zelf de sessie
    // (onAuthStateChange hierboven pikt 'm op en de Gate routeert verder).
    verifyOtp: (email, code) =>
      supabase.auth.verifyOtp({ email, token: code, type: 'email' }),
    // Weergavenaam zetten ná de allereerste OTP-login (PLT-8): op twee plekken,
    // net als signUp dat in één keer doet — in de auth-metadata (bron voor de
    // needsDisplayName-check in de Gate) én in de al door de trigger aangemaakte
    // profiles-rij (bron voor de UI; die staat nu nog op het e-mail-lokaaldeel).
    updateDisplayName: async (displayName) => {
      const { data, error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
      if (error || !data?.user) return { data, error };
      const { error: profileError } = await supabase
        .from('profiles').update({ display_name: displayName }).eq('id', data.user.id);
      return { data, error: profileError };
    },
    // Wachtwoord-vergeten (UX-P5): stuur een herstelmail met een deep-link naar het
    // herstelscherm. Zelfde redirect-patroon als de e-mailbevestiging (INF-13): de
    // URL moet in de Supabase redirect-allowlist staan. `/herstel` opent op web direct
    // het herstelscherm; op web detecteert supabase-js de recovery-sessie uit de URL.
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, { redirectTo: `${WEB_BASE_URL}/herstel` }),
    // Zet het nieuwe wachtwoord op de (via de recovery-link tot stand gekomen) sessie.
    updatePassword: (password) => supabase.auth.updateUser({ password }),
    // Leeg de in-memory data-cache én sloop alle realtime-kanalen zodat data/events van
    // deze gebruiker niet blijven hangen voor een volgende login op hetzelfde toestel
    // (PERF-2 cache-hygiëne + realtime-teardown, review 2026-06-27).
    // Eerst de push-token-rij van dít toestel wissen (kan alleen zolang de sessie
    // er nog is — RLS); een uitgelogd/doorgegeven toestel mag geen pushes van dit
    // account blijven ontvangen (Plat-1, platform-review 2026-07-04).
    signOut: async () => { await unregisterPushToken(supabase); clearCache(); teardownRealtime(); return supabase.auth.signOut(); },
    refreshProfile: async () => {
      if (!session?.user) return;
      const { data } = await supabase
        .from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(data);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth buiten AuthProvider');
  return ctx;
};
