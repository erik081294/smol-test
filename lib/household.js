import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { run, mutate } from './db';
import { effectiveModules, isModuleEnabled } from './modules';

const HouseholdCtx = createContext(null);
const ACTIVE_KEY = 'huishoek.activeHousehold';
// Openstaand invite-token (web-first): overleeft de login-round-trip zodat de
// ontvanger ná inloggen de "je bent uitgenodigd"-melding ziet (PLT-7).
const PENDING_INVITE_KEY = 'huishoek.pendingInvite';

export function HouseholdProvider({ children }) {
  const { user } = useAuth();
  const [households, setHouseholds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [members, setMembers] = useState([]);
  const [subgroups, setSubgroups] = useState([]);
  // Module aan/uit: we bewaren alleen de uitgezette sleutels (default-on).
  // householdDisabled geldt voor het hele huishouden (owner); userDisabled is
  // de persoonlijke keuze van het ingelogde lid.
  const [householdDisabled, setHouseholdDisabled] = useState([]);
  const [userDisabled, setUserDisabled] = useState([]);
  const [loading, setLoading] = useState(true);
  // Is er ooit een echte fetch mét gebruiker afgerond? Zo niet, dan is een lege
  // huishoudenslijst "nog niet geladen", niet "geen huishouden" (zie appRoute).
  const [hasFetched, setHasFetched] = useState(false);
  // Uitnodigingen (PLT-7): openstaande invites van het actieve huishouden (beheerlijst)
  // en het opgeslagen pending-token van een nog-niet-geaccepteerde uitnodiging.
  const [invites, setInvites] = useState([]);
  const [pendingInvite, setPendingInviteState] = useState(null);

  const loadHouseholds = useCallback(async () => {
    if (!user) { setHouseholds([]); setHasFetched(false); setLoading(false); return; }
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
    setHasFetched(true);
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

  // Module-instellingen laden: welke modules heeft het huishouden uitgezet, en
  // welke heeft dít lid voor zichzelf uitgezet. We lezen beide tabellen en
  // houden enkel de enabled=false-sleutels over (de rest is default-aan).
  const loadModuleSettings = useCallback(async () => {
    if (!activeId || !user) { setHouseholdDisabled([]); setUserDisabled([]); return; }
    const [hh, mine] = await Promise.all([
      run(
        supabase.from('household_modules').select('module_key, enabled').eq('household_id', activeId),
        { fallback: [], context: 'modules (huishouden) laden' }
      ),
      run(
        supabase.from('user_module_prefs').select('module_key, enabled')
          .eq('household_id', activeId).eq('profile_id', user.id),
        { fallback: [], context: 'modules (jij) laden' }
      ),
    ]);
    setHouseholdDisabled((hh ?? []).filter((r) => r.enabled === false).map((r) => r.module_key));
    setUserDisabled((mine ?? []).filter((r) => r.enabled === false).map((r) => r.module_key));
  }, [activeId, user]);

  useEffect(() => { loadModuleSettings(); }, [loadModuleSettings]);

  // Openstaande uitnodigingen van het actieve huishouden (beheerlijst). Alleen niet-
  // geaccepteerd en niet-ingetrokken; verlopen filteren we in de UI (inviteStatus).
  const loadInvites = useCallback(async () => {
    if (!activeId) { setInvites([]); return; }
    const data = await run(
      supabase.from('household_invites')
        .select('*')
        .eq('household_id', activeId)
        .is('accepted_at', null)
        .is('revoked_at', null)
        .order('created_at', { ascending: false }),
      { fallback: [], context: 'uitnodigingen laden' }
    );
    setInvites(data ?? []);
  }, [activeId]);

  useEffect(() => { loadInvites(); }, [loadInvites]);

  // Pending invite-token uit storage lezen (eenmalig). Zet/wist het token zowel in
  // state als in storage zodat de melding de login-round-trip overleeft.
  useEffect(() => {
    AsyncStorage.getItem(PENDING_INVITE_KEY).then((tok) => { if (tok) setPendingInviteState(tok); });
  }, []);

  const setPendingInvite = useCallback(async (token) => {
    setPendingInviteState(token ?? null);
    if (token) await AsyncStorage.setItem(PENDING_INVITE_KEY, token);
    else await AsyncStorage.removeItem(PENDING_INVITE_KEY);
  }, []);
  const clearPendingInvite = useCallback(() => setPendingInvite(null), [setPendingInvite]);

  // We bewaren enkel de uitgezette sleutels; een toggle voegt 'm toe of haalt 'm weg.
  const withModule = (list, key, enabled) =>
    enabled ? list.filter((k) => k !== key) : list.includes(key) ? list : [...list, key];

  // Zet een module aan/uit voor het hele huishouden (alleen owner; RLS dwingt af).
  // Optimistisch: de lokale staat verspringt meteen zodat de Switch direct meebeweegt
  // (niet 'terugschiet' tijdens de round-trip) en snelle herhaalde tikken niet stapelen.
  // Mislukt de server, dan herstellen we naar de serverwaarheid.
  const setHouseholdModule = async (key, enabled) => {
    setHouseholdDisabled((d) => withModule(d, key, enabled));
    try {
      await mutate(
        supabase.from('household_modules').upsert(
          { household_id: activeId, module_key: key, enabled, updated_at: new Date().toISOString() },
          { onConflict: 'household_id,module_key' }
        ),
        { context: 'module aan/uit (huishouden)' }
      );
    } catch (e) {
      await loadModuleSettings(); // rollback naar serverwaarheid
      throw e;
    }
  };

  // Zet een module aan/uit voor jezelf, binnen dit huishouden. Zelfde optimistische
  // aanpak als hierboven.
  const setUserModule = async (key, enabled) => {
    setUserDisabled((d) => withModule(d, key, enabled));
    try {
      await mutate(
        supabase.from('user_module_prefs').upsert(
          { profile_id: user.id, household_id: activeId, module_key: key, enabled, updated_at: new Date().toISOString() },
          { onConflict: 'profile_id,household_id,module_key' }
        ),
        { context: 'module aan/uit (jij)' }
      );
    } catch (e) {
      await loadModuleSettings(); // rollback naar serverwaarheid
      throw e;
    }
  };

  // De effectieve set die de tabbalk toont (kern + niet-uitgezet). Gememoiseerd (P1):
  // effectiveModules bouwt elke render een nieuwe array; zonder memo kreeg elke consumer
  // (module-gating, tabbalk) een nieuwe identiteit → onnodige re-renders app-breed.
  const modules = useMemo(
    () => effectiveModules({ householdDisabled, userDisabled }),
    [householdDisabled, userDisabled],
  );

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

  // Huishouden + owner-membership atomair via de DEFINER-RPC create_household
  // (SEC-1). Directe inserts op household_members zijn server-side ingetrokken,
  // zodat niemand zich als 'owner' aan een vreemd huishouden kan toevoegen.
  const createHousehold = async (name, emoji) => {
    const { data, error } = await supabase.rpc('create_household', {
      p_name: name,
      p_emoji: emoji || '🏡',
    });
    if (error) throw error;
    await loadHouseholds();
    await selectHousehold(data.id);
    return data;
  };

  // Toetreden gaat sinds PLT-7 (0053) uitsluitend via persoonlijke, eenmalige
  // invite-tokens (acceptInvite hieronder). De oude statische-code-route
  // (join_household + households.invite_code) is in 0055 verwijderd — server-side
  // én hier — omdat 'm bruteforcebaar was (cross-household datalek, SEC-5).

  // --- Uitnodigingen (PLT-7) -------------------------------------------------
  // Owner maakt een persoonlijke, 24u geldige, eenmalige invite (rol vooraf).
  const createInvite = async (role = 'member') => {
    const { data, error } = await supabase.rpc('create_invite', {
      p_household_id: activeId, p_role: role,
    });
    if (error) throw error;
    await loadInvites();
    return data;
  };

  // Owner trekt een openstaande invite in (per stuk; geen rotate-bom).
  const revokeInvite = async (id) => {
    const { error } = await supabase.rpc('revoke_invite', { p_id: id });
    if (error) throw error;
    await loadInvites();
  };

  // Ingelogde ontvanger wisselt het token in → lid; daarna pending opruimen.
  const acceptInvite = async (token) => {
    const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
    if (error) throw error;
    await loadHouseholds();
    await selectHousehold(data);
    await clearPendingInvite();
    return data;
  };

  // Niet-gevoelige preview (mag anon): { household_id, household_name, household_emoji,
  // inviter_name, role, status } of null als het token onbekend is.
  const peekInvite = async (token) => {
    const { data, error } = await supabase.rpc('peek_invite', { p_token: token });
    if (error) throw error;
    return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
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
        households, active, activeId, members, subgroups, loading, hasFetched,
        modules, householdDisabled, userDisabled, setHouseholdModule, setUserModule,
        selectHousehold, createHousehold, leaveHousehold,
        createSubgroup, updateSubgroupMembers, deleteSubgroup,
        invites, createInvite, revokeInvite, acceptInvite, peekInvite, reloadInvites: loadInvites,
        pendingInvite, setPendingInvite, clearPendingInvite,
        reload: loadHouseholds, reloadMembers: loadMembers, reloadSubgroups: loadSubgroups,
        reloadModules: loadModuleSettings,
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

// Gegate household-id voor de datalaag (ARCH-3): de actieve household-id, of null als de
// meegegeven module is uitgezet (huishouden- óf gebruiker-uitzetting). Dé enige plek waar
// "laad geen data van een uitgezette module" leeft — gebruikt door zowel useCollection
// als de custom data-hooks (useMealPlan/useExpenses), zodat er geen tweede, los
// driftende kopie van de gate-logica ontstaat. `module` weglaten/null = nooit gaten
// (voor cross-cutting tabellen zoals tasks/products die niet bij één module horen).
export const useGatedHouseholdId = (module = null) => {
  const { activeId, householdDisabled, userDisabled } = useHousehold();
  if (module != null && !isModuleEnabled(module, { householdDisabled, userDisabled })) return null;
  return activeId;
};
