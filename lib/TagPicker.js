import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Chip, Field, Button } from './ui';
import { Icon } from './icons';
import { colors, type, space, radius } from './theme';
import { TAG_COLORS } from './constants';
import { t } from './i18n';

// TagPicker — multi-select van zelfgemaakte, gekleurde labels op een afspraak (UX-41).
// Bestaande tags zijn toggle-bare gekleurde chips; "+ Label" klapt een mini-editor open
// (naam + kleurkeuze) die de nieuwe tag aanmaakt en meteen selecteert. Gecontroleerd
// component: de ouder houdt `selectedIds` vast. `onCreate(name,color)` geeft de nieuwe
// tag terug (met id) zodat we 'm direct kunnen aanvinken.
export function TagPicker({ tags = [], selectedIds = [], onToggle, onCreate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const tag = await onCreate({ name: trimmed, color });
      if (tag?.id) onToggle(tag.id);
      setName(''); setColor(TAG_COLORS[0]); setAdding(false);
    } finally { setBusy(false); }
  };

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[type.label, { marginBottom: 8 }]}>{t('task.tags.label')}</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tags.map((tag) => (
          <Chip key={tag.id} label={tag.name} color={tag.color}
            active={selectedIds.includes(tag.id)} onPress={() => onToggle(tag.id)}
            onLongPress={onDelete ? () => onDelete(tag) : undefined}
            accessibilityHint={onDelete ? t('task.tags.deleteHint') : undefined} />
        ))}
        {!adding ? (
          <Pressable onPress={() => setAdding(true)} accessibilityRole="button"
            accessibilityLabel={t('task.tags.new')}
            style={({ pressed }) => ({
              minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: space.xs,
              paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1.5,
              borderStyle: 'dashed', borderColor: colors.lineStrong,
              backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
            })}>
            <Icon name="add" size={15} color={colors.forest} />
            <Text style={{ color: colors.forest, fontWeight: '600', fontSize: 14 }}>{t('task.tags.new')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Mini-editor: naam + kleur. */}
      {adding ? (
        <View style={{ marginTop: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
          <Field value={name} onChangeText={setName} placeholder={t('task.tags.placeholder')} autoFocus />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs, marginBottom: space.sm }}>
            {TAG_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} accessibilityRole="button"
                accessibilityState={{ selected: color === c }} accessibilityLabel={c}
                style={{
                  width: 32, height: 32, borderRadius: 16, backgroundColor: c,
                  borderWidth: 3, borderColor: color === c ? colors.ink : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                {color === c ? <Icon name="check" size={16} color={colors.onDark} weight="bold" /> : null}
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title={t('common.cancelLong')} variant="ghost" onPress={() => { setAdding(false); setName(''); }} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t('task.tags.add')} onPress={create} loading={busy} disabled={!name.trim()} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
