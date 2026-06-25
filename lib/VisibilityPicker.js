import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Chip, Avatar, Collapsible } from './ui';
import { colors, type, space } from './theme';
import { VISIBILITY } from './constants';
import { t } from './i18n';

// Korte samenvatting van de huidige keuze, voor de ingeklapte rij.
function summaryFor(visibility, { subgroups = [], shareSubgroupId } = {}) {
  if (visibility === VISIBILITY.SUBGROUP) {
    const g = subgroups.find((s) => s.id === shareSubgroupId);
    return g ? `${g.emoji} ${g.name}` : t('visibility.summary.subgroup');
  }
  if (visibility === VISIBILITY.CUSTOM) return t('visibility.summary.custom');
  return t('visibility.summary.household');
}

// Herbruikbare "Delen met"-kiezer. Werkt voor elke module die het
// zichtbaarheidscontract volgt (taken, uitgaven, planten). Gecontroleerd
// component: de ouder houdt de state vast.
//
// `collapsible` (default false): toon een rustige samenvattingsrij die de keuzes
// pas uitklapt bij tikken — voor formulieren waar zichtbaarheid een geavanceerde,
// zelden-gewijzigde optie is die de hoofd-flow niet hoort te onderbreken. De rij
// start open zodra de keuze afwijkt van de standaard (Hele huishouden).
export function VisibilityPicker({
  visibility, onChangeVisibility,
  shareSubgroupId, onChangeSubgroup,
  shareWith, onToggleMember,
  subgroups = [], members = [],
  collapsible = false,
  label, hint,
}) {
  const controls = (
    <>
      {hint ? <Text style={[type.caption, { marginBottom: 10 }]}>{hint}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <Chip icon="home" label={t('visibility.household')} active={visibility === VISIBILITY.HOUSEHOLD}
          onPress={() => onChangeVisibility(VISIBILITY.HOUSEHOLD)} />
        {subgroups.length > 0 && (
          <Chip icon="group" label={t('visibility.subgroup')} active={visibility === VISIBILITY.SUBGROUP}
            onPress={() => onChangeVisibility(VISIBILITY.SUBGROUP)} />
        )}
        <Chip icon="check" label={t('visibility.custom')} active={visibility === VISIBILITY.CUSTOM}
          onPress={() => onChangeVisibility(VISIBILITY.CUSTOM)} />
      </View>

      {visibility === VISIBILITY.HOUSEHOLD && (
        <Text style={[type.caption, { marginBottom: 18 }]}>{t('visibility.household.hint')}</Text>
      )}

      {visibility === VISIBILITY.SUBGROUP && (
        <View style={{ marginBottom: 18 }}>
          {subgroups.length === 0 ? (
            <Text style={[type.caption]}>{t('visibility.subgroup.empty')}</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {subgroups.map((g) => (
                <Chip key={g.id} label={`${g.emoji} ${g.name}`}
                  active={shareSubgroupId === g.id}
                  onPress={() => onChangeSubgroup(g.id)} />
              ))}
            </View>
          )}
        </View>
      )}

      {visibility === VISIBILITY.CUSTOM && (
        <View style={{ marginBottom: 18 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {members.map((m) => {
              const on = (shareWith ?? []).includes(m.id);
              return (
                <TouchableOpacity key={m.id} onPress={() => onToggleMember(m.id)}
                  style={{ alignItems: 'center', marginRight: 14, opacity: on ? 1 : 0.45 }}>
                  <View style={{ borderWidth: 2, borderRadius: 26, borderColor: on ? colors.forest : 'transparent' }}>
                    <Avatar emoji={m.avatar_emoji} name={m.display_name} size={48} />
                  </View>
                  <Text style={[type.caption, { marginTop: 4 }]} numberOfLines={1}>
                    {m.display_name?.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={[type.caption, { marginTop: 6 }]}>{t('visibility.custom.hint')}</Text>
        </View>
      )}
    </>
  );

  if (collapsible) {
    return (
      <Collapsible
        label={label ?? t('visibility.label')}
        summary={summaryFor(visibility, { subgroups, shareSubgroupId })}
        defaultOpen={visibility !== VISIBILITY.HOUSEHOLD}
      >
        {controls}
      </Collapsible>
    );
  }

  return (
    <View>
      <Text style={[type.label, { marginBottom: 8 }]}>{label ?? t('visibility.label')}</Text>
      {controls}
    </View>
  );
}
