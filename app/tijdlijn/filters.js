import React from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useHousehold } from '../../lib/household';
import { useTimelineFilters } from '../../lib/useTimelineFilters';
import { TIMELINE_FILTER_MODULES, TIMELINE_EVENT_TYPES } from '../../lib/timelineFilter';
import { getModule } from '../../lib/modules';
import { ModalHeader, SectionHeader, ItemRow } from '../../lib/ui';
import { Icon } from '../../lib/icons';
import { colors, type, space } from '../../lib/theme';
import { dialog } from '../../lib/dialog';
import { t } from '../../lib/i18n';

// Tijdlijn-filterinstellingen (TML-6): wat verschijnt er in de feed? Twee lagen,
// zelfde patroon als de module-toggles in app/(tabs)/huishouden.js — "Voor mij"
// (elk lid verfijnt voor zichzelf) en, voor de owner, "Voor het hele huishouden"
// (de basis; een huishouden-uitzetting wint en is voor een lid niet terug te
// zetten — de Switch staat dan uitgegrijsd, zoals bij modules).
// Assen in deze stap: per module + per gebeurtenis-type (member/subgroep: TML-7/8).

// Icoon per event-type (dezelfde iconen als de feed-regels in lib/activity.js).
const EVENT_ICON = {
  task_completed: 'check',
  expense_added: 'expenses',
  grocery_added: 'shopping',
  plant_added: 'plants',
  pet_added: 'pets',
  vehicle_added: 'voertuig',
};

// Eén toggle-rij; op de "Voor mij"-laag is een huishouden-uitzetting leidend
// (Switch uitgegrijsd + uitlegregel, zoals household.module.disabledByHousehold).
// Top-level component (geen inline definitie in de render, react-hooks-regel).
function FilterRow({ icon, label, locked, on, onChange }) {
  return (
    <ItemRow
      leading={<Icon name={icon} size={24} color={locked ? colors.inkFaint : colors.forest} />}
      title={label}
      titleColor={locked ? colors.inkFaint : undefined}
      meta={locked ? <Text style={type.caption}>{t('household.module.disabledByHousehold')}</Text> : undefined}
      trailing={
        <Switch value={on} disabled={locked} onValueChange={onChange}
          trackColor={{ true: colors.forest }} />
      }
    />
  );
}

export default function TijdlijnFilters() {
  const router = useRouter();
  const { active } = useHousehold();
  const isOwner = active?.role === 'owner';
  const { householdDisabled, userDisabled, setHouseholdPref, setUserPref } = useTimelineFilters();

  const hhOff = (axis, value) => (householdDisabled[axis] ?? []).includes(value);
  const meOff = (axis, value) => (userDisabled[axis] ?? []).includes(value);
  const toggle = (mine, axis, value, enabled) =>
    (mine ? setUserPref : setHouseholdPref)(axis, value, enabled)
      .catch((e) => dialog.alert({ title: t('common.failed'), body: e.message }));

  // De rijen van één laag: eerst de modules die de tijdlijn voeden, dan de
  // event-types. Gewone functie (geen inline component) — geeft direct JSX terug.
  const renderRows = (mine) => {
    const row = (icon, label, axis, value) => {
      const locked = mine && hhOff(axis, value);
      const on = mine ? !locked && !meOff(axis, value) : !hhOff(axis, value);
      return (
        <FilterRow key={`${axis}:${value}`} icon={icon} label={label} locked={locked} on={on}
          onChange={(v) => toggle(mine, axis, value, v)} />
      );
    };
    return (
      <>
        <SectionHeader title={t('timeline.filters.modules')} />
        {TIMELINE_FILTER_MODULES.map((key) => {
          const m = getModule(key);
          return row(m?.icon ?? 'pinboard', m?.label ?? key, 'module', key);
        })}
        <SectionHeader title={t('timeline.filters.events')} />
        {TIMELINE_EVENT_TYPES.map((type_) => (
          row(EVENT_ICON[type_] ?? 'pinboard', t(`timeline.filter.event.${type_}`), 'event_type', type_)
        ))}
      </>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ModalHeader title={t('timeline.filters.title')} onClose={() => router.back()} backLabel={t('timeline.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm }}>
        <SectionHeader title={t('timeline.filters.mine')} />
        <Text style={[type.caption, { marginBottom: space.sm }]}>{t('timeline.filters.mine.hint')}</Text>
        {renderRows(true)}

        {isOwner ? (
          <View style={{ marginTop: space.xl }}>
            <SectionHeader title={t('timeline.filters.household')} />
            <Text style={[type.caption, { marginBottom: space.sm }]}>{t('timeline.filters.household.hint')}</Text>
            {renderRows(false)}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
