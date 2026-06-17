import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { run, mutate } from './db';

const HouseholdCtx = createContext(null);
const ACTIVE_KEY = 'huishoek.activeHousehold';

export function HouseholdProvider({ children }) {
  const { user } = useAuth();
  const [households, setHouseholds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [members, setMembers] = useState([]);
  const [subgroups, setSubgroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHouseholds = useCallback(async () => {
    if (!user) { setHouseholds([]); setLoading(false); return; }
    const memberRows = await run(
      supabase
        .from('household_members')
        .select('household_id, role, households(*)')
        .eq('profile_id', user.id),
      { fallback: [], context: 'huishoudens laden' }
    );
    const list = (memberRows ?? [])
      .map((r) => ({ ...r.households, role: r.role }))
      .filter(Boolean);
    setHouseholds(list);
    // Actief huishouden bepalen
    const stored = await AsyncStorage.getItem(ACTIVE_KEY);
    const next = list.find((h) => h.id === stored)?.id ?? list[0]?.id ?? null;
    setActiveId(next);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadHouseholds(); }, [loadHouseholds]);

  // Leden van het actieve huishouden laden
  const loadMembers = useCallback(async () => {
    if (!activeId) { setMembers([]); return; }
    const data = await run(
      supabase
        .from('household_members')
        .select('role, profile_id, profiles(*)')
        .eq('household_id', activeId),
      { fallback: [], context: 'leden laden' }
    );
    setMembers((data ?? []).map((r) => ({ ...r.profiles, role: r.role })));
  }, [activeId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // Subgroepen (met hun leden) van het actieve huishouden laden
  const loadSubgroups = useCallback(async () => {
    if (!activeId) { setSubgroups([]); return; }
    const data = await run(
      supabase
        .from('subgroups')
        .select('*, subgroup_members(profile_id)')
        .eq('household_id', activeId)
        .order('created_at', { ascending: true }),
      { fallback: [], context: 'groepen laden' }
    );
    setSubgroups((data ?? []).map((s) => ({
      ...s,
      memberIds: (s.subgroup_members ?? []).map((m) => m.profile_id),
    })));
  }, [activeId]);

  useEffect(() => { loadSubgroups(); }, [loadSubgroups]);

  // Subgroep aanmaken met een set leden
  const createSubgroup = async (name, emoji, memberIds) => {
    const [data] = await mutate(
      supabase
        .from('subgroups')
        .insert({ household_id: activeId, name, emoji: emoji || '👥', created_by: user.id })
        .select(),
      { context: 'groep aanmaken' }
    );
    const rows = (memberIds ?? []).map((pid) => ({ subgroup_id: data.id, profile_id: pid }));
    if (rows.length) {
      await mutate(supabase.from('subgroup_members').insert(rows), { context: 'groepsleden toevoegen' });
    }
    await loadSubgroups();
    return data;
  };

  // Subgroep-leden vervangen
  const updateSubgroupMembers = async (subgroupId, memberIds) => {
    await mutate(
      supabase.from('subgroup_members').delete().eq('subgroup_id', subgroupId),
      { context: 'groepsleden wissen' }
    );
    const rows = (memberIds ?? []).map((pid) => ({ subgroup_id: subgroupId, profile_id: pid }));
    if (rows.length) {
      await mutate(supabase.from('subgroup_members').insert(rows), { context: 'groepsleden toevoegen' });
    }
    await loadSubgroups();
  };

  const deleteSubgroup = async (subgroupId) => {
    await mutate(
      supabase.from('subgroups').delete().eq('id', subgroupId),
      { context: 'groep verwijderen' }
    );
    await loadSubgroups();
  };

  const selectHousehold = async (id) => {
    setActiveId(id);
    await AsyncStorage.setItem(ACTIVE_KEY, id);
  };

  const createHousehold = async (name, emoji) => {
    const { data, error } = await supabase
      .from('households')
      .insert({ name, emoji: emoji || '🏡', created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    await supabase.from('household_members').insert({
      household_id: data.id, profile_id: user.id, role: 'owner',
    });
    await loadHouseholds();
    await selectHousehold(data.id);
    return data;
  };

  const joinHousehold = async (code) => {
    const { data, error } = await supabase.rpc('join_household', { code });
    if (error) throw error;
    await loadHouseholds();
    await selectHousehold(data);
    return data;
  };

  const leaveHousehold = async (id) => {
    await mutate(
      supabase
        .from('household_members')
        .delete()
        .eq('household_id', id)
        .eq('profile_id', user.id),
      { context: 'huishouden verlaten' }
    );
    await loadHouseholds();
  };

  const active = households.find((h) => h.id === activeId) ?? null;

  return (
    <HouseholdCtx.Provider
      value={{
        households, active, activeId, members, subgroups, loading,
        selectHousehold, createHousehold, joinHousehold, leaveHousehold,
        createSubgroup, updateSubgroupMembers, deleteSubgroup,
        reload: loadHouseholds, reloadMembers: loadMembers, reloadSubgroups: loadSubgroups,
      }}
    >
      {children}
    </HouseholdCtx.Provider>
  );
}

export const useHousehold = () => {
  const ctx = useContext(HouseholdCtx);
  if (!ctx) throw new Error('useHousehold buiten HouseholdProvider');
  return ctx;
};
