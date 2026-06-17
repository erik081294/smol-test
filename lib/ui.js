import React from 'react';
import { Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { colors, radius, type } from './theme';

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }) {
  const bg = variant === 'primary' ? colors.forest
    : variant === 'accent' ? colors.ocher
    : variant === 'ghost' ? 'transparent' : colors.surfaceAlt;
  const fg = variant === 'primary' ? '#fff'
    : variant === 'accent' ? colors.forest
    : colors.ink;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[{
        backgroundColor: bg,
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: radius.md,
        alignItems: 'center',
        opacity: disabled ? 0.5 : 1,
        borderWidth: variant === 'ghost' ? 1.5 : 0,
        borderColor: colors.line,
      }, style]}
    >
      {loading
        ? <ActivityIndicator color={fg} />
        : <Text style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={[type.label, { marginBottom: 6 }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.line,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 13,
          fontSize: 16,
          color: colors.ink,
        }}
        {...props}
      />
    </View>
  );
}

export function Card({ children, style }) {
  return (
    <View style={[{
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.line,
    }, style]}>
      {children}
    </View>
  );
}

export function Chip({ label, active, color, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: active ? (color || colors.forest) : colors.surface,
        borderWidth: 1.5,
        borderColor: active ? (color || colors.forest) : colors.line,
        marginRight: 8,
      }}
    >
      <Text style={{
        color: active ? '#fff' : colors.inkSoft,
        fontWeight: '600',
        fontSize: 14,
      }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Avatar({ emoji, name, size = 36 }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: colors.ocherSoft,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.5 }}>{emoji || (name?.[0] ?? '🙂')}</Text>
    </View>
  );
}

export function Empty({ emoji, title, subtitle }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <Text style={{ fontSize: 44, marginBottom: 12 }}>{emoji}</Text>
      <Text style={[type.h2, { textAlign: 'center', marginBottom: 4 }]}>{title}</Text>
      <Text style={[type.body, { color: colors.inkSoft, textAlign: 'center' }]}>{subtitle}</Text>
    </View>
  );
}
