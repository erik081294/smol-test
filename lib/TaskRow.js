import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, categoryMeta } from './theme';
import { Checkbox, ItemRow, Avatar } from './ui';
import { Icon } from './icons';
import { VISIBILITY } from './constants';
import { dueLabel, isOverdue, recurrenceLabel } from './recurrence';
import { taskHref } from './agenda';
import { t } from './i18n';

// Klein scheidingsteken tussen meta-stukjes.
const Dot = () => <Text style={{ fontSize: 12, color: colors.inkFaint }}>·</Text>;

export function TaskRow({ task, members, tags, onToggle, onPress }) {
  const router = useRouter();
  const done = !!task.completed_at;
  const cat = categoryMeta[task.category] ?? categoryMeta.overig;
  const assignee = members?.find((m) => m.id === task.assigned_to);
  const overdue = isOverdue(task);
  const shared = task.visibility && task.visibility !== VISIBILITY.HOUSEHOLD;
  const rotates = task.rotation?.length > 0;
  // Zelfgemaakte labels (UX-41) — alleen als de lijst de tag-set meegeeft.
  const taskTags = (tags && task.tag_ids?.length)
    ? task.tag_ids.map((id) => tags.find((tg) => tg.id === id)).filter(Boolean)
    : [];

  const meta = (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
      <Icon name={cat.icon} size={13} color={cat.color} weight="fill" />
      {/* Label in inkSoft (AA-leesbaar); de kleur-identiteit zit in het icoon ernaast
          — de accentkleuren halen op wit géén tekstcontrast (PLT-5). */}
      <Text style={{ fontSize: 12, color: colors.inkSoft, fontWeight: '600' }}>{cat.label}</Text>
      {task.zone ? <Dot /> : null}
      {task.zone ? (
        <Text style={{ fontSize: 12, color: colors.inkSoft }}>
          {task.zone.emoji ? `${task.zone.emoji} ` : ''}{task.zone.name}
        </Text>
      ) : null}
      {task.due_date ? <Dot /> : null}
      {task.due_date ? (
        <Text style={{ fontSize: 12, color: overdue ? colors.danger : colors.inkSoft }}>{dueLabel(task)}</Text>
      ) : null}
      {task.recur_freq ? <Dot /> : null}
      {task.recur_freq ? <Icon name="repeat" size={12} color={colors.inkFaint} /> : null}
      {task.recur_freq ? <Text style={{ fontSize: 12, color: colors.inkFaint }}>{recurrenceLabel(task)}</Text> : null}
      {shared ? <Dot /> : null}
      {shared ? <Icon name="shared" size={12} color={colors.inkFaint} /> : null}
      {shared ? <Text style={{ fontSize: 12, color: colors.inkFaint }}>{t('task.shared')}</Text> : null}
      {rotates ? <Dot /> : null}
      {rotates ? <Icon name="rotation" size={12} color={colors.inkFaint} /> : null}
      {rotates ? <Text style={{ fontSize: 12, color: colors.inkFaint }}>{t('task.rotates')}</Text> : null}
      {/* Gekleurde labels (UX-41): kleur-stip + naam, leesbaar in inkSoft. */}
      {taskTags.map((tag) => (
        <View key={tag.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tag.color }} />
          <Text style={{ fontSize: 12, color: colors.inkSoft }}>{tag.name}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <ItemRow
      onPress={onPress ?? (() => router.push(taskHref(task)))}
      borderColor={overdue ? colors.danger + '55' : undefined}
      leading={
        <Checkbox
          checked={done}
          onPress={() => onToggle(task)}
          color={cat.color}
          accessibilityLabel={`${task.title}, ${done ? t('a11y.checked') : t('a11y.unchecked')}`}
        />
      }
      title={task.title}
      titleColor={done ? colors.inkFaint : undefined}
      strikethrough={done}
      meta={meta}
      trailing={assignee ? <Avatar emoji={assignee.avatar_emoji} name={assignee.display_name} size={30} /> : null}
    />
  );
}
