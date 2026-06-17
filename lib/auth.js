import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
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
    signOut: () => supabase.auth.signOut(),
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
