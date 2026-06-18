import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, categoryMeta } from './theme';
import { Checkbox, ItemRow, Avatar } from './ui';
import { Icon } from './icons';
import { VISIBILITY } from './constants';
import { dueLabel, isOverdue, recurrenceLabel } from './recurrence';

// Klein scheidingsteken tussen meta-stukjes.
const Dot = () => <Text style={{ fontSize: 12, color: colors.inkFaint }}>·</Text>;

export function TaskRow({ task, members, onToggle, onPress }) {
  const router = useRouter();
  const done = !!task.completed_at;
  const cat = categoryMeta[task.category] ?? categoryMeta.overig;
  const assignee = members?.find((m) => m.id === task.assigned_to);
  const overdue = isOverdue(task);
  const shared = task.visibility && task.visibility !== VISIBILITY.HOUSEHOLD;
  const rotates = task.rotation?.length > 0;

  const meta = (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
      <Icon name={cat.icon} size={13} color={cat.color} weight="fill" />
      <Text style={{ fontSize: 12, color: cat.color, fontWeight: '600' }}>{cat.label}</Text>
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
      {shared ? <Text style={{ fontSize: 12, color: colors.inkFaint }}>Gedeeld</Text> : null}
      {rotates ? <Dot /> : null}
      {rotates ? <Icon name="rotation" size={12} color={colors.inkFaint} /> : null}
      {rotates ? <Text style={{ fontSize: 12, color: colors.inkFaint }}>Rouleert</Text> : null}
    </View>
  );

  return (
    <ItemRow
      onPress={onPress ?? (() => router.push(`/task/${task.id}`))}
      borderColor={overdue ? colors.danger + '55' : undefined}
      leading={
        <Checkbox
          checked={done}
          onPress={() => onToggle(task)}
          color={cat.color}
          accessibilityLabel={`${task.title}, ${done ? 'afgevinkt' : 'niet afgevinkt'}`}
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
