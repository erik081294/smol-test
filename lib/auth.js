import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { clearCache } from './dataCache';
import { teardownRealtime } from './useRealtimeReload';

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
        options: { data: { display_name: displayName } },
      }),
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    // Leeg de in-memory data-cache én sloop alle realtime-kanalen zodat data/events van
    // deze gebruiker niet blijven hangen voor een volgende login op hetzelfde toestel
    // (PERF-2 cache-hygiëne + realtime-teardown, review 2026-06-27).
    signOut: () => { clearCache(); teardownRealtime(); return supabase.auth.signOut(); },
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
