import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Chip, Avatar } from './ui';
import { colors, type } from './theme';
import { VISIBILITY } from './constants';

// Herbruikbare "Delen met"-kiezer. Werkt voor elke module die het
// zichtbaarheidscontract volgt (taken, en later boodschappen/kosten/planten).
// Gecontroleerd component: de ouder houdt de state vast.
export function VisibilityPicker({
  visibility, onChangeVisibility,
  shareSubgroupId, onChangeSubgroup,
  shareWith, onToggleMember,
  subgroups = [], members = [],
}) {
  return (
    <View>
      <Text style={[type.label, { marginBottom: 8 }]}>Delen met</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <Chip icon="home" label="Hele huishouden" active={visibility === VISIBILITY.HOUSEHOLD}
          onPress={() => onChangeVisibility(VISIBILITY.HOUSEHOLD)} />
        {subgroups.length > 0 && (
          <Chip icon="group" label="Een groep" active={visibility === VISIBILITY.SUBGROUP}
            onPress={() => onChangeVisibility(VISIBILITY.SUBGROUP)} />
        )}
        <Chip icon="check" label="Kies personen" active={visibility === VISIBILITY.CUSTOM}
          onPress={() => onChangeVisibility(VISIBILITY.CUSTOM)} />
      </View>

      {visibility === VISIBILITY.HOUSEHOLD && (
        <Text style={[type.caption, { marginBottom: 18 }]}>
          Iedereen in <Text style={{ fontWeight: '700' }}>het huishouden</Text> ziet dit. Dit is de standaard.
        </Text>
      )}

      {visibility === VISIBILITY.SUBGROUP && (
        <View style={{ marginBottom: 18 }}>
          {subgroups.length === 0 ? (
            <Text style={[type.caption]}>
              Je hebt nog geen groepen. Maak er een aan bij Huishouden → Groepen.
            </Text>
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
          <Text style={[type.caption, { marginTop: 6 }]}>
            Jij ziet je eigen item altijd, ook als je jezelf niet aantikt.
          </Text>
        </View>
      )}
    </View>
  );
}
