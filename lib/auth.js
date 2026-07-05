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
