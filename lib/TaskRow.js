import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, categoryMeta } from './theme';
import { VISIBILITY } from './constants';
import { dueLabel, isOverdue, recurrenceLabel } from './recurrence';

export function TaskRow({ task, members, onToggle }) {
  const router = useRouter();
  const done = !!task.completed_at;
  const cat = categoryMeta[task.category] ?? categoryMeta.overig;
  const assignee = members?.find((m) => m.id === task.assigned_to);
  const overdue = isOverdue(task);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/task/${task.id}`)}
      style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: overdue ? colors.danger + '55' : colors.line,
      }}
    >
      {/* Checkbox */}
      <TouchableOpacity
        onPress={() => onToggle(task)}
        hitSlop={10}
        style={{
          width: 26, height: 26, borderRadius: 8, marginRight: 13,
          borderWidth: 2,
          borderColor: done ? colors.done : cat.color,
          backgroundColor: done ? colors.done : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {done && <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>✓</Text>}
      </TouchableOpacity>

      {/* Inhoud */}
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 16, fontWeight: '600',
          color: done ? colors.inkFaint : colors.ink,
          textDecorationLine: done ? 'line-through' : 'none',
        }} numberOfLines={1}>{task.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 12, color: cat.color, fontWeight: '600' }}>
            {cat.emoji} {cat.label}
          </Text>
          {task.due_date && (
            <Text style={{ fontSize: 12, color: overdue ? colors.danger : colors.inkSoft, marginLeft: 8 }}>
              · {dueLabel(task)}
            </Text>
          )}
          {task.recur_freq && (
            <Text style={{ fontSize: 12, color: colors.inkFaint, marginLeft: 8 }}>
              · 🔁 {recurrenceLabel(task)}
            </Text>
          )}
          {task.visibility && task.visibility !== VISIBILITY.HOUSEHOLD && (
            <Text style={{ fontSize: 12, color: colors.inkFaint, marginLeft: 8 }}>
              · 🔒 Gedeeld
            </Text>
          )}
        </View>
      </View>

      {/* Toegewezen aan */}
      {assignee && (
        <View style={{
          width: 30, height: 30, borderRadius: 15, marginLeft: 8,
          backgroundColor: colors.ocherSoft, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 15 }}>{assignee.avatar_emoji}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
